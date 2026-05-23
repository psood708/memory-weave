import asyncio
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

import aiosqlite

from memoryweave.auth.models import UserSession
from memoryweave.auth.session import verify_session
from memoryweave.db.database import init_db, get_db
from memoryweave.models.config_repo import ModelConfigRepo
from memoryweave.api.eval_routes import router as eval_router
from memoryweave.eval.bus import EvalEventBus
from memoryweave.eval.judges.heuristic_judge import HeuristicJudge
from memoryweave.eval.judges.ragas_judge import RagasJudge
from memoryweave.eval.repository.sqlite_repo import SQLiteMetricsRepository
from memoryweave.eval.workers.judge import LLMJudgeWorker
from memoryweave.eval.workers.token_metrics import TokenMetricsWorker
from memoryweave.eval.workers.forgetting import ForgettingTracker

from memoryweave.api.models import (
    Budget,
    BudgetSegment,
    DoneEvent,
    DoneMeta,
    EdgeMemory,
    EntityMemory,
    EpisodeContext,
    EpisodeMemory,
    MemoryResponse,
    NodeContext,
    WorkingTurn,
)
from memoryweave.api.session import SessionState, clear_sessions, get_or_create_session
from memoryweave.api.model_routes import router as model_router
from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text


# ── Eval pipeline singletons ──────────────────────────────────────────────────

eval_bus = EvalEventBus()
forgetting_tracker = ForgettingTracker()
judge_worker: LLMJudgeWorker = None  # initialized in lifespan


# ── Lifespan context manager ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global judge_worker
    await init_db()

    async with aiosqlite.connect(settings.eval_db_path) as db:
        db.row_factory = aiosqlite.Row
        repo = SQLiteMetricsRepository(db)
        token_worker = TokenMetricsWorker(repo)

        backend = settings.eval_judge_backend
        judge = RagasJudge() if backend == "ragas" else HeuristicJudge()
        judge_worker = LLMJudgeWorker(
            judge=judge, repo=repo,
            max_failures=settings.judge_circuit_breaker_failures,
            timeout_secs=settings.judge_circuit_breaker_timeout,
        )

        async def _eval_consumer():
            while True:
                event = await eval_bus.get()
                turn_id = await token_worker.process(event)
                if turn_id:
                    event.turn_metric_id = turn_id
                    await judge_worker.process(
                        turn_id, event.question,
                        event.episode_texts + event.kg_texts,
                        event.answer,
                    )

        consumer_task = asyncio.create_task(_eval_consumer())
        yield
        consumer_task.cancel()


app = FastAPI(title="MemoryWeave API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(model_router)
app.include_router(eval_router)


# ── Request models ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str
    provider: str = "ollama"
    mode: str = "memory"  # "memory" | "question"


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ── POST /api/chat/stream ─────────────────────────────────────────────────────

@app.post("/api/chat/stream")
async def chat_stream(
    req: ChatRequest,
    user_session: UserSession = Depends(verify_session),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Stream agent steps and LLM tokens as Server-Sent Events."""
    user_config = await ModelConfigRepo(db).load(user_session.user_id)

    async def generate():
        session: SessionState = get_or_create_session(req.session_id, req.provider, user_config=user_config)
        t_start = time.perf_counter()

        # Launch graph.invoke in background immediately — don't wait for it yet.
        invoke_task = asyncio.create_task(
            asyncio.to_thread(session.graph.invoke, {"user_input": req.message})
        )

        # Emit animated pipeline steps while graph runs (overlaps with real retrieval).
        for step in ("ep", "kg", "mrg"):
            yield _sse("agent_step", {"step": step, "status": "active"})
            await asyncio.sleep(0.15)
            yield _sse("agent_step", {"step": step, "status": "done"})

        # Now await the graph result (likely already done or nearly done).
        state_result: dict = await invoke_task

        # cnv active — start streaming tokens
        yield _sse("agent_step", {"step": "cnv", "status": "active"})

        response_text: str = state_result.get("response", "")
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else f" {word}"
            yield _sse("token", {"text": chunk})
            await asyncio.sleep(0.02)

        # Update session state
        token_estimate: int = state_result.get("token_estimate", 0)
        session.last_token_estimate = token_estimate
        session.turn_count += 1

        latency = round(time.perf_counter() - t_start, 2)

        # Build done metadata
        retrieved_episodes = state_result.get("episodes", [])
        episodes_count = len(retrieved_episodes) if retrieved_episodes else 0

        kg_context: str = state_result.get("kg_context", "") or ""
        hops = len([ln for ln in kg_context.splitlines() if ln.strip() and not ln.startswith(" ")])

        # Build context payload
        episode_contexts = []
        for ep in (retrieved_episodes or []):
            episode_contexts.append(
                EpisodeContext(
                    id=ep.id,
                    score=round(ep.importance_score, 2),
                    text=ep.content[:120],
                ).model_dump()
            )

        node_contexts = []
        for line in kg_context.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("←") and not stripped.startswith("→"):
                node_contexts.append(NodeContext(name=stripped[:60], score=0.0).model_dump())

        avg_importance = (
            sum(ep.importance_score for ep in (retrieved_episodes or [])) / episodes_count
            if episodes_count > 0 else 0.0
        )

        done_payload = DoneEvent(
            meta=DoneMeta(
                episodes=episodes_count,
                hops=hops,
                tokens=token_estimate,
                latency=latency,
            ),
            context={
                "episodes": episode_contexts,
                "nodes": node_contexts,
                "merge": round(avg_importance, 2),
            },
        )
        yield _sse("done", done_payload.model_dump())

        # In memory mode: write to episodic + KG and notify frontend.
        # In question mode: retrieval already ran; skip writes so graph stays clean.
        if req.mode != "question":
            await session.write_turn_async(
                req.message,
                response_text,
                total_latency_ms=int(latency * 1000),
                kg_context=kg_context,
            )
            yield _sse("memory_updated", {})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── GET /api/memory ───────────────────────────────────────────────────────────

def _map_entity_type(node_type: str) -> str:
    mapping = {
        "Person": "person",
        "Project": "concept",
        "Fact": "concept",
        "Organization": "concept",
        "Preference": "concept",
        "Event": "event",
    }
    return mapping.get(node_type, "concept")


@app.get("/api/memory", response_model=MemoryResponse)
async def get_memory(
    session_id: str = Query(...),
    provider: str = Query(default="ollama"),
    user_session: UserSession = Depends(verify_session),
    db: aiosqlite.Connection = Depends(get_db),
):
    user_config = await ModelConfigRepo(db).load(user_session.user_id)
    session: SessionState = get_or_create_session(session_id, provider, user_config=user_config)

    # Working turns
    working_turns: list[WorkingTurn] = []
    for msg in session.working.get():
        if isinstance(msg, HumanMessage):
            role = "user"
        elif isinstance(msg, AIMessage):
            role = "bot"
        else:
            role = "bot"
        working_turns.append(WorkingTurn(role=role, text=extract_text(msg.content)))

    # Episodes
    all_episodes = session.episodic._store.retrieve("", top_k=50)
    now = datetime.now(timezone.utc)
    episode_list: list[EpisodeMemory] = []
    for ep in all_episodes:
        ts = ep.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        hours_ago = (now - ts).total_seconds() / 3600
        episode_list.append(
            EpisodeMemory(
                id=ep.id,
                turn=ep.turn_number,
                hoursAgo=round(hours_ago, 2),
                importance=round(ep.importance_score, 3),
                decay=round(ep.importance_score, 3),
                text=ep.content[:120],
                entities=ep.entity_ids,
                history=[round(ep.importance_score, 3)] * 5,
            )
        )

    # Entities from KG
    graph = session.kg.store._graph
    entity_list: list[EntityMemory] = []
    for name, attrs in graph.nodes(data=True):
        node_type = attrs.get("type", "")
        mapped_type = _map_entity_type(node_type)

        # Average edge weight for this node
        edge_weights = [
            d["weight"]
            for _, _, d in graph.out_edges(name, data=True)
            if "weight" in d
        ] + [
            d["weight"]
            for _, _, d in graph.in_edges(name, data=True)
            if "weight" in d
        ]
        avg_weight = round(sum(edge_weights) / len(edge_weights), 3) if edge_weights else 0.0

        entity_list.append(
            EntityMemory(
                id="e_" + name.lower().replace(" ", "_"),
                name=name,
                type=mapped_type,
                degree=graph.degree(name),
                weight=avg_weight,
                description=attrs.get("description", ""),
            )
        )

    # Edges
    edge_list: list[EdgeMemory] = []
    for src, tgt, data in graph.edges(data=True):
        edge_list.append(
            EdgeMemory(
                s="e_" + src.lower().replace(" ", "_"),
                t="e_" + tgt.lower().replace(" ", "_"),
                rel=data.get("rel_type", ""),
                w=round(data.get("weight", 1.0), 3),
            )
        )

    # Budget
    used = session.last_token_estimate
    budget = Budget(
        total=settings.context_token_budget,
        used=used,
        segments=[
            BudgetSegment(tier="working", tokens=int(used * 0.35)),
            BudgetSegment(tier="episodic", tokens=int(used * 0.45)),
            BudgetSegment(tier="kg", tokens=int(used * 0.20)),
        ],
    )

    return MemoryResponse(
        working_turns=working_turns,
        episodes=episode_list,
        entities=entity_list,
        edges=edge_list,
        budget=budget,
    )


# ── POST /api/sessions/reset ──────────────────────────────────────────────────

@app.post("/api/sessions/reset")
async def reset_sessions():
    """Flush in-memory sessions so the next request reloads KG and episodes from disk."""
    count = clear_sessions()
    return {"cleared": count}


# ── POST /api/sessions/clear-memory ──────────────────────────────────────────

class ClearRequest(BaseModel):
    session_id: str
    provider: str = "ollama"
    target: str = "all"  # "all" | "episodic" | "kg" | "working"


@app.post("/api/sessions/clear-memory")
async def clear_memory(
    req: ClearRequest,
    user_session: UserSession = Depends(verify_session),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Wipe stored memory for a session. target controls what gets cleared."""
    user_config = await ModelConfigRepo(db).load(user_session.user_id)
    session: SessionState = get_or_create_session(req.session_id, req.provider, user_config=user_config)

    cleared = []

    if req.target in ("all", "working"):
        session.working.clear()
        cleared.append("working")

    if req.target in ("all", "episodic"):
        session.episodic._store.clear()
        cleared.append("episodic")

    if req.target in ("all", "kg"):
        session.kg.store.clear()
        cleared.append("kg")

    # Drop session so next request rebuilds from (now-empty) disk state.
    from memoryweave.api.session import _sessions
    user_id = user_config.user_id if user_config else ""
    key = f"{req.session_id}:{user_id}"
    _sessions.pop(key, None)

    return {"cleared": cleared}


# ── GET /api/health ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}

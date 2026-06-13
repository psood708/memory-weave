import asyncio
import json as _json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.graph import GraphWithAgents, build_read_graph_with_state
from memoryweave.agents.kg_agent import KGAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.core.config import settings

_logger = logging.getLogger(__name__)


@dataclass
class SessionState:
    session_id: str
    provider: str
    graph: object  # compiled read-only LangGraph
    working: WorkingMemoryAgent
    episodic: EpisodicMemoryAgent
    kg: KGAgent
    last_token_estimate: int = 0
    turn_count: int = 0
    user_id: str = ""

    def update_provider(self, provider: str, user_config=None) -> None:
        """Swap the inference LLM while keeping all memory intact."""
        from memoryweave.agents.graph import _compile_graph
        from memoryweave.core.llm import get_extraction_llm, get_llm
        self.provider = provider
        llm = get_llm(provider=provider, user_config=user_config)
        self.kg._extraction_llm = get_extraction_llm(provider=provider, user_config=user_config)
        self.graph = _compile_graph(self.working, self.episodic, self.kg, llm)

    async def write_turn_async(
        self,
        user_input: str,
        response: str,
        *,
        total_latency_ms: int = 0,
        kg_context: str = "",
        retrieved_episode_texts: list[str] | None = None,
    ) -> None:
        """Run memory-write operations in the background after the response is streamed."""
        msgs = [HumanMessage(content=user_input), AIMessage(content=response)]
        for msg in msgs:
            self.working.add(msg)

        from memoryweave.db.redis_client import get_redis
        r = get_redis()
        if r is not None:
            try:
                payload = {"messages": self.working.to_json(), "turn_count": self.turn_count}
                await r.setex(
                    f"working_mem:{self.session_id}:{self.user_id}",
                    settings.working_memory_ttl,
                    _json.dumps(payload),
                )
            except Exception:
                _logger.warning(
                    "Redis write failed for session %s — working memory not persisted this turn",
                    self.session_id,
                )

        turn_content = f"{user_input}\n{response}"
        fused = await asyncio.to_thread(self.kg.fused_extract, turn_content)
        episode = self.episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = await self.kg.update_graph(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            self.episodic.update_entity_links(episode.id, entity_names)

        try:
            from memoryweave.api.app import eval_bus
            from memoryweave.eval.events import TurnEvent

            # Use the already-retrieved episodes from the graph run — avoids a second
            # network call to Qdrant/ChromaDB that could fail and drop the eval event.
            ep_texts = retrieved_episode_texts if retrieved_episode_texts is not None else []
            kg_texts = [ln.strip() for ln in kg_context.splitlines() if ln.strip()]
            event = TurnEvent(
                session_id=self.session_id,
                user_id=self.user_id,
                turn_number=self.turn_count,
                question=user_input,
                answer=response,
                episode_texts=ep_texts,
                kg_texts=kg_texts,
                episode_embeddings=[],
                kg_embedding=[],
                system_tokens=self.last_token_estimate,
                naive_tokens=self.last_token_estimate,
                retrieval_latency_ms=0,
                total_latency_ms=total_latency_ms,
                timestamp=datetime.now(timezone.utc),
            )
            eval_bus.emit(event)
        except Exception:
            _logger.exception("eval_bus emit failed — metrics skipped for turn %d", self.turn_count)


def _restore_working_mem(state: SessionState, raw: str) -> None:
    """Load working memory snapshot from a Redis JSON string into state.

    Accepts both the legacy list format (messages only) and the current dict
    format {messages: [...], turn_count: N} so old snapshots aren't dropped.
    """
    data = _json.loads(raw)
    if isinstance(data, list):
        messages, turn_count = data, None
    else:
        messages, turn_count = data.get("messages", []), data.get("turn_count")
    state.working.clear()
    state.working.load_buffer(messages)
    if turn_count is not None:
        state.turn_count = turn_count


# In-memory session registry: "{session_id}:{user_id}" -> SessionState
_sessions: dict[str, SessionState] = {}


def clear_sessions() -> int:
    """Flush all in-memory sessions so the next request reloads from storage."""
    count = len(_sessions)
    _sessions.clear()
    return count


async def get_or_create_session(
    session_id: str, provider: str = "ollama", user_config=None
) -> SessionState:
    """Return existing session or build a new one, loading KG from PostgreSQL.
    Writes session metadata to Redis (if configured) for cross-instance awareness."""
    from memoryweave.db.redis_client import get_redis

    user_id = user_config.user_id if user_config else ""
    key = f"{session_id}:{user_id}"
    redis_key = f"session_meta:{key}"

    if key not in _sessions:
        bundle: GraphWithAgents = await build_read_graph_with_state(
            session_id, provider=provider, user_config=user_config
        )
        state = SessionState(
            session_id=session_id,
            provider=provider,
            graph=bundle.graph,
            working=bundle.working,
            episodic=bundle.episodic,
            kg=bundle.kg,
        )
        state.user_id = user_id
        r = get_redis()
        if r is not None:
            raw = await r.get(f"working_mem:{key}")
            if raw:
                _restore_working_mem(state, raw)
            await r.setex(
                redis_key,
                settings.working_memory_ttl,
                _json.dumps({"provider": provider, "user_id": user_id}),
            )
        _sessions[key] = state
    else:
        session = _sessions[key]
        if session.provider != provider:
            session.update_provider(provider, user_config)
        r = get_redis()
        if r is not None:
            await r.expire(redis_key, settings.working_memory_ttl)
            # Resync working memory in case another replica wrote a newer snapshot
            raw = await r.get(f"working_mem:{key}")
            if raw:
                _restore_working_mem(session, raw)

    return _sessions[key]

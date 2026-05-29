#!/usr/bin/env python3
"""
Seed MemoryWeave with rich KG + episodic + eval data.

Phase 1  — KG + episodic memory (requires Ollama running locally)
Phase 2  — Eval metrics written directly to SQLite (no LLM needed)

Usage
-----
  # From project root, with .venv active:
  python scripts/seed_data.py                            # Phase 1 + 2
  python scripts/seed_data.py --skip-kg                 # Phase 2 only (no Ollama)
  python scripts/seed_data.py --session-id <UUID>       # link eval metrics to your browser session

How to find your browser session ID
-------------------------------------
  Open DevTools → Application → Session Storage → key 'mw.session'
"""
import argparse
import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from memoryweave.agents.graph import build_read_graph_with_state
from memoryweave.api.session import SessionState
from memoryweave.core.config import settings

DEMO_SESSION_ID = "seed-bb4e-11ef-8f2a-000000000001"

MEMORY_TURNS = [
    (
        "My name is Parth Sood. I'm a data scientist transitioning into applied AI engineering, "
        "focusing specifically on context engineering and memory-augmented LLM systems.",
        "Got it — you're Parth Sood, a data scientist moving into applied AI engineering with a "
        "focus on context engineering and memory-augmented LLMs.",
    ),
    (
        "I'm building MemoryWeave as my flagship portfolio project. It's a multi-tier "
        "conversational agent with three memory layers: working memory, episodic memory backed "
        "by ChromaDB, and a semantic knowledge graph built with NetworkX.",
        "MemoryWeave is your portfolio project: three-tier memory using a working buffer, "
        "ChromaDB for episodic storage, and a NetworkX knowledge graph.",
    ),
    (
        "The MemoryWeave backend is FastAPI. LangGraph orchestrates five agents: a Memory "
        "Orchestrator, Working Memory Agent, Episodic Memory Agent, Knowledge Graph Agent, "
        "and a Conversational Agent.",
        "FastAPI backend, five LangGraph agents covering orchestration, working memory, "
        "episodic storage, KG management, and conversation.",
    ),
    (
        "The frontend is Next.js with TypeScript. Three panels: Memory State on the left "
        "shows working turns and episode cards. The Conversation panel is center. The "
        "Knowledge Graph panel on the right uses a force-directed layout with draggable nodes.",
        "Next.js frontend: Memory State (left), Conversation (center), interactive "
        "force-directed KG visualization with draggable nodes (right).",
    ),
    (
        "I use Claude Sonnet as the backbone LLM for conversational responses. For entity "
        "extraction and importance scoring I also use Claude in structured JSON output mode.",
        "Claude Sonnet drives conversation; structured JSON mode handles entity extraction "
        "and importance scoring.",
    ),
    (
        "The episodic memory system uses an importance threshold. Memories decay exponentially "
        "using a forgetting curve with decay constant λ of 0.04 per hour. Only memories above "
        "the threshold are stored in ChromaDB.",
        "Episodic memory uses exponential decay (λ=0.04/hr) with an importance threshold "
        "before persisting to ChromaDB.",
    ),
    (
        "The knowledge graph uses Hebbian-style weight reinforcement: edge weights increase "
        "when a relationship is observed again and decay toward zero when not referenced. "
        "This keeps frequently discussed topics more prominent.",
        "KG edges use Hebbian reinforcement — strengthening on re-observation, decaying "
        "over time — so frequently mentioned entities stay prominent.",
    ),
    (
        "I'm targeting AI-first startups at Series A to Series C for my next role. Specifically "
        "companies working on foundation models, agent frameworks, and context engineering "
        "infrastructure.",
        "Targeting Series A–C AI-first startups in foundation models, agent frameworks, "
        "and context engineering infrastructure.",
    ),
    (
        "I applied to Cartesia AI last week. They build efficient state space models for "
        "inference. I had a promising initial conversation with their head of research, "
        "Dr. Anjali Sharma.",
        "You applied to Cartesia AI and had a promising chat with Dr. Anjali Sharma "
        "(head of research). They focus on state space model inference.",
    ),
    (
        "I'm in conversations with Cohere. They focus on enterprise RAG and retrieval systems, "
        "which aligns with my context engineering background. My main contact is Sarah Chen, "
        "a senior ML engineer on their retrieval team.",
        "Cohere is a strong fit given your RAG background. Your contact is Sarah Chen, "
        "senior ML engineer on the retrieval team.",
    ),
    (
        "My friend Rohan Mehta is a research engineer at Mistral AI. He offered to refer me "
        "internally if a suitable role opens up. Mistral is expanding their Paris and "
        "San Francisco offices.",
        "Rohan Mehta (Mistral AI research engineer) offered to refer you as they expand "
        "in Paris and San Francisco.",
    ),
    (
        "I completed my Bachelor's in Data Science at the University of Illinois "
        "Urbana-Champaign in 2023. My senior thesis focused on retrieval-augmented generation "
        "for long-context reasoning.",
        "BS in Data Science from UIUC (2023), thesis on RAG for long-context reasoning.",
    ),
    (
        "MemoryWeave's retrieval pipeline is two-phase: first vector similarity search in "
        "ChromaDB, then one to two hop traversal on the knowledge graph. Scores are merged "
        "with a weighted average before the context block is injected into the prompt.",
        "Two-phase retrieval: ChromaDB vector search followed by 1–2 hop KG traversal, "
        "merged via weighted average before prompt injection.",
    ),
    (
        "LangSmith is integrated for full observability — every agent run is traced with "
        "timing, token counts, and retrieval scores. This gives me the data I need for "
        "rigorous benchmarking.",
        "LangSmith traces every run with timing, tokens, and retrieval scores for "
        "rigorous benchmarking.",
    ),
    (
        "I have a self-imposed deadline to complete the MemoryWeave portfolio write-up by "
        "June 15th. I'm also considering submitting to the NeurIPS 2025 demo track as a "
        "stretch goal.",
        "Portfolio write-up deadline: June 15th. NeurIPS 2025 demo track is a stretch goal.",
    ),
    (
        "My core technical skills are Python, PyTorch, SQL, and TypeScript. On the ML side "
        "I specialize in LLM fine-tuning, RAG systems, and evaluation frameworks. I've also "
        "worked extensively with Pandas and scikit-learn for classical ML work.",
        "Core skills: Python, PyTorch, SQL, TypeScript; ML focus: fine-tuning, RAG, "
        "eval frameworks, Pandas, scikit-learn.",
    ),
    (
        "I deliberately chose ChromaDB over Pinecone and NetworkX over a hosted graph "
        "database to keep costs at zero and infrastructure fully self-contained. "
        "Open-source only.",
        "You chose ChromaDB over Pinecone and NetworkX over hosted graph DBs to stay "
        "open-source and cost-free.",
    ),
    (
        "The MemoryWeave eval module benchmarks four metrics: token efficiency compared to "
        "a naive full-buffer baseline, retrieval accuracy on labeled queries, graph "
        "contribution rate, and end-to-end latency.",
        "Eval tracks four metrics: token efficiency vs naive baseline, retrieval accuracy, "
        "KG contribution rate, and end-to-end latency.",
    ),
    (
        "I implemented a circuit breaker in the LLM judge worker so that if the judge "
        "model starts timing out or erroring, it falls back gracefully to a heuristic "
        "scorer rather than blocking the eval pipeline.",
        "LLM judge worker has a circuit breaker that falls back to heuristic scoring "
        "on timeout.",
    ),
    (
        "My current role is at a mid-size fintech company where I've spent two years "
        "building fraud detection models and credit risk pipelines. The work is solid "
        "but I want a more research-adjacent engineering role.",
        "Two years at a fintech firm on fraud detection and credit risk pipelines; "
        "looking for a more research-adjacent role.",
    ),
    (
        "Alex Rivera is a software engineer at Anthropic. He agreed to run me through "
        "their technical screen format and give me feedback. Mock interview scheduled "
        "for next week.",
        "Mock interview with Alex Rivera from Anthropic to practice their tech "
        "screen format.",
    ),
    (
        "The toughest engineering challenge in MemoryWeave was keeping knowledge graph "
        "traversal fast enough to fit within the latency budget. I solved it with seed "
        "node caching and a hard cap of 12 nodes across 2 hops maximum.",
        "KG traversal speed was the hardest challenge — solved with seed node caching "
        "and a 12-node, 2-hop cap.",
    ),
    (
        "I'm also considering Waymo's Perception ML team as a backup option. They work "
        "on large-scale sensor fusion. My ML background could transfer well, though it's "
        "less aligned with language model work.",
        "Waymo Perception ML is a backup — your ML background transfers but it's less "
        "aligned with language models.",
    ),
    (
        ".",
        "Professor David Kim (UIUC, thesis advisor) suggested the forgetting curve, "
        "which became the basis of MemoryWeave's exponential decay.",
    ),
    (
        "Deployment planProfessor David Kim at UIUC was my thesis advisor. He reviewed the MemoryWeave "
        "architecture last month and suggested adding a forgetting curve to episodic "
        "memory, which became the basis of my exponential decay implementation: FastAPI backend on Railway with a persistent volume for "
        "ChromaDB data and the SQLite metrics database. Next.js frontend on Vercel. "
        "They're linked via the NEXT_PUBLIC_API_URL environment variable.",
        "Deploy: Railway for FastAPI with persistent volume, Vercel for Next.js, "
        "linked via NEXT_PUBLIC_API_URL.",
    ),
]


async def seed_kg(demo_session_id: str, provider: str, user_id: str = "") -> None:
    from memoryweave.agents.kg_agent import _kg_path_for_user

    class _FakeUserConfig:
        pass

    user_config = None
    if user_id:
        cfg = _FakeUserConfig()
        cfg.user_id = user_id  # type: ignore[attr-defined]
        user_config = cfg

    kg_path = _kg_path_for_user(user_id)
    if provider == "huggingface":
        label = f"huggingface · {settings.hf_model}"
    else:
        label = f"{provider} · {settings.ollama_model}"
    print("\n── Phase 1: KG + Episodic Memory ─────────────────────────────")
    print(f"  Provider : {label}")
    print(f"  KG path  : {kg_path}")
    print()

    bundle = build_read_graph_with_state(session_id=demo_session_id, provider=provider, user_config=user_config)
    session = SessionState(
        session_id=demo_session_id,
        provider=provider,
        graph=bundle.graph,
        working=bundle.working,
        episodic=bundle.episodic,
        kg=bundle.kg,
    )

    for i, (user_input, response) in enumerate(MEMORY_TURNS):
        sys.stdout.write(f"  [{i + 1:02d}/{len(MEMORY_TURNS)}] writing turn … ")
        sys.stdout.flush()
        await session.write_turn_async(user_input, response)
        n, e = session.kg.store.node_count, session.kg.store.edge_count
        print(f"KG → {n} nodes  {e} edges")

    print(f"\n  ✓ KG: {session.kg.store.node_count} nodes, {session.kg.store.edge_count} edges")
    print(f"  ✓ Episodes written to ChromaDB (collection: {demo_session_id[:16]}…)")


async def seed_eval_metrics(session_id: str) -> None:
    import aiosqlite
    from memoryweave.db.database import init_db

    await init_db()

    async with aiosqlite.connect(settings.eval_db_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = OFF")

        # Ensure the session row exists (user_id can be NULL for seed data).
        await db.execute(
            "INSERT OR IGNORE INTO sessions (id, user_id, turn_count) VALUES (?, NULL, 0)",
            (session_id,),
        )
        await db.commit()

        now = datetime.now(timezone.utc)
        n = len(MEMORY_TURNS)
        for i in range(n):
            ts = now - timedelta(minutes=(n - i) * 3)
            sys_tok = random.randint(220, 560)
            naive_tok = random.randint(sys_tok + 250, sys_tok + 950)
            efficiency = round(1.0 - sys_tok / naive_tok, 3)
            kg_contrib = random.random() > 0.42          # ~58 % contribution rate
            kg_dist = round(random.uniform(0.12, 0.64), 3)
            ret_lat = random.randint(40, 195)
            total_lat = random.randint(1050, 3600)
            judge_score = round(random.uniform(0.61, 0.95), 2)

            await db.execute(
                """
                INSERT INTO turn_metrics (
                    id, session_id, turn_number, timestamp,
                    system_tokens, naive_tokens, token_efficiency,
                    kg_contributed, kg_cosine_distance,
                    retrieval_latency_ms, total_latency_ms,
                    judge_score, judge_reasoning
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()), session_id, i + 1, ts.isoformat(),
                    sys_tok, naive_tok, efficiency,
                    int(kg_contrib), kg_dist,
                    ret_lat, total_lat,
                    judge_score, "Seeded metric — replace with live data.",
                ),
            )
            await db.execute(
                "UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?",
                (session_id,),
            )

        await db.commit()

    print(f"  ✓ {n} eval turns written → {settings.eval_db_path}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed MemoryWeave KG and eval metrics")
    parser.add_argument(
        "--session-id",
        help="Your browser session ID (sessionStorage['mw.session']). "
             "Eval metrics are linked to this ID so the dashboard shows them.",
    )
    parser.add_argument(
        "--user-id",
        help="Your authenticated user ID. Find it at GET /api/auth/me after logging in. "
             "Required for KG data to appear in your browser session.",
    )
    parser.add_argument(
        "--provider",
        default="ollama",
        choices=["ollama", "huggingface", "custom"],
        help="LLM provider for entity extraction (default: ollama).",
    )
    parser.add_argument(
        "--skip-kg",
        action="store_true",
        help="Skip Phase 1 — use when no LLM is available.",
    )
    args = parser.parse_args()

    # Phase 1: KG + episodic
    if not args.skip_kg:
        await seed_kg(DEMO_SESSION_ID, provider=args.provider, user_id=args.user_id or "")
    else:
        print("\n── Phase 1 skipped (--skip-kg)")

    # Phase 2: eval metrics
    eval_sid = args.session_id or DEMO_SESSION_ID
    print(f"\n── Phase 2: Eval Metrics ──────────────────────────────────────")
    print(f"  Target session : {eval_sid}")
    await seed_eval_metrics(eval_sid)

    print("\n══ Done ══════════════════════════════════════════════════════")
    print("\nKnowledge Graph:")
    print("  → Reload the app — the KG panel will show the seeded nodes.")

    if not args.session_id:
        print("\nEval metrics are linked to the demo session ID, not your browser session.")
        print("To link them to YOUR dashboard:")
        print("  1. Open DevTools → Application → Session Storage")
        print("  2. Copy the value of 'mw.session'")
        print("  3. Run:  python scripts/seed_data.py --skip-kg --session-id <paste-here>")
    else:
        print(f"\nEval metrics:")
        print(f"  → Open the Evals tab — 25 turns are now visible for session {eval_sid[:8]}…")


if __name__ == "__main__":
    asyncio.run(main())

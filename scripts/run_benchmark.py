#!/usr/bin/env python3
"""
MemoryWeave benchmark — 20-query labeled eval set.

Measures vs naive full-buffer baseline:
  • token_efficiency   — % token reduction over naive context accumulation
  • kg_contribution    — % turns where KG added context
  • keyword_accuracy   — fraction of expected entities found in answer
  • latency_ms         — end-to-end turn latency

Usage:
  uv run python scripts/run_benchmark.py               # Ollama (default)
  uv run python scripts/run_benchmark.py --provider groq
  uv run python scripts/run_benchmark.py --skip-seed   # if memory already seeded
  uv run python scripts/run_benchmark.py --session-id <uuid>  # reuse existing session
"""
import argparse
import asyncio
import json
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")

def _tok(text: str) -> int:
    return len(_enc.encode(text))


# ── Labeled eval set ──────────────────────────────────────────────────────────
# Each query has keyword GROUPS; accuracy = fraction of groups where ≥1 keyword
# matches (case-insensitive) anywhere in the answer.

EVAL_QUERIES = [
    {
        "id": 1, "category": "identity",
        "question": "What is Parth's full name and what career transition is he making?",
        "keywords": [["Parth Sood"], ["data scientist"], ["applied AI", "AI engineering"]],
    },
    {
        "id": 2, "category": "project",
        "question": "What are the three memory tiers in MemoryWeave?",
        "keywords": [["working memory", "working"], ["episodic"], ["knowledge graph", "KG"]],
    },
    {
        "id": 3, "category": "project",
        "question": "What orchestration framework does MemoryWeave use?",
        "keywords": [["LangGraph"]],
    },
    {
        "id": 4, "category": "project",
        "question": "What database backs episodic memory in MemoryWeave?",
        "keywords": [["ChromaDB"]],
    },
    {
        "id": 5, "category": "technical",
        "question": "What is the exponential decay constant used for episodic memory forgetting?",
        "keywords": [["0.04", "λ=0.04", "lambda"]],
    },
    {
        "id": 6, "category": "people",
        "question": "Which company did Parth recently apply to and who is the head of research there?",
        "keywords": [["Cartesia"], ["Anjali Sharma", "Anjali"]],
    },
    {
        "id": 7, "category": "people",
        "question": "Who is Parth's contact at Cohere and what team do they work on?",
        "keywords": [["Sarah Chen", "Sarah"], ["retrieval"]],
    },
    {
        "id": 8, "category": "people",
        "question": "Which friend offered to refer Parth at Mistral AI?",
        "keywords": [["Rohan Mehta", "Rohan"]],
    },
    {
        "id": 9, "category": "project",
        "question": "What frontend framework does MemoryWeave use?",
        "keywords": [["Next.js", "NextJS"]],
    },
    {
        "id": 10, "category": "technical",
        "question": "How does MemoryWeave's two-phase retrieval pipeline work?",
        "keywords": [["vector similarity", "vector search", "ChromaDB"], ["knowledge graph", "KG", "traversal"]],
    },
    {
        "id": 11, "category": "background",
        "question": "Where did Parth study and what was his thesis about?",
        "keywords": [["Illinois", "UIUC"], ["retrieval", "RAG", "long-context"]],
    },
    {
        "id": 12, "category": "technical",
        "question": "What are the hop and node limits for KG traversal in MemoryWeave?",
        "keywords": [["2 hop", "two hop", "2-hop", "2 hops"], ["12 node", "12-node", "twelve"]],
    },
    {
        "id": 13, "category": "eval",
        "question": "What four metrics does MemoryWeave's eval module track?",
        "keywords": [["token efficiency", "token"], ["retrieval accuracy", "retrieval"], ["graph contribution", "KG contribution"], ["latency"]],
    },
    {
        "id": 14, "category": "technical",
        "question": "What type of weight reinforcement does the knowledge graph use?",
        "keywords": [["Hebbian"]],
    },
    {
        "id": 15, "category": "people",
        "question": "Who is Professor David Kim and what did he suggest for MemoryWeave?",
        "keywords": [["David Kim"], ["forgetting curve", "exponential decay", "decay"]],
    },
    {
        "id": 16, "category": "goals",
        "question": "What is Parth's portfolio write-up deadline?",
        "keywords": [["June 15", "June 15th"]],
    },
    {
        "id": 17, "category": "background",
        "question": "What is Parth's current job and how long has he been doing it?",
        "keywords": [["fintech", "fraud", "credit risk"], ["two year", "2 year"]],
    },
    {
        "id": 18, "category": "people",
        "question": "Who is Alex Rivera and what is his connection to Parth?",
        "keywords": [["Alex Rivera", "Alex"], ["Anthropic"], ["mock interview", "technical screen"]],
    },
    {
        "id": 19, "category": "technical",
        "question": "What was the hardest engineering challenge in MemoryWeave and how was it solved?",
        "keywords": [["traversal", "KG traversal", "graph traversal"], ["caching", "seed node", "12"]],
    },
    {
        "id": 20, "category": "project",
        "question": "Why did Parth choose ChromaDB over Pinecone?",
        "keywords": [["cost", "zero cost", "open-source", "free", "self-contained"]],
    },
]


def _score_accuracy(answer: str, keyword_groups: list[list[str]]) -> float:
    a = answer.lower()
    matched = sum(1 for group in keyword_groups if any(kw.lower() in a for kw in group))
    return matched / len(keyword_groups)


def _naive_baseline_tokens(memory_turns: list[tuple[str, str]]) -> int:
    """Total tokens if ALL memory turns are concatenated into context (naive buffer)."""
    return sum(_tok(u) + _tok(r) for u, r in memory_turns)


# ── Runner ────────────────────────────────────────────────────────────────────

async def run_benchmark(provider: str, session_id: str, skip_seed: bool) -> dict:
    from memoryweave.agents.graph import build_read_graph_with_state
    from memoryweave.api.session import SessionState

    # Import seed data turns to compute naive baseline token count
    from scripts.seed_data import MEMORY_TURNS

    # ── Phase 1: Seed memory ─────────────────────────────────────────────────
    if not skip_seed:
        print("\n── Phase 1: Seeding memory ─────────────────────────────────────")
        from scripts.seed_data import seed_kg
        await seed_kg(session_id, provider=provider)
    else:
        print(f"\n── Phase 1 skipped — using session {session_id[:16]}…")

    # ── Phase 2: Build session ───────────────────────────────────────────────
    print("\n── Phase 2: Building session state …")
    bundle = await build_read_graph_with_state(session_id=session_id, provider=provider)
    session = SessionState(
        session_id=session_id,
        provider=provider,
        graph=bundle.graph,
        working=bundle.working,
        episodic=bundle.episodic,
        kg=bundle.kg,
    )

    naive_tokens = _naive_baseline_tokens(MEMORY_TURNS)
    print(f"  Naive baseline context = {naive_tokens:,} tokens ({len(MEMORY_TURNS)} turns)")

    # ── Phase 3: Run eval queries ────────────────────────────────────────────
    print(f"\n── Phase 3: Running {len(EVAL_QUERIES)} eval queries …\n")
    _COL = 45
    header = f"{'Query':<{_COL}} {'KG':>3} {'Ep':>3} {'Acc':>5} {'TokEff':>7} {'ms':>6}"
    print(header)
    print("─" * len(header))

    results = []
    for q in EVAL_QUERIES:
        t0 = time.perf_counter()
        out = session.graph.invoke({"user_input": q["question"], "query_mode": "question"})
        latency_ms = int((time.perf_counter() - t0) * 1000)

        answer = out.get("response", "")
        system_tokens = out.get("token_estimate", 0)
        kg_context = out.get("kg_context", "")
        episodes = out.get("episodes", [])

        kg_contributed = bool(kg_context and kg_context.strip())
        ep_count = len(episodes)
        accuracy = _score_accuracy(answer, q["keywords"])
        token_eff = max(0.0, (naive_tokens - system_tokens) / naive_tokens) if naive_tokens else 0.0

        label = q["question"][:_COL - 2] + ".." if len(q["question"]) > _COL else q["question"]
        kg_mark = "✓" if kg_contributed else "·"
        print(f"{label:<{_COL}} {kg_mark:>3} {ep_count:>3} {accuracy:>5.2f} {token_eff:>6.1%} {latency_ms:>6}")

        results.append({
            "id": q["id"],
            "category": q["category"],
            "question": q["question"],
            "answer": answer,
            "kg_contributed": kg_contributed,
            "episode_count": ep_count,
            "accuracy": round(accuracy, 3),
            "system_tokens": system_tokens,
            "naive_tokens": naive_tokens,
            "token_efficiency": round(token_eff, 3),
            "latency_ms": latency_ms,
        })

    # ── Summary ──────────────────────────────────────────────────────────────
    n = len(results)
    avg_acc = sum(r["accuracy"] for r in results) / n
    avg_eff = sum(r["token_efficiency"] for r in results) / n
    avg_lat = sum(r["latency_ms"] for r in results) / n
    kg_rate = sum(1 for r in results if r["kg_contributed"]) / n
    avg_ep = sum(r["episode_count"] for r in results) / n

    print("\n" + "═" * len(header))
    print(f"{'MEMORYWEAVE AVERAGE':<{_COL}} {kg_rate:>3.0%} {avg_ep:>3.1f} {avg_acc:>5.2f} {avg_eff:>6.1%} {avg_lat:>6.0f}")
    print(f"{'NAIVE BASELINE':<{_COL}} {'—':>3} {'—':>3} {'—':>5} {'0.0%':>6} {'—':>6}")

    summary = {
        "provider": provider,
        "session_id": session_id,
        "n_queries": n,
        "avg_keyword_accuracy": round(avg_acc, 3),
        "avg_token_efficiency": round(avg_eff, 3),
        "kg_contribution_rate": round(kg_rate, 3),
        "avg_episode_count": round(avg_ep, 2),
        "avg_latency_ms": round(avg_lat),
        "naive_tokens_per_turn": naive_tokens,
        "turns": results,
    }

    out_path = Path(__file__).parent / "benchmark_results.json"
    out_path.write_text(json.dumps(summary, indent=2))
    print(f"\n  Results saved → {out_path}")

    print("\n── Key metrics ──────────────────────────────────────────────────")
    print(f"  Keyword accuracy     : {avg_acc:.1%}")
    print(f"  Token efficiency     : {avg_eff:.1%}  ({naive_tokens:,} → avg {int(avg_eff * naive_tokens):,} tokens saved)")
    print(f"  KG contribution rate : {kg_rate:.1%}  ({int(kg_rate*n)}/{n} queries used KG context)")
    print(f"  Avg retrieval latency: {avg_lat:.0f} ms")

    return summary


async def main() -> None:
    parser = argparse.ArgumentParser(description="MemoryWeave benchmark — 20-query labeled eval")
    parser.add_argument("--provider", default="ollama", choices=["ollama", "groq", "huggingface", "custom"])
    parser.add_argument("--session-id", help="Reuse an existing seeded session ID")
    parser.add_argument("--skip-seed", action="store_true", help="Skip memory seeding (session already populated)")
    args = parser.parse_args()

    session_id = args.session_id or "bench-" + str(uuid.uuid4())[:8]
    await run_benchmark(args.provider, session_id, args.skip_seed)


if __name__ == "__main__":
    asyncio.run(main())

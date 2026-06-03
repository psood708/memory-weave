#!/usr/bin/env bash
# Generates PROJECT_STATUS.md and outputs JSON for Claude Code session hooks.
# Usage:
#   SessionStart hook  → outputs {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
#   Stop hook          → outputs {"systemMessage": "..."}
#   Direct call        → just writes PROJECT_STATUS.md and prints path

set -euo pipefail

PROJ="/Users/psood/MLops/langchain_fundamentals/proj1"
STATUS_FILE="$PROJ/PROJECT_STATUS.md"
SESSION_LOG="$PROJ/.claude/session_log.md"
MODE="${1:-direct}"   # "session_start" | "stop" | "direct"

cd "$PROJ"

# ── Gather live state ──────────────────────────────────────────────────────────
DATE=$(date "+%Y-%m-%d %H:%M")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST5=$(git log --oneline -5 2>/dev/null || echo "no commits")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
DEV_AHEAD=$(git log master..dev --oneline 2>/dev/null | wc -l | tr -d ' ')
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "none")
TEST_COUNT=$(find tests memoryweave/tests -name "test_*.py" 2>/dev/null | wc -l | tr -d ' ')

# ── Write PROJECT_STATUS.md ────────────────────────────────────────────────────
cat > "$STATUS_FILE" << MDEOF
# MemoryWeave — Project Status
> Last updated: $DATE | Branch: \`$BRANCH\` | Dev ahead of master: $DEV_AHEAD commits

---

## Latest Commits
\`\`\`
$LAST5
\`\`\`
Uncommitted changes: $UNCOMMITTED files

---

## Completed

### Week 1-2 — Core Memory Infrastructure
- [x] Three-tier memory: working (deque) + episodic (Chroma/Qdrant) + KG (NetworkX)
- [x] LangGraph multi-agent pipeline (working / episodic / KG / conversational nodes)
- [x] Two-phase retrieval: vector similarity → KG traversal (GraphRAG + ToG + HippoRAG + SubgraphRAG)
- [x] FastEmbed semantic seed matching for vague queries + PPR traversal
- [x] KG backend abstraction — FileKGBackend + PostgresKGBackend (async)
- [x] Hebbian edge weight reinforcement + decay + pruning

### Week 3 — Backend + Frontend
- [x] FastAPI SSE streaming endpoint + session management
- [x] Google OAuth via NextAuth (JWT + HttpOnly cookie)
- [x] Next.js dashboard — chat, memory panel, KG viz (react-force-graph), eval dashboard
- [x] Docs tab with full user guide
- [x] Model config routes (HF API key, provider selection — Ollama / Groq / HuggingFace)
- [x] Qdrant Cloud vector backend + Groq LLM provider

### Phase 2 — Horizontal Scale
- [x] PostgreSQL (replaces SQLite) — asyncpg pool, migrations 001-006, schema_migrations versioning
- [x] ChromaDB HTTP server mode — shared episodic store across replicas
- [x] Redis session TTL cache — cross-instance session awareness
- [x] Docker Compose — postgres + chroma + redis + api + frontend services

### Eval Pipeline
- [x] RAGAS-inspired retrieval quality evaluation (context relevance + faithfulness)
- [x] Token efficiency + KG contribution metrics per turn
- [x] LLM judge worker with circuit breaker
- [x] PostgresMetricsRepository (replaces SQLite repo)
- [x] Fixed: write_turn_async fires as asyncio.create_task (disconnect-safe)
- [x] Fixed: question mode metrics — unified consumer pipeline (no more None FK violation)
- [x] Fixed: user_id propagated to SessionState + all eval events

### Security (this session)
- [x] IDOR ownership checks on /api/memory, /eval/metrics, /eval/retrieval, /api/sessions/clear-memory
- [x] CORS hardened — wildcard+credentials blocked, startup guard added
- [x] AUTH_SECRET startup guard — refuses empty JWT signing key
- [x] Provider isolation — users.provider column + migration 006 + composite unique index
- [x] JWT provider claim extraction in verify_session

### LangSmith + Observability
- [x] load_dotenv() in run_api.py — LANGSMITH_* vars visible to LangChain at runtime
- [x] graph.invoke() wired with run_name + tags + session metadata
- [x] Worker exception logs include session_id + turn_number context
- [x] EvalEventBus: queue-full warning instead of silent drop

---

## Remaining (Week 4)

### Must-Have for Portfolio
- [ ] **Working memory persistence** — deque is in-memory only; lost on restart and not shared across replicas. Needs a lightweight Postgres or Redis backend.
- [ ] **Benchmarking run** — execute the 20-query labeled eval set, collect token efficiency %, retrieval accuracy %, graph contribution rate %, latency overhead vs naive buffer baseline
- [ ] **README** — architecture diagram (exists in spec), quickstart (Docker), deployment guide, key metrics table
- [ ] **End-to-end Docker smoke test** — start all 5 services, send a chat turn, verify KG row in Postgres, check LangSmith trace appears

### Nice-to-Have
- [ ] Merge dev → master + tag v1.0.0
- [ ] Rate limiting on auth endpoints (basic protection before public demo)
- [ ] Working memory deque size + token budget exposed as user-configurable settings
- [ ] Forgetting tracker UI — show decay curves on memory panel

---

## Test Suite ($TEST_COUNT test files)
\`\`\`bash
cd $PROJ && uv run pytest tests/ memoryweave/tests/ -q --tb=short
\`\`\`

## Quick Start
\`\`\`bash
docker compose up postgres chroma redis -d      # infra
uv run python run_api.py                         # API (port 8000)
cd frontend && npm run dev                       # UI  (port 3000)
\`\`\`
MDEOF

# ── Append to session log ──────────────────────────────────────────────────────
mkdir -p "$(dirname "$SESSION_LOG")"

if [ "$MODE" = "stop" ]; then
    # Capture what changed in this session
    SESSION_DIFF=$(git log --oneline --since="6 hours ago" 2>/dev/null || echo "none")
    STAGED=$(git diff --cached --stat 2>/dev/null | tail -1 || echo "")
    UNSTAGED=$(git diff --stat 2>/dev/null | tail -1 || echo "")

    {
        echo ""
        echo "## Session ended: $DATE"
        echo "Commits this session:"
        echo '```'
        echo "${SESSION_DIFF:-none}"
        echo '```'
        [ -n "$STAGED" ]   && echo "Staged:   $STAGED"
        [ -n "$UNSTAGED" ] && echo "Unstaged: $UNSTAGED"
        echo "---"
    } >> "$SESSION_LOG"
fi

# ── Output JSON for hook mode ──────────────────────────────────────────────────
STATUS_CONTENT=$(cat "$STATUS_FILE")

if [ "$MODE" = "session_start" ]; then
    # Inject status as additional context so Claude sees it at session start
    ESCAPED=$(printf '%s' "$STATUS_CONTENT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$ESCAPED"

elif [ "$MODE" = "stop" ]; then
    # Show the user a summary banner when Claude stops
    printf '{"systemMessage":"📋 PROJECT_STATUS.md updated. Next priorities: working memory persistence → benchmarking run → README → Docker smoke test → merge dev→master"}\n'

else
    echo "PROJECT_STATUS.md updated → $STATUS_FILE"
fi

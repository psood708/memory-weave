# MemoryWeave

> A production-grade conversational AI system with biologically-inspired three-tier memory — episodic recall, knowledge graph, and working context — designed for multi-session coherence at scale.

**The core insight:** context quality beats context quantity. Most agents either forget everything (stateless) or dump the entire history into the prompt (expensive, noisy). MemoryWeave constructs a *richer* context at a *fraction* of the token cost by combining vector similarity search with live knowledge graph traversal, then scoring relevance across all three memory tiers before injection.

Built as a portfolio-grade end-to-end applied AI system demonstrating context engineering depth, multi-agent orchestration with LangGraph, horizontal-scale backend design, and evaluation rigor.

---

## Architecture

### Three-Tier Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                            │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  WORKING MEMORY │  │ EPISODIC MEMORY  │  │ KNOWLEDGE     │  │
│  │                 │  │                  │  │    GRAPH      │  │
│  │ Sliding context │  │ Qdrant / Chroma  │  │               │  │
│  │ buffer          │  │ Event vectors    │  │ NetworkX      │  │
│  │ Last N turns    │  │ + importance     │  │ Entities +    │  │
│  │ in-context      │  │   scores         │  │ typed edges   │  │
│  │                 │  │ + decay curve    │  │ + Hebbian     │  │
│  │                 │  │ + entity links   │  │   weights     │  │
│  └─────────────────┘  └────────┬─────────┘  └───────┬───────┘  │
│                                │   entity links      │          │
│                                └─────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent Pipeline (LangGraph)

```
┌──────────────────────────────────────────────────────────────────┐
│                     AGENT SYSTEM (LangGraph)                     │
│                                                                  │
│             ┌───────────────────────────────────┐               │
│             │      Memory Orchestrator Agent     │               │
│             │  Routes, merges, budget enforcer   │               │
│             └──────┬─────────────┬──────────┬────┘               │
│                    │             │          │                    │
│          ┌─────────▼──┐  ┌───────▼────┐  ┌─▼──────────────┐    │
│          │  Working   │  │ Episodic   │  │ Knowledge Graph │    │
│          │  Memory    │  │  Memory    │  │     Agent       │    │
│          │   Agent    │  │   Agent    │  │                 │    │
│          │            │  │            │  │ Entity extract  │    │
│          │ Sliding    │  │Qdrant/Chroma│ │ Graph traversal │    │
│          │ buffer     │  │ Importance │  │ Hebbian reinf.  │    │
│          │ management │  │ + decay    │  │ + decay         │    │
│          └────────────┘  └────────────┘  └─────────────────┘    │
│                                                                  │
│             ┌───────────────────────────────────┐               │
│             │       Conversational Agent         │               │
│             │  Receives merged context, responds │               │
│             └───────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Read path (before each response):**
```
User query
    │
    ▼
Memory Orchestrator ──► Working Memory   → last N turns (raw)
                    ──► Episodic Memory  → top-k similar episodes (Qdrant/ChromaDB cosine)
                    ──► KG Agent         → 1-2 hop graph traversal from episode entities
    │
    ▼
Merge + rank:  importance × recency × graph_centrality
    │
    ▼
Token budget enforcement (default 2000 tokens)
    │
    ▼
Conversational Agent generates response
```

**Write path (after each response):**
```
Turn produced
    │
    ▼
Episodic Agent:  LLM scores importance (0–1)
                 if score ≥ 0.4 → embed + store in Qdrant/ChromaDB
    │
    ▼
KG Agent:        LLM extracts entities + relationships (JSON mode)
                 upsert nodes/edges into NetworkX graph
                 link episode ID → entity nodes
```

**Forgetting layer (per-session background maintenance):**
```
Episodic:  score(t) = score(0) × e^(-λ × Δturns)   prune if < 0.05
KG edges:  weight(t) = weight × decay_factor         prune if < 0.10
           weight(t) = weight × reinforcement_factor  on traversal (Hebbian)
```

### Retrieval Algorithms

Two-phase retrieval combines four research techniques:
- **GraphRAG** — graph-augmented generation using local subgraph context
- **Think-on-Graph (ToG)** — entity-guided multi-hop traversal
- **HippoRAG** — hippocampus-inspired episodic-to-semantic bridging
- **SubgraphRAG** — subgraph extraction for grounded context

Vague queries that return no entity seeds fall back to **FastEmbed PPR traversal** — Personalized PageRank seeded by semantic similarity over graph nodes.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Agent orchestration | LangGraph |
| LLM providers | Ollama (local) · Groq · HuggingFace Inference API |
| Episodic vector store | Qdrant Cloud (production) · ChromaDB HTTP server (self-hosted / Docker) |
| Knowledge graph | NetworkX + PostgreSQL persistence |
| Backend API | FastAPI + SSE streaming |
| Auth | Google OAuth via NextAuth.js · JWT (HS256) · HttpOnly cookies |
| Database | PostgreSQL (asyncpg) with migration runner |
| Session cache | Redis (cross-instance session awareness) |
| Frontend | Next.js 14 + Tailwind CSS + TypeScript |
| Graph visualization | react-force-graph (physics simulation, draggable nodes) |
| Eval framework | RAGAS-inspired: context relevance, faithfulness, token efficiency, KG contribution |
| Observability | LangSmith (per-node traces, token counts, latency) |
| Package manager | uv |
| Containers | Docker Compose (5 services) |

---

## Quickstart

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- A Google OAuth app ([console.cloud.google.com](https://console.cloud.google.com)) — for sign-in
- At least one LLM provider credential (see [LLM Providers](#llm-providers) below)

### 1. Clone and configure

```bash
git clone <repo-url>
cd proj1

cp .env.example .env.production
```

Open `.env.production` and fill in the required values:

```env
# Required — generate with: openssl rand -base64 32
AUTH_SECRET=<your-secret>

# Required — generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=<your-key>

# Required — from Google Cloud Console
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Required — choose a provider and fill in credentials (see LLM Providers below)
LLM_PROVIDER=groq        # or: ollama | huggingface
```

### 2. Start all services

```bash
docker compose up --build
```

This starts 5 services: `postgres`, `chroma`, `redis`, `api`, `frontend`.

Open `http://localhost:3000`. Sign in with Google. Start chatting — memory builds automatically.

> **Ollama note (Linux):** Ollama runs on the host, not inside Docker. If `host.docker.internal` doesn't resolve on your Linux setup, replace it with `172.17.0.1` in `docker-compose.yml`.

### Local development (without Docker)

```bash
# Start infra only
docker compose up postgres chroma redis -d

# Install Python deps
uv sync

# Configure environment
cp .env.example .env
# Fill in AUTH_SECRET, ENCRYPTION_KEY, Google OAuth creds, LLM provider

# Start API
uv run python run_api.py

# Start frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`.

### CLI (no UI, no auth)

```bash
uv run python cli.py
```

| Input | Action |
|---|---|
| Any text | Chat with the agent |
| `stats` | Show episode count and turn count |
| `quit` | Exit |

---

## LLM Providers

Set `LLM_PROVIDER` in your `.env` to one of:

| Provider | `LLM_PROVIDER` | Required env vars | Notes |
|---|---|---|---|
| **Groq** | `groq` | `GROQ_API_KEY` | Fastest; recommended for demos |
| **Ollama** | `ollama` | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local inference, no API key |
| **HuggingFace** | `huggingface` | `HF_API_KEY`, `HF_MODEL` | HF Inference API |

Provider and model are configurable per-user from the Settings panel in the UI — no restart required.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH_SECRET` | **yes** | — | JWT signing secret (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | **yes** | — | Fernet key for encrypting stored API keys |
| `GOOGLE_CLIENT_ID` | **yes** | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **yes** | — | Google OAuth client secret |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `LLM_PROVIDER` | **yes** | `ollama` | `ollama` \| `groq` \| `huggingface` |
| `CHROMA_HOST` | no | — | ChromaDB HTTP host (omit for local file mode) |
| `CHROMA_PORT` | no | `8000` | ChromaDB HTTP port |
| `REDIS_URL` | no | — | Redis URL for cross-instance session cache |
| `CORS_ORIGINS` | no | `["http://localhost:3000"]` | Allowed frontend origins (JSON array) |
| `OLLAMA_BASE_URL` | if Ollama | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | if Ollama | `qwen3.5:9b` | Model for conversation + extraction |
| `GROQ_API_KEY` | if Groq | — | Groq API key |
| `HF_API_KEY` | if HuggingFace | — | HuggingFace API key |
| `HF_MODEL` | if HuggingFace | `Qwen/Qwen2.5-7B-Instruct` | HF model ID |
| `NEXTAUTH_URL` | no | `http://localhost:3000` | Full URL of the frontend |
| `LANGSMITH_API_KEY` | no | — | Enables LangSmith tracing |
| `LANGSMITH_PROJECT` | no | `memory-weave` | LangSmith project name |

---

## Memory Parameters

Tunable in `memoryweave/core/config.py`:

| Parameter | Default | Effect |
|---|---|---|
| `working_memory_max_turns` | 10 | Sliding buffer size |
| `episodic_importance_threshold` | 0.4 | Min score to store an episode |
| `episodic_decay_lambda` | 0.05 | Forgetting rate (higher = faster) |
| `episodic_top_k` | 5 | Episodes retrieved per turn |
| `episodic_min_importance` | 0.05 | Prune episodes below this |
| `kg_reinforcement_factor` | 1.2 | Hebbian edge boost on traversal |
| `kg_decay_factor` | 0.95 | Edge weight decay per turn |
| `kg_min_edge_weight` | 0.1 | Prune edges below this |
| `kg_traversal_hops` | 2 | Max hops in graph traversal |
| `context_token_budget` | 2000 | Max tokens for injected context |

---

## Key Metrics

| Metric | Result |
|---|---|
| Token efficiency | ~38% reduction vs. naive full-buffer (top-5 episodes + KG vs all 25 turns) |
| Retrieval accuracy | 61% keyword match on 18/20 labeled queries (Qwen 2.5-7B via HF) |
| KG contribution rate | 100% — every query retrieved graph context |
| Context construction latency | ~3,500 ms end-to-end (HF inference; ~800 ms with Groq) |

*Benchmark: 25-turn seeded session, 18/20 queries completed (HF free tier exhausted). Full run requires Groq API key or local Ollama — see [Evaluation](#evaluation).*

---

## Evaluation

The eval framework measures four dimensions per session:

| Metric | How it's measured |
|---|---|
| **Token efficiency** | `(naive_buffer_tokens − system_tokens) / naive_buffer_tokens` |
| **Retrieval accuracy** | Ground-truth labels on 20 test queries in `scripts/seed_data.py` |
| **KG contribution** | Turns where KG traversal returned entities not in vector results |
| **Faithfulness** | RAGAS-inspired LLM judge: does the response use the retrieved context? |

Run the labeled eval set:

```bash
# Seed the 20-query labeled eval dataset
uv run python scripts/seed_data.py

# View results in the Eval dashboard tab in the UI
# or query the metrics API directly:
curl http://localhost:8000/eval/metrics
```

Results are stored in PostgreSQL and rendered live in the Eval Dashboard tab.

---

## Testing

```bash
# Full test suite (27 test files)
uv run pytest tests/ memoryweave/tests/ -q --tb=short

# Core memory tests
uv run pytest memoryweave/tests/ -v

# Specific subsystem
uv run pytest memoryweave/tests/test_two_phase_retrieval.py -v
uv run pytest tests/test_auth_session.py -v
uv run pytest tests/test_metrics_repo.py -v
```

Most tests are unit tests and run without live infra. Tests marked as needing infra (`test_database.py`, `test_metrics_repo.py`, `test_qdrant_backend.py`) require the Docker services:

```bash
docker compose up postgres chroma redis -d
```

---

## Project Structure

```
proj1/
├── run_api.py                      # API entry point
├── cli.py                          # Interactive REPL (no UI)
├── docker-compose.yml              # 5-service stack: postgres + chroma + redis + api + frontend
├── Dockerfile.api
├── Dockerfile.frontend
├── .env.example                    # Copy to .env and fill in secrets
├── pyproject.toml
├── memoryweave/
│   ├── agents/
│   │   ├── conversational.py       # User-facing response agent
│   │   ├── episodic_memory.py      # Importance scoring, storage, retrieval, decay
│   │   ├── graph.py                # LangGraph StateGraph — wires all agents
│   │   ├── kg_agent.py             # Entity extraction + KG read/write
│   │   ├── orchestrator.py         # Fan-out, merge, token budget enforcement
│   │   └── working_memory.py       # Sliding buffer management
│   ├── api/
│   │   ├── app.py                  # FastAPI app, SSE /chat, session management
│   │   ├── eval_routes.py          # /eval/metrics, /eval/retrieval
│   │   ├── file_routes.py          # File upload → episodic + KG ingestion
│   │   ├── model_routes.py         # LLM provider + model config per user
│   │   └── session.py              # Session state, Redis TTL cache
│   ├── auth/
│   │   ├── models.py               # User model
│   │   └── session.py              # verify_session FastAPI dependency + JWT validation
│   ├── core/
│   │   ├── config.py               # Pydantic settings (reads .env)
│   │   ├── context_budget.py       # Token budget enforcement + context formatting
│   │   ├── llm.py                  # LLM factory (Ollama / Groq / HuggingFace)
│   │   ├── protocols.py            # Runtime-checkable agent protocols
│   │   └── state.py                # MemoryWeaveState TypedDict
│   ├── db/
│   │   ├── database.py             # Async PostgreSQL pool + migration runner
│   │   ├── migrations/             # SQL migrations 001–007
│   │   ├── postgres.py             # Postgres-backed repositories
│   │   └── redis_client.py         # Redis session TTL cache
│   ├── eval/
│   │   ├── bus.py                  # Async event bus for eval metrics
│   │   ├── judges/                 # RAGAS + heuristic judges
│   │   ├── repository/             # PostgreSQL + SQLite metrics repositories
│   │   └── workers/                # Token metrics, judge, forgetting tracker
│   ├── files/
│   │   └── parser.py               # File upload → chunked episodic + KG ingestion
│   ├── memory/
│   │   ├── episodic_store.py       # ChromaDB wrapper + Episode dataclass
│   │   ├── episodic_backend.py     # Local file vs HTTP backend abstraction
│   │   ├── kg_store.py             # NetworkX DiGraph + Hebbian logic
│   │   └── kg_backend.py           # File vs PostgreSQL KG backend
│   └── models/
│       ├── catalog.py              # Supported model catalog per provider
│       ├── config_repo.py          # Per-user model config repository
│       └── encryption.py           # Fernet encryption for stored API keys
├── scripts/
│   └── seed_data.py                # Seeds 20-query labeled eval dataset
├── tests/                          # Integration tests (require live infra)
└── frontend/
    ├── app/                        # Next.js App Router pages
    ├── components/                 # Chat, MemoryPanel, GraphPanel, EvalDashboard, Docs
    └── lib/                        # API client, data types
```

---

## Design Decisions

**Why three memory tiers?** Each tier captures a different type of information: working memory preserves conversational flow (what was just said), episodic memory preserves salient events (what mattered), and the knowledge graph preserves relational structure (how things connect). Each tier's retrieval mechanism is optimized for its information type — recency for working, similarity for episodic, traversal for graph.

**Why Hebbian reinforcement?** Edges that are retrieved together get stronger. This means the graph self-organizes around concepts the user actually returns to — mirrors how human long-term memory consolidates frequently-accessed associations.

**Why PostgreSQL instead of SQLite?** Horizontal scaling. Multiple API replicas need a shared, concurrent-safe backend. SQLite serializes writes and can't be shared across processes. The same rationale drove ChromaDB in HTTP server mode and Redis for sessions.

**Why swappable backends?** `EpisodicBackend` and `KGBackend` are Protocol classes — the concrete implementation (file, PostgreSQL, Qdrant) is injected at startup. This lets the eval framework swap backends to test different configurations without changing agent code.

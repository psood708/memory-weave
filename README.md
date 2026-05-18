# 🧠 MemoryWeave

> A long-running conversational AI agent with biologically-inspired three-tier memory — episodic recall, knowledge graph, and working context — all running locally via Ollama.

**The core insight:** context quality beats context quantity. Most agents either forget everything (stateless) or dump the entire history into the prompt (expensive, noisy, degrades performance). MemoryWeave constructs a *richer* context at a *fraction* of the token cost by combining vector similarity search with live knowledge graph traversal.

Built as a portfolio-grade applied AI system demonstrating context engineering depth, multi-agent orchestration with LangGraph, and evaluation rigor.

---

## 🏗️ Architecture

### Three-Tier Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                            │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  WORKING MEMORY │  │ EPISODIC MEMORY  │  │ KNOWLEDGE     │  │
│  │                 │  │                  │  │    GRAPH      │  │
│  │ Sliding context │  │ ChromaDB         │  │               │  │
│  │ buffer          │  │ Event vectors    │  │ NetworkX      │  │
│  │ Last N turns    │  │ + importance     │  │ Entities +    │  │
│  │ in-context      │  │   scores         │  │ typed edges   │  │
│  │                 │  │ + decay curve    │  │ + edge weights│  │
│  │                 │  │ + entity links   │  │ + Hebbian     │  │
│  └─────────────────┘  └────────┬─────────┘  └───────┬───────┘  │
│                                │   entity links      │          │
│                                └─────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent System (LangGraph)

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
│          │ Sliding    │  │ ChromaDB   │  │ Graph traversal │    │
│          │ buffer     │  │ Importance │  │ Edge reinforce  │    │
│          │ management │  │ + decay    │  │ + decay         │    │
│          └────────────┘  └────────────┘  └─────────────────┘    │
│                                                                  │
│             ┌───────────────────────────────────┐               │
│             │       Conversational Agent         │               │
│             │  Receives merged context, responds │               │
│             │  to user, triggers write path      │               │
│             └───────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

**📥 Read path (before each response):**
```
User query
    │
    ▼
Memory Orchestrator ──► Working Memory   → last N turns
                    ──► Episodic Memory  → top-k similar episodes (ChromaDB cosine search)
                    ──► KG Agent         → 1-2 hop graph traversal from episode entities
    │
    ▼
Merge + rank:  importance × recency × graph_centrality
    │
    ▼
Token budget enforcement (default: 2000 tokens)
    │
    ▼
Conversational Agent (qwen3.5:9b) generates response
```

**📤 Write path (after each response):**
```
Turn produced
    │
    ▼
Episodic Agent:  gemma4:e2b scores importance (0–1)
                 if score ≥ 0.4 → embed + store in ChromaDB
    │
    ▼
KG Agent:        qwen3.5:9b extracts entities + relationships (JSON mode)
                 upsert nodes/edges in NetworkX graph
                 link episode ID → entity nodes
```

**🔁 Forgetting layer:**
```
Episodic:  score(t) = score(0) × e^(-λ × Δturns)   prune if < 0.05
KG edges:  weight(t) = weight × decay_factor         prune if < 0.10
           weight(t) = weight × reinforcement_factor  (on traversal — Hebbian update)
```

---

## 🤖 Agent Responsibilities

| Agent | Owns | Responsibilities |
|---|---|---|
| **Memory Orchestrator** | Cross-tier coordination | Fan-out reads, merge + rank results, enforce token budget, route writes |
| **Working Memory Agent** | Sliding buffer | Last N turns in-context, eviction when buffer full |
| **Episodic Memory Agent** | ChromaDB | Score importance, write episodes, similarity retrieval, exponential decay + pruning |
| **Knowledge Graph Agent** | NetworkX | Entity + relationship extraction, upsert graph, traversal, Hebbian reinforcement + decay |
| **Conversational Agent** | User-facing dialogue | Receive merged context block, generate response, trigger write path |

---

## 🛠️ Tech Stack

| Layer | Tool | Why |
|---|---|---|
| 🤖 Agent orchestration | LangGraph | Multi-agent graph with typed state, clean node/edge model |
| 🧩 LLM (conversation) | qwen3.5:9b via Ollama | Local, capable, strong instruction following |
| ⚡ LLM (scoring) | gemma4:e2b via Ollama | Lightweight, deterministic, fast for importance scoring |
| 🗃️ Episodic vector store | ChromaDB | Local-first, no infra, easy metadata filtering |
| 🕸️ Knowledge graph | NetworkX | Zero infra, fast iteration; Neo4j upgrade path for v2 |
| 📡 Observability | LangSmith | Trace every agent invocation, token counts per node |
| 🌐 Backend API | FastAPI + SSE | Streaming responses, REST routes for memory state |
| 🖥️ Frontend | Next.js + Tailwind | Professional UI for portfolio demos |
| 📊 Graph visualization | react-force-graph | In-browser KG with physics simulation |
| 📏 Eval | Custom (RAGAS-inspired) | Retrieval accuracy, token efficiency, graph contribution rate |
| 📦 Package manager | uv | Fast, reproducible |

---

## 🚀 Quickstart

### Prerequisites

- [Ollama](https://ollama.com) installed and running
- Both models pulled:
  ```bash
  ollama pull qwen3.5:9b
  ollama pull gemma4:e2b
  ```
- [uv](https://docs.astral.sh/uv/) installed

### Setup

```bash
# Clone and enter the project
cd proj1/

# Install dependencies
uv sync

# Configure environment
cp .env.example .env
# Edit .env if you want LangSmith tracing (optional)
```

### Run

```bash
uv run python cli.py
```

### CLI Commands

| Input | Action |
|---|---|
| Any text | Chat with the agent |
| `stats` | Show current episode count and turn count |
| `quit` | Exit |

---

## ⚙️ Configuration

All settings live in `.env` (or as environment variables):

```env
# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:9b          # main conversational LLM
OLLAMA_SCORER_MODEL=gemma4:e2b   # importance scoring LLM

# LangSmith — traces every agent node automatically via LangGraph
LANGSMITH_API_KEY=your_key_here
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=memory-weave
```

Tunable parameters in `memoryweave/core/config.py`:

| Parameter | Default | Effect |
|---|---|---|
| `working_memory_max_turns` | 10 | Sliding buffer size |
| `episodic_importance_threshold` | 0.4 | Min score to store an episode |
| `episodic_decay_lambda` | 0.05 | Forgetting rate (higher = faster decay) |
| `episodic_top_k` | 5 | Episodes retrieved per turn |
| `episodic_min_importance` | 0.05 | Prune episodes below this score |
| `kg_reinforcement_factor` | 1.2 | Hebbian edge boost on traversal |
| `kg_decay_factor` | 0.95 | Edge weight decay per turn |
| `kg_min_edge_weight` | 0.1 | Prune edges below this weight |
| `kg_traversal_hops` | 2 | Max hops in graph traversal |
| `context_token_budget` | 2000 | Max tokens for injected context |

---

## 🔍 Inspecting ChromaDB Contents

ChromaDB persists episodes to `.chroma/` in the project root. To browse the contents interactively:

### Quick inspection script

```python
# Run with: uv run python -c "$(cat below)"
import chromadb
from chromadb.config import Settings

client = chromadb.PersistentClient(
    path=".chroma",
    settings=Settings(anonymized_telemetry=False),
)

collection = client.get_or_create_collection("episodes")
print(f"Total episodes stored: {collection.count()}\n")

# Fetch all episodes
all_items = collection.get(include=["documents", "metadatas"])

for id_, doc, meta in zip(all_items["ids"], all_items["documents"], all_items["metadatas"]):
    print(f"ID:         {id_}")
    print(f"Importance: {float(meta['importance_score']):.3f}")
    print(f"Timestamp:  {meta['timestamp']}")
    print(f"Session:    {meta['session_id']}")
    print(f"Turn:       {meta['turn_number']}")
    print(f"Content:\n{doc}\n")
    print("-" * 60)
```

### Similarity search

```python
import chromadb
from chromadb.config import Settings

client = chromadb.PersistentClient(path=".chroma", settings=Settings(anonymized_telemetry=False))
collection = client.get_or_create_collection("episodes")

results = collection.query(
    query_texts=["what project am I building?"],
    n_results=3,
    include=["documents", "metadatas", "distances"],
)

for id_, doc, meta, dist in zip(
    results["ids"][0], results["documents"][0],
    results["metadatas"][0], results["distances"][0]
):
    print(f"Score: {1 - dist:.3f} | Importance: {float(meta['importance_score']):.3f}")
    print(doc)
    print()
```

### Delete all episodes (reset memory)

```python
import chromadb
from chromadb.config import Settings

client = chromadb.PersistentClient(path=".chroma", settings=Settings(anonymized_telemetry=False))
client.delete_collection("episodes")
print("Episodes cleared.")
```

---

## 🧪 Testing

```bash
# Run all unit tests
uv run pytest memoryweave/tests/ -v

# Run specific test file
uv run pytest memoryweave/tests/test_episodic_store.py -v

# KG-specific tests
uv run pytest memoryweave/tests/test_kg_extraction.py memoryweave/tests/test_kg_graph_ops.py memoryweave/tests/test_kg_persistence.py -v

# End-to-end retrieval
uv run pytest memoryweave/tests/test_two_phase_retrieval.py memoryweave/tests/test_langgraph_graph.py -v
```

---

## 📊 Key Metrics

| Metric | Result |
|---|---|
| 🪙 Token efficiency | `___% reduction vs. naive full-buffer` |
| 🎯 Retrieval accuracy | `___% on 20 labeled test queries` |
| 🕸️ Graph contribution rate | `___% of turns where KG added unique context` |
| ⏱️ Latency overhead | `___ms average context construction time` |

---

## 📁 Project Structure

```
proj1/
├── cli.py                          # Interactive REPL entry point
├── main.py                         # FastAPI app entry point (Week 3)
├── memoryweave/
│   ├── agents/
│   │   ├── conversational.py       # User-facing agent
│   │   ├── episodic_memory.py      # Scoring, storage, retrieval, decay
│   │   ├── graph.py                # LangGraph StateGraph — wires all agents
│   │   ├── kg_agent.py             # Entity extraction + KG read/write
│   │   ├── orchestrator.py         # Fan-out, merge, token budget
│   │   └── working_memory.py       # Sliding buffer
│   ├── core/
│   │   ├── config.py               # Pydantic settings (reads .env)
│   │   ├── context_budget.py       # Token budget enforcement + formatting
│   │   ├── llm.py                  # Ollama LLM factories
│   │   ├── protocols.py            # Runtime-checkable agent protocols
│   │   └── state.py                # MemoryWeaveState TypedDict
│   ├── memory/
│   │   ├── episodic_store.py       # ChromaDB wrapper + Episode dataclass
│   │   └── kg_store.py             # NetworkX DiGraph with JSON persistence
│   ├── eval/                       # Evaluation framework (Week 3-4)
│   └── tests/
│       ├── test_agents.py
│       ├── test_episodic_store.py
│       ├── test_kg_extraction.py
│       ├── test_kg_graph_ops.py
│       ├── test_kg_persistence.py
│       ├── test_langgraph_graph.py
│       ├── test_two_phase_retrieval.py
│       └── test_working_memory.py
├── .chroma/                        # ChromaDB persistence (git-ignored)
├── .env.example
└── pyproject.toml
```

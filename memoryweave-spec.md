# MemoryWeave: Episodic Memory Agent with Knowledge Graph

## Context

Current AI agents face a binary memory problem: they either forget everything between sessions (stateless) or dump the entire conversation history into context (expensive, noisy, degrades performance). Neither approach scales. The "lost in the middle" problem is real — models with massive context windows still perform worse when flooded with irrelevant content.

This project builds a long-running conversational agent with a biologically-inspired three-tier memory system. The key insight driving the design: **context quality beats context quantity**. By combining episodic vector memory (what happened) with a live knowledge graph (how things are connected), the system constructs richer, more accurate context at a fraction of the token cost of naive buffering.

**Intended outcome:** A portfolio-grade, end-to-end applied AI system that demonstrates context engineering depth, multi-agent orchestration, and DS/ML evaluation rigor — optimized to signal strongly for Applied AI Engineering roles at AI-first startups.

---

## What This Project Does

- Maintains coherent agent memory across long multi-session conversations without blowing up context windows
- Stores episodic memories with importance scores that decay over time unless reinforced by retrieval
- Extracts entities and typed relationships from conversations into a live, evolving knowledge graph
- Retrieves context using two-phase retrieval: vector similarity search → knowledge graph traversal (multi-hop)
- Applies Hebbian-inspired edge weight decay: graph edges that are traversed get reinforced; unused edges fade
- Enforces a token budget per turn: merges and ranks context from all three memory tiers before injection
- Measures everything: token efficiency, retrieval accuracy, graph contribution rate vs. naive buffer baseline
- Exposes a Next.js UI with live memory state visualization and a knowledge graph rendered in-browser

---

## Architecture

### Three-Tier Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY SYSTEM                              │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  WORKING MEMORY │  │ EPISODIC MEMORY  │  │ SEMANTIC MEM  │  │
│  │                 │  │                  │  │ (Knowledge    │  │
│  │ Sliding context │  │ ChromaDB         │  │  Graph)       │  │
│  │ buffer          │  │ Event vectors    │  │               │  │
│  │ Last N turns    │  │ + importance     │  │ NetworkX      │  │
│  │ in-context      │  │   scores         │  │ Entities +    │  │
│  │                 │  │ + decay curve    │  │ typed edges   │  │
│  │                 │  │ + entity links   │  │ + edge weights│  │
│  └─────────────────┘  └────────┬─────────┘  └───────┬───────┘  │
│                                │   entity links      │          │
│                                └─────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent System (LangGraph)

```
┌──────────────────────────────────────────────────────────────────┐
│                   AGENT SYSTEM (LangGraph)                       │
│                                                                  │
│          ┌───────────────────────────────────┐                  │
│          │      Memory Orchestrator Agent     │                  │
│          │  Routes, merges, budget enforcer   │                  │
│          └──────┬─────────────┬──────────┬────┘                  │
│                 │             │          │                       │
│       ┌─────────▼──┐  ┌───────▼────┐  ┌─▼──────────────────┐   │
│       │  Working   │  │ Episodic   │  │  Knowledge Graph   │   │
│       │  Memory    │  │  Memory    │  │      Agent         │   │
│       │   Agent    │  │   Agent    │  │                    │   │
│       │            │  │            │  │ Entity extraction  │   │
│       │ Sliding    │  │ ChromaDB   │  │ Graph traversal    │   │
│       │ buffer     │  │ Importance │  │ Edge reinforcement │   │
│       │ management │  │ + decay    │  │ + decay            │   │
│       └────────────┘  └────────────┘  └────────────────────┘   │
│                                                                  │
│          ┌───────────────────────────────────┐                  │
│          │       Conversational Agent         │                  │
│          │  Receives merged context, responds │                  │
│          │  to user, triggers write path      │                  │
│          └───────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Agent Responsibilities

| Agent | Owns | Responsibilities |
|---|---|---|
| **Memory Orchestrator** | Cross-tier coordination | Fan-out read requests to all three agents, merge + rank results, enforce token budget, route write requests after each turn |
| **Working Memory Agent** | Sliding buffer | Maintain last N turns in-context, manage eviction when buffer full |
| **Episodic Memory Agent** | ChromaDB | Score importance of new episodes, write to ChromaDB, retrieve via similarity search, run exponential decay + pruning |
| **Knowledge Graph Agent** | NetworkX | Extract entities + relationships via Claude structured output, upsert graph nodes/edges, traverse on read (1-2 hops), reinforce traversed edges, decay unused edges |
| **Conversational Agent** | User-facing dialogue | Receive pre-built context block from Orchestrator, generate response, hand new turn back to Orchestrator for write path |

---

## Data Flows

### Write Path (after each user/agent turn)
```
Conversational Agent produces response
        │
        ▼
Memory Orchestrator Agent
        ├──► Episodic Memory Agent
        │       → score importance (LLM-based scorer)
        │       → if score ≥ threshold: embed + write to ChromaDB
        │         metadata: {timestamp, importance_score, session_id, entity_ids[]}
        │
        └──► Knowledge Graph Agent
                → extract entities + relationships (Claude structured output)
                → upsert nodes (entities) + edges (relationships + initial weight)
                → link episode ID to entity nodes
```

### Read Path (before each LLM response)
```
Incoming user query
        │
        ▼
Memory Orchestrator Agent (parallel fan-out)
        ├──► Working Memory Agent    → last N turns (raw)
        ├──► Episodic Memory Agent   → top-k similar episodes via ChromaDB similarity search
        └──► Knowledge Graph Agent
                → extract entity mentions from top-k episodes
                → graph traversal 1-2 hops from matched entities
                → reinforce traversed edge weights (Hebbian update)
                → return connected entities + relationship context
        │
        ▼
Merge + rank all results
  score = importance_score × recency_weight × graph_centrality
        │
        ▼
Enforce context token budget (trim lowest-scoring items)
        │
        ▼
Conversational Agent receives structured context block + responds
```

### Forgetting Layer (background maintenance per session)
```
Episodic store:
  importance_score(t) = importance_score(0) × e^(-λ × turns_since_last_retrieval)
  Prune episodes below min_importance_threshold

Knowledge graph:
  edge_weight(t) = edge_weight(0) × decay_factor (if not traversed)
  edge_weight(t) = edge_weight × reinforcement_factor (if traversed — Hebbian update)
  Prune edges below min_weight_threshold
```

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Agent orchestration | LangGraph | Multi-agent graph with typed state, clean node/edge model |
| Episodic vector store | ChromaDB | Local-first, no external infra needed, easy metadata filtering |
| Knowledge graph | NetworkX (v1), Neo4j upgrade path (v2) | NetworkX = zero infra, fast iteration; Neo4j = production-grade Cypher queries |
| Entity extraction | Claude Sonnet 4.6 with structured output | Pydantic models for clean entity/relationship extraction |
| LLM backbone | Claude Sonnet 4.6 | Best instruction-following + structured output quality |
| Observability | LangSmith | Trace every agent invocation, token counts per node |
| Backend API | FastAPI | SSE for streaming, clean REST routes for memory state |
| Frontend | Next.js + Tailwind CSS | Professional UI, better than Streamlit for portfolio |
| Graph visualization | react-force-graph | In-browser KG visualization with physics simulation |
| Eval metrics | Custom (RAGAS-inspired) | Retrieval accuracy, token efficiency, graph contribution rate |
| Package manager | uv | Fast, reproducible |

---

## Implementation Plan

### Week 1 — Core Memory Infrastructure

**Goal:** A working memory system (no UI, CLI only) with episodic + working memory.

- [ ] **Project scaffold**
  - Initialize uv project in `proj1/`
  - Install: langchain, langgraph, chromadb, anthropic, fastapi, uvicorn, networkx, langsmith
  - Set up `.env` with `ANTHROPIC_API_KEY`, `LANGSMITH_API_KEY`
  - Configure LangSmith project tracing

- [ ] **Working Memory Agent**
  - Implement sliding buffer with configurable `max_turns` (default: 10)
  - Eviction: drop oldest turn when buffer exceeds limit
  - State: `List[BaseMessage]`

- [ ] **Episodic Memory Agent**
  - ChromaDB collection setup with metadata schema
  - Importance scorer: LLM-based (prompt: "score this conversation turn 0-1 for long-term relevance")
  - Write path: embed + store if `importance_score >= 0.4`
  - Read path: similarity search returning top-k with metadata
  - Exponential decay function: `score × e^(-λ × Δturns)`, apply on each read

- [ ] **Memory Orchestrator (v1 — no KG yet)**
  - Fan-out to Working + Episodic agents in parallel
  - Merge results, rank by `importance × recency`
  - Token budget enforcement (configurable, default: 2000 tokens)

- [ ] **Conversational Agent (basic)**
  - Takes merged context block as system message prefix
  - Uses Claude Sonnet 4.6
  - Triggers Orchestrator write path after each turn

- [ ] **CLI test harness**
  - Run a 20-turn conversation, inspect what gets stored and retrieved
  - Log token counts per turn

---

### Week 2 — Knowledge Graph Agent + Full Integration

**Goal:** Full three-tier memory system with two-phase retrieval and Hebbian forgetting.

- [ ] **Knowledge Graph Agent — Entity Extraction**
  - Pydantic models: `Entity(name, type, description)`, `Relationship(source, target, rel_type, weight)`
  - LLM extraction prompt: structured output from conversation turn
  - Entity types: Person, Project, Concept, Decision, Tool, Organization

- [ ] **Knowledge Graph Agent — Graph Operations**
  - NetworkX DiGraph as in-memory store
  - `upsert_node(entity)`: add or update entity node
  - `upsert_edge(relationship)`: add or update typed edge with initial weight
  - `traverse(entity_ids, hops=2)`: BFS/DFS from seed entities, return subgraph
  - `reinforce_edges(traversed_edges)`: multiply edge weight by `reinforcement_factor` (default: 1.2)
  - `decay_edges()`: multiply all edge weights by `decay_factor` (default: 0.95) per session tick
  - `prune_edges(min_weight=0.1)`: remove edges below threshold
  - Persist graph to JSON on session end, reload on session start

- [ ] **Two-Phase Retrieval Integration**
  - Episodic Agent returns top-k episodes + their `entity_ids`
  - KG Agent traverses from those entity IDs
  - Orchestrator merges: episodes + graph subgraph context
  - Rank: `importance × recency × graph_centrality` (centrality = degree of entity node)

- [ ] **Memory Orchestrator (v2 — full)**
  - Fan-out to all three agents
  - Structured context block format for LLM injection:
    ```
    [WORKING MEMORY]
    ...last N turns...

    [RELEVANT EPISODES]
    ...timestamped episodic memories...

    [KNOWLEDGE GRAPH CONTEXT]
    ...entities and relationships relevant to this query...
    ```

- [ ] **LangSmith tracing**
  - Tag each agent node in the LangGraph with LangSmith metadata
  - Track: tokens per node, latency per node, which memory tiers contributed

- [ ] **Integration test**
  - 50-turn synthetic conversation covering multiple entities and topics
  - Verify: graph grows correctly, edges decay, episodes prune at correct threshold
  - Log: token usage per turn vs. naive full-buffer baseline

---

### Week 3 — FastAPI Backend + Next.js UI + Evaluation

**Goal:** A demo-able, portfolio-ready application with live memory visualization and eval dashboard.

- [ ] **FastAPI Backend**
  - `POST /chat` → SSE streaming response + memory write
  - `GET /memory/episodes` → current episodic store state (list with scores)
  - `GET /memory/graph` → KG as node/edge JSON for visualization
  - `GET /memory/working` → current working memory buffer
  - `GET /eval/metrics` → session-level evaluation metrics
  - `POST /session/new` → reset memory state, start fresh session
  - CORS configured for Next.js dev server

- [ ] **Next.js Project Setup**
  - Initialize with `create-next-app`, Tailwind CSS, TypeScript
  - Install: `react-force-graph`, `recharts` (eval charts), `eventsource-parser` (SSE)

- [ ] **Chat Interface (main panel)**
  - Streaming message rendering via SSE
  - Each agent response shows memory attribution badges: `[working]` `[episodic]` `[graph]`
  - Token count per turn displayed inline
  - Session management: start new session button

- [ ] **Memory State Panel (right sidebar)**
  - Episode list: title, importance score, decay indicator (color-coded), timestamp
  - Live refresh every N seconds
  - Click episode to see full content

- [ ] **Knowledge Graph Panel**
  - `react-force-graph` rendering of KG nodes/edges
  - Node size = degree centrality
  - Edge thickness = edge weight
  - Click node → highlight connected episodes in episode list
  - Live refresh as graph evolves during conversation

- [ ] **Evaluation Dashboard (separate tab)**
  - Token efficiency chart: this session vs. naive buffer (line chart with `recharts`)
  - Retrieval accuracy: did correct memories surface? (sampled human-labeled test queries)
  - Graph contribution rate: % of context turns where KG traversal added context not in vector results
  - Forgetting curve: episode importance decay over session turns

- [ ] **Evaluation Framework**
  - `eval/benchmark.py`: run 50-turn synthetic session, compute all metrics
  - Metrics:
    - **Token efficiency**: `(naive_buffer_tokens - system_tokens) / naive_buffer_tokens`
    - **Retrieval accuracy**: ground truth labels on 20 test queries (manual)
    - **Graph contribution**: count turns where KG returned unique entities not in episode results
    - **Forgetting precision**: ratio of pruned episodes that were never retrieved again

---

### Week 4 — Polish, Benchmarking, Documentation

**Goal:** Production-ready presentation layer; benchmark results to cite in interviews.

- [ ] **Docker Compose**
  - Services: `api` (FastAPI), `frontend` (Next.js), `chromadb` (standalone)
  - Single `docker compose up` to run full stack

- [ ] **Benchmark report**
  - Run formal eval: 3 sessions × 50 turns × 3 memory strategies (naive, episodic-only, full system)
  - Output: comparison table with token costs, retrieval accuracy, latency
  - Save as `eval/results/benchmark_YYYYMMDD.json`

- [ ] **README**
  - Architecture diagram
  - Quick start (`docker compose up`)
  - Demo GIF (screen-recorded)
  - Key findings from benchmark (the numbers to cite in interviews)

- [ ] **Optional: Neo4j upgrade**
  - Swap NetworkX backend for Neo4j
  - Cypher queries for traversal
  - Demonstrates production-grade graph DB knowledge

---

## Verification Strategy

### Unit Tests (Week 1-2)
- `test_episodic_agent.py`: write episode → retrieve → verify similarity ranking
- `test_kg_agent.py`: extract entities from sample text → verify graph structure
- `test_decay.py`: run N ticks → verify importance scores follow decay curve
- `test_budget.py`: overflow context budget → verify lowest-ranked items trimmed

### Integration Tests (Week 2)
- `test_full_memory.py`: 20-turn conversation → verify all three tiers populated correctly
- `test_two_phase_retrieval.py`: query that requires graph hop to answer → verify KG contribution

### End-to-End (Week 3)
- Run `eval/benchmark.py`: full 50-turn session with metrics output
- Manual walkthrough: start fresh session, converse for 20 turns, verify UI shows correct graph and episodes
- LangSmith trace review: confirm all agents are traced, no silent failures

### Interview Claim Validation
Before presenting the project, run the benchmark and fill in these numbers:
- Token efficiency: `___% reduction vs. naive buffer`
- Retrieval accuracy: `___% on 20 test queries`
- Graph contribution: `___% of turns where KG added unique context`
- Latency overhead: `___ms average context construction time`

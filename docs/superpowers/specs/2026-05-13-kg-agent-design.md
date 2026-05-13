# Knowledge Graph Agent — Design Spec

**Date:** 2026-05-13
**Project:** MemoryWeave (Week 2)
**Status:** Approved, ready for implementation

---

## Context

Week 1 delivered a working two-tier memory system (working memory + episodic memory via ChromaDB). The episodic agent already stores `entity_ids` per episode as an empty list — the KG agent is the component that populates this field and enables two-phase retrieval.

The KG agent is the centrepiece of Week 2. Without it, retrieval is pure vector similarity. With it, a query can surface entities connected by 1-2 hops that a vector search would miss entirely — which is the core portfolio claim of MemoryWeave.

**Reference:** *Think-on-Graph* (Sun et al., 2024) demonstrates that weight-guided graph traversal outperforms flat vector retrieval on multi-hop reasoning tasks. This design applies the same principle to conversational memory. https://arxiv.org/abs/2307.07697

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Extraction model | `qwen3.5:9b` via Ollama JSON mode | Fully local, no API dependency, capable of structured output |
| Entity types | `Person`, `Project`, `Preference`, `Fact`, `Organization` | Narrow and focused — covers all meaningful conversational entities without noise |
| Traversal strategy | Weighted priority-queue, max 2 hops | Surfaces highest-weight paths first; degrades gracefully as graph grows |
| Hebbian reinforcement | ×1.2 on traversal, ×0.95 decay per turn | Frequently accessed edges strengthen; stale edges fade naturally |
| Persistence | `kg_store.json`, atomic write (tmp → rename) | Survives process restarts; crash-safe |
| Architecture | LangGraph `StateGraph` with typed `MemoryWeaveState` | Native LangSmith tracing per node, parallel fan-out, clean typed state |

---

## Typed State

Replaces the current manual data passing in `MemoryOrchestrator`. All nodes read from and write into this shared state:

```python
class MemoryWeaveState(TypedDict):
    # Input
    user_input: str

    # Read path (populated in parallel by memory nodes)
    working_context: str
    episodes: list[Episode]
    episode_context: str
    kg_context: str

    # Write path
    response: str
    token_estimate: int
```

---

## LangGraph Graph Structure

```
                    ┌─────────────────┐
                    │   START (input) │
                    └────────┬────────┘
                             │ parallel fan-out
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  working_memory_node  episodic_node         kg_node
  (reads buffer)       (ChromaDB search)    (weighted traversal
                                            + Hebbian reinforce)
          └──────────────────┼──────────────────┘
                             ▼
                        merge_node
                  (token budget enforcement,
                   context block assembly)
                             │
                             ▼
                   conversational_node
                   (qwen3.5:9b generates response)
                             │
                             ▼
                        write_node
                  (episodic write + KG extraction
                   + graph upsert + persistence)
                             │
                             ▼
                            END
```

**Key design choices:**
- The three memory nodes run in parallel on the read path via LangGraph's fan-out. `kg_node` extracts entity mentions directly from `user_input` for traversal — not from episodes — so it has no sequential dependency on `episodic_node`.
- `merge_node` is a pure function — no LLM call, just context assembly and token trimming
- `write_node` runs episodic scoring and KG extraction sequentially (both consume the same turn content; KG upsert links back to the episode ID produced by episodic write)
- LangSmith tracing is automatic — no decorators needed on LangGraph nodes

---

## Pydantic Extraction Schema

```python
from typing import Literal
from pydantic import BaseModel

class Entity(BaseModel):
    name: str
    type: Literal["Person", "Project", "Preference", "Fact", "Organization"]
    description: str

class Relationship(BaseModel):
    source: str       # entity name
    target: str       # entity name
    rel_type: str     # e.g. "works_on", "prefers", "knows", "part_of"
    weight: float = 1.0

class ExtractionResult(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]
```

Extraction uses `qwen3.5:9b` with Ollama's `format="json"` parameter and a tight prompt that instructs the model to output only the schema fields. Pydantic validates the response; a validation error returns an empty `ExtractionResult` (fail-safe, no cascading failure).

---

## KG Agent Internals

### Graph Store

- **Backend:** NetworkX `DiGraph`
- **Node attributes:** `name`, `type`, `description`
- **Edge attributes:** `rel_type`, `weight`
- **Persistence:** `kg_store.json` using `nx.node_link_data()` / `nx.node_link_graph()`
- **Atomic write:** write to `.kg_store.json.tmp`, then `os.replace()` to avoid corruption on crash

### Graph Operations

| Method | Behaviour |
|---|---|
| `upsert_node(entity)` | Add node if new; update description if exists |
| `upsert_edge(rel)` | Add edge if new (weight=1.0); if exists, keep current weight |
| `traverse(seed_ids, hops=2)` | Priority-queue traversal by edge weight; returns top-N nodes as (entity, context_str) list |
| `reinforce(traversed_edges)` | Multiply traversed edge weights by `reinforcement_factor` (1.2) |
| `decay_all()` | Multiply all edge weights by `decay_factor` (0.95) |
| `prune()` | Delete edges below `min_edge_weight` (0.1); delete orphan nodes |
| `save()` | Atomic JSON write |
| `load()` | Reload from JSON on startup |

### Weighted Traversal (detail)

```
Input: entity names extracted from user_input (via qwen3.5:9b)
Output: list of (entity_name, description, rel_type) tuples

Algorithm:
  seed_nodes = match extracted entity names to graph nodes (fuzzy/exact)
  heap = max-heap of (-edge_weight, depth, neighbor_node)
         seeded from all outgoing edges of seed_nodes at depth=0
  visited = set(seed_nodes)
  results = []

  while heap and len(results) < node_budget:
      neg_weight, depth, node = heappop(heap)
      if node in visited: continue
      visited.add(node)
      results.append(node)
      if depth + 1 < max_hops:
          for neighbor, edge_data in graph.out_edges(node, data=True):
              heappush(heap, (-edge_data["weight"], depth + 1, neighbor))
```

After traversal: call `reinforce()` on all traversed edges, then `decay_all()`, then `prune()`.

### Context Formatting

Returns a plain string for injection into `MemoryWeaveState.kg_context`:

```
[Parth] (Person) — building MemoryWeave as a portfolio project
  → works_on → [MemoryWeave] (weight: 1.44)
[MemoryWeave] (Project) — multi-agent episodic memory system with KG
  → uses → [LangGraph] (weight: 0.95)
```

---

## File Layout

```
memoryweave/
├── agents/
│   ├── kg_agent.py          # NEW — KGAgent class (extraction + graph ops + traversal)
│   └── graph.py             # NEW — LangGraph StateGraph definition (replaces orchestrator.py)
├── memory/
│   └── kg_store.py          # NEW — KnowledgeGraphStore (NetworkX wrapper + persistence)
├── core/
│   └── state.py             # NEW — MemoryWeaveState TypedDict
└── tests/
    ├── test_kg_extraction.py
    ├── test_kg_graph_ops.py
    ├── test_kg_persistence.py
    ├── test_langgraph_graph.py
    └── test_two_phase_retrieval.py
```

`orchestrator.py` is superseded by `graph.py`. The existing `WorkingMemoryAgent`, `EpisodicMemoryAgent`, and `EpisodicStore` classes are unchanged — they are called inside their respective LangGraph node functions.

---

## Error Handling

| Failure | Behaviour |
|---|---|
| `qwen3.5:9b` returns malformed JSON | Catch `ValidationError`, log warning, return empty `ExtractionResult`. Turn still stored episodically. |
| No seed entity IDs (early turns) | `kg_node` returns empty string. `merge_node` handles gracefully via existing `ContextBlock` logic. |
| Graph traversal from unknown entity ID | Skip silently. |
| JSON persistence write failure | Log error, continue in-memory. Next successful write will recover. |
| Empty graph on first run | `load()` returns empty `DiGraph`. No special casing needed. |

---

## Testing Plan

| Test file | What it verifies |
|---|---|
| `test_kg_extraction.py` | `qwen3.5:9b` extracts correct entity types + relationships from a sample conversation turn |
| `test_kg_graph_ops.py` | upsert, traversal, Hebbian reinforce, decay, pruning produce correct graph state |
| `test_kg_persistence.py` | Graph saves to JSON and reloads with identical nodes, edges, and weights |
| `test_langgraph_graph.py` | Full LangGraph run: input → parallel nodes → merge → response → write, state correct at each node |
| `test_two_phase_retrieval.py` | Query requiring a 2-hop graph answer surfaces context that vector search alone misses |

---

## What This Unlocks

- Full three-tier memory system operational
- Two-phase retrieval: vector similarity → graph traversal → merged context
- LangSmith traces with clean per-node spans (automatic via LangGraph)
- `entity_ids` field on episodes now populated — episodes and graph are linked
- Foundation for Week 3: `GET /memory/graph` endpoint returns `kg_store.json` directly to `react-force-graph`

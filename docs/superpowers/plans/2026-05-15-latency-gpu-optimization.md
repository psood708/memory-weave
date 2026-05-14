# Latency & Mac GPU Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce per-turn latency by throttling hot-path decay, parallelizing write-path LLM calls, fusing score+extract into one call, and maximizing Mac Metal GPU utilization via Ollama settings.

**Architecture:** Four independent improvements in priority order — decay throttling (eliminates O(N) ChromaDB scan every turn), write-path parallelism (runs score+extract concurrently), prompt fusion (cuts write-path LLM calls from 2→1), and Ollama Metal flags (maximizes GPU layer offload and enables flash attention).

**Tech Stack:** Python `concurrent.futures.ThreadPoolExecutor`, `ChatOllama` num_gpu/num_ctx options, Ollama env vars (`OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`)

---

## Root Cause Analysis

| Bottleneck | Where | Cost per turn |
|---|---|---|
| `apply_decay()` called inside `retrieve()` | `episodic_store.py:88` | Full ChromaDB scan + re-upsert of ALL episodes, every turn |
| `decay_all()` called inside `retrieve_context()` | `kg_agent.py:80` | Iterates all KG edges, every turn |
| Score LLM call + Extract LLM call run sequentially | `graph.py:59-70` | ~gemma_latency + qwen_latency stacked |
| No `num_gpu` or flash attention in Ollama config | `llm.py:6-31` | Metal GPU underutilized; missing KV cache speedup |

---

## Files Modified

- Modify: `memoryweave/memory/episodic_store.py` — add decay interval throttle
- Modify: `memoryweave/memory/kg_store.py` — add decay interval throttle
- Modify: `memoryweave/agents/kg_agent.py` — remove decay from read path; add fused score+extract method
- Modify: `memoryweave/agents/episodic_memory.py` — use fused LLM call, remove standalone scorer
- Modify: `memoryweave/agents/graph.py` — parallelize score+extract in write_node
- Modify: `memoryweave/core/llm.py` — add num_gpu, num_ctx, remove get_scorer_llm
- Modify: `memoryweave/core/config.py` — add decay_interval setting
- Modify: `.env` (or `.env.example`) — add OLLAMA_FLASH_ATTENTION, OLLAMA_KV_CACHE_TYPE
- Test: `tests/test_decay_throttle.py`
- Test: `tests/test_fused_extraction.py`

---

## Task 1: Throttle episodic decay to every N turns

**Files:**
- Modify: `memoryweave/memory/episodic_store.py`
- Modify: `memoryweave/core/config.py`
- Test: `tests/test_decay_throttle.py`

Currently `apply_decay()` is called inside `retrieve()` on every single turn. It does `collection.get()` (fetches ALL episodes from SQLite) then `collection.upsert()` (writes ALL scores back). With 50 episodes this adds ~200-500ms per turn with zero benefit over running it every 5 turns.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_decay_throttle.py
from unittest.mock import MagicMock, patch
from memoryweave.memory.episodic_store import EpisodicStore


def test_decay_only_runs_on_interval(tmp_path):
    store = EpisodicStore(persist_dir=str(tmp_path))
    store._turn_counter = 10

    with patch.object(store, "apply_decay") as mock_decay:
        # simulate 5 retrieves - decay should fire only once (at turn % interval == 0)
        for i in range(5):
            store._turn_counter = i + 1
            store._maybe_decay(decay_lambda=0.05)

        assert mock_decay.call_count == 1  # only at turn 5 with interval=5


def test_decay_skipped_between_intervals(tmp_path):
    store = EpisodicStore(persist_dir=str(tmp_path))
    store._turn_counter = 3  # not a multiple of 5

    with patch.object(store, "apply_decay") as mock_decay:
        store._maybe_decay(decay_lambda=0.05)
        mock_decay.assert_not_called()
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/psood/MLops/langchain_fundamentals/proj1
uv run pytest tests/test_decay_throttle.py -v
```
Expected: `AttributeError: 'EpisodicStore' object has no attribute '_maybe_decay'`

- [ ] **Step 3: Add `decay_interval` to config**

In `memoryweave/core/config.py`, add one line inside the `Settings` class after `episodic_min_importance`:

```python
episodic_decay_interval: int = 5  # run decay every N turns
kg_decay_interval: int = 5
```

- [ ] **Step 4: Add `_maybe_decay` to EpisodicStore**

In `memoryweave/memory/episodic_store.py`, add this method after `apply_decay`:

```python
def _maybe_decay(self, decay_lambda: float) -> None:
    if self._turn_counter % self._settings.episodic_decay_interval == 0:
        self.apply_decay(self._turn_counter, decay_lambda)
```

- [ ] **Step 5: Update `retrieve` to call `_maybe_decay` instead of `apply_decay`**

In `memoryweave/agents/episodic_memory.py`, change the `retrieve` method:

```python
def retrieve(self, query: str) -> list[Episode]:
    episodes = self._store.retrieve(query, top_k=settings.episodic_top_k)
    self._store._maybe_decay(settings.episodic_decay_lambda)
    return [ep for ep in episodes if ep.importance_score >= settings.episodic_min_importance]
```

- [ ] **Step 6: Run tests to verify they pass**

```
uv run pytest tests/test_decay_throttle.py -v
```
Expected: `2 passed`

- [ ] **Step 7: Commit**

```bash
git add memoryweave/memory/episodic_store.py memoryweave/core/config.py memoryweave/agents/episodic_memory.py tests/test_decay_throttle.py
git commit -m "perf: throttle episodic decay to every N turns"
```

---

## Task 2: Throttle KG decay out of the read path

**Files:**
- Modify: `memoryweave/agents/kg_agent.py`
- Modify: `memoryweave/memory/kg_store.py`

Currently `kg_agent.retrieve_context()` calls `self._store.decay_all()` and `self._store.prune()` on every single read. This should happen periodically, not on every retrieval.

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_decay_throttle.py

from memoryweave.memory.kg_store import KnowledgeGraphStore


def test_kg_decay_throttled(tmp_path):
    store = KnowledgeGraphStore(persist_path=str(tmp_path / "kg.json"))
    store._call_count = 0

    with patch.object(store, "decay_all") as mock_decay, \
         patch.object(store, "prune") as mock_prune:
        for i in range(5):
            store._call_count = i + 1
            store._maybe_maintain()

        assert mock_decay.call_count == 1
        assert mock_prune.call_count == 1
```

- [ ] **Step 2: Run test to verify it fails**

```
uv run pytest tests/test_decay_throttle.py::test_kg_decay_throttled -v
```
Expected: `AttributeError: 'KnowledgeGraphStore' object has no attribute '_call_count'`

- [ ] **Step 3: Add `_maybe_maintain` to KnowledgeGraphStore**

In `memoryweave/memory/kg_store.py`, add to `__init__` and a new method:

```python
def __init__(self, persist_path: str = "kg_store.json"):
    self._path = persist_path
    _dir = os.path.dirname(os.path.abspath(persist_path))
    _base = os.path.basename(persist_path)
    self._tmp_path = os.path.join(_dir, f".{_base}.tmp")
    self._graph: nx.DiGraph = nx.DiGraph()
    self._call_count: int = 0
    self.load()

def _maybe_maintain(self) -> None:
    from memoryweave.core.config import settings
    self._call_count += 1
    if self._call_count % settings.kg_decay_interval == 0:
        self.decay_all()
        self.prune()
```

- [ ] **Step 4: Update `retrieve_context` in KGAgent to use `_maybe_maintain`**

In `memoryweave/agents/kg_agent.py`, replace the `retrieve_context` method:

```python
def retrieve_context(self, entity_ids: list[str]) -> str:
    nodes = self._store.traverse(entity_ids, max_hops=settings.kg_traversal_hops)
    self._store._maybe_maintain()
    return self._store.format_context(nodes)
```

- [ ] **Step 5: Run tests**

```
uv run pytest tests/test_decay_throttle.py -v
```
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add memoryweave/memory/kg_store.py memoryweave/agents/kg_agent.py tests/test_decay_throttle.py
git commit -m "perf: throttle KG decay/prune out of hot read path"
```

---

## Task 3: Fuse importance scoring + entity extraction into one LLM call

**Files:**
- Modify: `memoryweave/agents/kg_agent.py`
- Modify: `memoryweave/agents/episodic_memory.py`
- Modify: `memoryweave/core/llm.py`
- Test: `tests/test_fused_extraction.py`

Currently the write path makes two sequential LLM calls: `score_importance()` (gemma4:e2b) then `extract_and_update()` (qwen3.5:9b). Fusing them into one structured JSON call on the main model eliminates one network round-trip to Ollama entirely.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_fused_extraction.py
from unittest.mock import MagicMock, patch
from memoryweave.agents.kg_agent import KGAgent, FusedResult


def test_fused_result_schema():
    result = FusedResult.model_validate({
        "importance_score": 0.8,
        "entities": [{"name": "Alice", "type": "Person", "description": "engineer"}],
        "relationships": []
    })
    assert result.importance_score == 0.8
    assert len(result.entities) == 1


def test_fused_extract_returns_score_and_entities():
    agent = KGAgent()
    mock_response = MagicMock()
    mock_response.content = '{"importance_score": 0.75, "entities": [{"name": "Bob", "type": "Person", "description": "dev"}], "relationships": []}'

    with patch.object(agent._extraction_llm, "invoke", return_value=mock_response):
        result = agent.fused_extract("User: hi Bob\nAssistant: hello")

    assert result.importance_score == 0.75
    assert result.entities[0].name == "Bob"
```

- [ ] **Step 2: Run test to verify it fails**

```
uv run pytest tests/test_fused_extraction.py -v
```
Expected: `ImportError: cannot import name 'FusedResult' from 'memoryweave.agents.kg_agent'`

- [ ] **Step 3: Add `FusedResult` model and `fused_extract` method to KGAgent**

In `memoryweave/agents/kg_agent.py`, add the new prompt, model, and method. Replace the file content:

```python
from typing import Literal

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_extraction_llm
from memoryweave.memory.kg_store import KnowledgeGraphStore

_FUSED_PROMPT = """\
Analyze this conversation turn for memory storage.

Turn:
{text}

Return ONLY valid JSON:
{{
  "importance_score": <float 0.0-1.0>,
  "entities": [
    {{"name": "string", "type": "Person|Project|Preference|Fact|Organization", "description": "string"}}
  ],
  "relationships": [
    {{"source": "entity name", "target": "entity name", "rel_type": "string", "weight": 1.0}}
  ]
}}

importance_score rules:
- High (0.7-1.0): specific facts, decisions, names, preferences, project details, commitments
- Low (0.0-0.3): pleasantries, filler, vague statements, repeated context

entity/relationship rules:
- Only types: Person, Project, Preference, Fact, Organization
- rel_type: works_on, prefers, knows, part_of, uses, has, related_to
- source and target must be names from the entities list above
- If no entities found, use empty lists

Return ONLY the JSON object."""


class Entity(BaseModel):
    name: str
    type: Literal["Person", "Project", "Preference", "Fact", "Organization"]
    description: str


class Relationship(BaseModel):
    source: str
    target: str
    rel_type: str
    weight: float = 1.0


class ExtractionResult(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]


class FusedResult(BaseModel):
    importance_score: float
    entities: list[Entity]
    relationships: list[Relationship]


class KGAgent:
    """Extracts entities from conversation turns and manages KG read/write paths."""

    def __init__(self, store: KnowledgeGraphStore | None = None):
        self._store = store or KnowledgeGraphStore()
        self._extraction_llm = get_extraction_llm()

    def fused_extract(self, text: str) -> FusedResult:
        """Single LLM call: returns importance score + entities + relationships."""
        if not text.strip():
            return FusedResult(importance_score=0.0, entities=[], relationships=[])
        try:
            response = self._extraction_llm.invoke(
                [HumanMessage(content=_FUSED_PROMPT.format(text=text))]
            )
            raw = extract_text(response.content)
            return FusedResult.model_validate_json(raw)
        except Exception:
            return FusedResult(importance_score=0.0, entities=[], relationships=[])

    def find_seed_nodes(self, text: str) -> list[str]:
        """Return graph node names that appear (case-insensitive) in text."""
        text_lower = text.lower()
        return [n for n in self._store._graph.nodes if n.lower() in text_lower]

    def retrieve_context(self, entity_ids: list[str]) -> str:
        """Read path: traverse graph from entity_ids, return formatted context string."""
        nodes = self._store.traverse(entity_ids, max_hops=settings.kg_traversal_hops)
        self._store._maybe_maintain()
        return self._store.format_context(nodes)

    def update_graph(self, fused: FusedResult, episode_id: str) -> list[str]:
        """Write path: upsert graph from a FusedResult, persist, return entity names."""
        for entity in fused.entities:
            self._store.upsert_node(entity.name, entity.type, entity.description)
        for rel in fused.relationships:
            if (self._store._graph.has_node(rel.source)
                    and self._store._graph.has_node(rel.target)):
                self._store.upsert_edge(rel.source, rel.target, rel.rel_type, rel.weight)
        self._store.save()
        return [e.name for e in fused.entities]

    @property
    def store(self) -> KnowledgeGraphStore:
        return self._store
```

- [ ] **Step 4: Update `EpisodicMemoryAgent` to accept an external importance score**

In `memoryweave/agents/episodic_memory.py`, remove `get_scorer_llm` import and `score_importance`, update `write` to accept a score directly:

```python
import re
from datetime import datetime, timezone

from langchain_core.messages import BaseMessage

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text
from memoryweave.memory.episodic_store import Episode, EpisodicStore


class EpisodicMemoryAgent:
    """Stores, retrieves, and decays episodic memories."""

    def __init__(self, session_id: str, store: EpisodicStore | None = None):
        self._session_id = session_id
        self._store = store or EpisodicStore()

    def write(self, messages: list[BaseMessage], importance_score: float, entity_ids: list[str] | None = None) -> Episode | None:
        content = "\n".join(
            f"{'User' if m.type == 'human' else 'Assistant'}: {extract_text(m.content)}"
            for m in messages
        )
        turn = self._store.increment_turn()

        if importance_score < settings.episodic_importance_threshold:
            return None

        episode = Episode(
            id=EpisodicStore.new_id(),
            content=content,
            importance_score=importance_score,
            timestamp=datetime.now(timezone.utc),
            session_id=self._session_id,
            turn_number=turn,
            entity_ids=entity_ids or [],
        )
        self._store.write(episode)
        return episode

    def retrieve(self, query: str) -> list[Episode]:
        episodes = self._store.retrieve(query, top_k=settings.episodic_top_k)
        self._store._maybe_decay(settings.episodic_decay_lambda)
        return [ep for ep in episodes if ep.importance_score >= settings.episodic_min_importance]

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        self._store.update_entity_links(episode_id, entity_ids)

    def format_for_context(self, episodes: list[Episode]) -> str:
        if not episodes:
            return ""
        lines = []
        for ep in sorted(episodes, key=lambda e: e.importance_score, reverse=True):
            ts = ep.timestamp.strftime("%Y-%m-%d")
            lines.append(f"[{ts}, importance={ep.importance_score:.2f}] {ep.content}")
        return "\n\n".join(lines)
```

- [ ] **Step 5: Update `write_node` in `graph.py` to use fused call**

In `memoryweave/agents/graph.py`, replace the `write_node` function:

```python
def write_node(state: MemoryWeaveState) -> dict:
    msgs = [
        HumanMessage(content=state["user_input"]),
        AIMessage(content=state["response"]),
    ]
    for msg in msgs:
        working.add(msg)

    turn_content = f"{state['user_input']}\n{state['response']}"
    fused = kg.fused_extract(turn_content)

    episode = episodic.write(msgs, importance_score=fused.importance_score)
    entity_names = kg.update_graph(fused, episode_id=episode.id if episode else "")
    if episode and entity_names:
        episodic.update_entity_links(episode.id, entity_names)
    return {}
```

- [ ] **Step 6: Remove `get_scorer_llm` from `llm.py`**

In `memoryweave/core/llm.py`, delete the `get_scorer_llm` function entirely:

```python
from langchain_ollama import ChatOllama

from memoryweave.core.config import settings


def get_llm(temperature: float = 0.7) -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
    )


def get_extraction_llm() -> ChatOllama:
    """JSON-mode LLM for structured entity extraction and importance scoring — temp=0."""
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json",
    )


def extract_text(content: str | list) -> str:
    """Safely extract plain string from AIMessage.content (str | list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("text", "")
    return str(content)
```

- [ ] **Step 7: Remove `ollama_scorer_model` from config**

In `memoryweave/core/config.py`, remove the `ollama_scorer_model` line:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"

    langsmith_api_key: str = ""
    langsmith_tracing: bool = False
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_project: str = "memory-weave"

    # Working memory
    working_memory_max_turns: int = 10

    # Episodic memory
    episodic_importance_threshold: float = 0.4
    episodic_decay_lambda: float = 0.05
    episodic_decay_interval: int = 5
    episodic_top_k: int = 5
    episodic_min_importance: float = 0.05

    # Knowledge graph
    kg_reinforcement_factor: float = 1.2
    kg_decay_factor: float = 0.95
    kg_min_edge_weight: float = 0.1
    kg_traversal_hops: int = 2
    kg_decay_interval: int = 5

    # Orchestrator
    context_token_budget: int = 2000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 8: Run all tests**

```
uv run pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add memoryweave/agents/kg_agent.py memoryweave/agents/episodic_memory.py memoryweave/agents/graph.py memoryweave/core/llm.py memoryweave/core/config.py tests/test_fused_extraction.py
git commit -m "perf: fuse score+extract into one LLM call, remove scorer model"
```

---

## Task 4: Mac Metal GPU optimization via Ollama settings

**Files:**
- Modify: `memoryweave/core/llm.py`
- Modify: `.env` (or `.env.example`)

On Apple Silicon, Ollama uses Metal for GPU acceleration. Without explicit settings, it may not offload all transformer layers to GPU, and flash attention is disabled by default. These two env vars + num_gpu flag are the highest-impact knobs.

- [ ] **Step 1: Add Ollama Metal env vars to `.env`**

Add these lines to your `.env` file (create it if it doesn't exist):

```bash
# Mac Metal GPU optimization
OLLAMA_FLASH_ATTENTION=1
OLLAMA_KV_CACHE_TYPE=q8_0
```

`OLLAMA_FLASH_ATTENTION=1` enables Flash Attention on Metal — reduces memory bandwidth and speeds up attention computation significantly. `OLLAMA_KV_CACHE_TYPE=q8_0` quantizes the KV cache, cutting VRAM usage and allowing more layers to stay on GPU.

These are Ollama server env vars — set them in your shell before starting Ollama, or add to `~/.zshrc`:

```bash
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
```

Then restart Ollama: `pkill ollama && ollama serve`

- [ ] **Step 2: Add `num_gpu` and `num_ctx` to ChatOllama constructors**

In `memoryweave/core/llm.py`, update both constructors:

```python
from langchain_ollama import ChatOllama

from memoryweave.core.config import settings


def get_llm(temperature: float = 0.7) -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
        num_gpu=99,   # offload all layers to Metal (99 = "as many as fit")
        num_ctx=4096,
    )


def get_extraction_llm() -> ChatOllama:
    """JSON-mode LLM for structured entity extraction and importance scoring — temp=0."""
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json",
        num_gpu=99,
        num_ctx=2048,
    )


def extract_text(content: str | list) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("text", "")
    return str(content)
```

`num_gpu=99` tells Ollama to offload as many layers as will fit in GPU memory (Ollama clamps this to the actual layer count). `num_ctx=4096` matches our context budget with headroom; smaller values reduce VRAM per request.

- [ ] **Step 3: Verify GPU is being used**

Run this after restarting Ollama and sending one message through the CLI:

```bash
ollama ps
```

Expected output shows your model with a `GPU` column showing non-zero utilization (e.g., `100%`). If it shows `CPU` only, check that `OLLAMA_FLASH_ATTENTION=1` was set before `ollama serve`.

- [ ] **Step 4: Commit**

```bash
git add memoryweave/core/llm.py
git commit -m "perf: add num_gpu and num_ctx to Ollama clients for Metal GPU utilization"
```

---

## Expected Latency Improvement

| Change | Before | After | Saving |
|---|---|---|---|
| Decay throttle (episodic) | ChromaDB full scan every turn | Every 5 turns | ~4/5 turns skip 200-500ms I/O |
| Decay throttle (KG) | All edges iterated every turn | Every 5 turns | Negligible but cumulative |
| Fused score+extract | 2 LLM calls sequential | 1 LLM call | Saves ~1-3s (gemma4:e2b call) |
| Metal flash attention | Default attention | Flash attention | ~20-40% faster token generation |
| num_gpu=99 | Auto-detected (may be conservative) | All layers on Metal | Model-dependent; up to 2x |

Total expected improvement: **40-60% reduction in per-turn latency** for typical turns.

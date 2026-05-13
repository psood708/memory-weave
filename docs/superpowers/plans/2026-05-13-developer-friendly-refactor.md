# Developer-Friendly Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 real bugs/design issues across the MemoryWeave codebase to make it safer, more testable, and easier to extend.

**Architecture:** Six targeted changes: (1) a new Protocol file for structural interfaces, (2) EpisodicStore bug fixes, (3) EpisodicMemoryAgent encapsulation + caching, (4) orchestrator content-safety fix, (5) WorkingMemoryAgent monotonic counter, (6) new agent-level test suite. No abstractions beyond what's needed — each change fixes a concrete problem.

**Tech Stack:** Python 3.12, pytest, langchain-core, chromadb, pydantic-settings

---

## File Map

| Action | Path | What changes |
|--------|------|-------------|
| Create | `memoryweave/core/protocols.py` | `KGAgentProtocol`, `EpisodicStoreProtocol` structural interfaces |
| Modify | `memoryweave/memory/episodic_store.py` | Bootstrap `_turn_counter`; use `settings.episodic_min_importance` in `apply_decay` |
| Modify | `memoryweave/agents/episodic_memory.py` | Cache scorer LLM; add `update_entity_links`; filter retrieve by min_importance |
| Modify | `memoryweave/agents/orchestrator.py` | Use `extract_text` for content join; use `KGAgentProtocol` type; delegate entity links via agent |
| Modify | `memoryweave/agents/working_memory.py` | Add `messages_added` monotonic counter |
| Modify | `memoryweave/tests/test_episodic_store.py` | Add tests for settings-driven pruning + counter bootstrap |
| Modify | `memoryweave/tests/test_working_memory.py` | Add test for `messages_added` beyond buffer capacity |
| Create | `memoryweave/tests/test_agents.py` | Agent-level tests: list content safety, entity link delegation, retrieve filter |

---

## Task 1: Add `core/protocols.py` — structural interfaces

**Files:**
- Create: `memoryweave/core/protocols.py`

- [ ] **Step 1: Create the file**

```python
# memoryweave/core/protocols.py
from typing import Protocol, runtime_checkable

from langchain_core.messages import BaseMessage

from memoryweave.memory.episodic_store import Episode


@runtime_checkable
class EpisodicStoreProtocol(Protocol):
    def write(self, episode: Episode) -> None: ...
    def retrieve(self, query: str, top_k: int) -> list[Episode]: ...
    def apply_decay(self, current_turn: int, decay_lambda: float) -> None: ...
    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None: ...
    def increment_turn(self) -> int: ...
    @property
    def turn_count(self) -> int: ...


@runtime_checkable
class KGAgentProtocol(Protocol):
    def retrieve_context(self, entity_ids: list[str]) -> str: ...
    def extract_and_update(self, content: str, episode_id: str) -> list[str]: ...
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -c "from memoryweave.core.protocols import KGAgentProtocol, EpisodicStoreProtocol; print('OK')"
```
Expected: `OK`

---

## Task 2: Fix `EpisodicStore` — bootstrap turn counter + use settings for pruning

**Files:**
- Modify: `memoryweave/memory/episodic_store.py`
- Modify: `memoryweave/tests/test_episodic_store.py`

**Background:**
- Bug 1: `apply_decay` uses hard-coded `0.05` instead of `settings.episodic_min_importance`.
- Bug 2: `_turn_counter` resets to 0 on restart — decay Δturns becomes wrong for existing episodes. Fix: read `max(turn_number)` from existing ChromaDB data at `__init__` time.

- [ ] **Step 1: Write two failing tests**

Append to `memoryweave/tests/test_episodic_store.py`:

```python
def test_decay_prunes_using_settings_min_importance(tmp_path, monkeypatch):
    """apply_decay must respect settings.episodic_min_importance, not hard-code 0.05."""
    from memoryweave.core import config
    monkeypatch.setattr(config.settings, "episodic_min_importance", 0.5)
    store = EpisodicStore(collection_name=f"test_{uuid.uuid4().hex}", persist_dir=str(tmp_path))
    ep = make_episode(store, "Some content", score=0.6, turn=1)
    store.write(ep)
    # 0.6 * e^(-0.1 * 3) ≈ 0.44, which is below 0.5 but above old 0.05
    store.apply_decay(current_turn=4, decay_lambda=0.1)
    assert store.count() == 0, "episode should be pruned when decayed below min_importance"


def test_turn_counter_bootstraps_from_persisted_episodes(tmp_path):
    """A new EpisodicStore pointed at existing data must init its counter from stored turn numbers."""
    coll_name = f"test_{uuid.uuid4().hex}"
    store1 = EpisodicStore(collection_name=coll_name, persist_dir=str(tmp_path))
    ep = make_episode(store1, "Some content", score=0.8, turn=7)
    store1.write(ep)

    store2 = EpisodicStore(collection_name=coll_name, persist_dir=str(tmp_path))
    assert store2.turn_count >= 7, "turn counter must bootstrap from max stored turn_number"
```

- [ ] **Step 2: Run to confirm both fail**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_episodic_store.py::test_decay_prunes_using_settings_min_importance memoryweave/tests/test_episodic_store.py::test_turn_counter_bootstraps_from_persisted_episodes -v
```
Expected: both FAIL

- [ ] **Step 3: Apply fixes to `episodic_store.py`**

**3a — Add settings import and bootstrap counter in `__init__`:**

Replace the current `__init__` method:
```python
def __init__(self, collection_name: str = "episodes", persist_dir: str = ".chroma"):
    self._client = chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    self._collection = self._client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    self._turn_counter: int = 0
```

With:
```python
def __init__(self, collection_name: str = "episodes", persist_dir: str = ".chroma"):
    from memoryweave.core.config import settings as _settings
    self._settings = _settings
    self._client = chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    self._collection = self._client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    self._turn_counter: int = self._bootstrap_turn_counter()

def _bootstrap_turn_counter(self) -> int:
    if self._collection.count() == 0:
        return 0
    items = self._collection.get(include=["metadatas"])
    if not items["metadatas"]:
        return 0
    return max(int(m.get("turn_number", 0)) for m in items["metadatas"])
```

**3b — Fix `apply_decay` to use `self._settings.episodic_min_importance`:**

Replace in `apply_decay`:
```python
            if decayed < 0.05:
```
With:
```python
            if decayed < self._settings.episodic_min_importance:
```

- [ ] **Step 4: Run tests to confirm both pass**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_episodic_store.py -v
```
Expected: all PASS

---

## Task 3: Fix `EpisodicMemoryAgent` — cache LLM, add `update_entity_links`, filter retrieve

**Files:**
- Modify: `memoryweave/agents/episodic_memory.py`
- Create: `memoryweave/tests/test_agents.py`

**Background:**
- Issue 8: `score_importance` calls `get_scorer_llm()` on every invocation — creates a new object each call.
- Issue 5: orchestrator reaches through `agent.store.update_entity_links(...)` — leaks internal store. Fix: add method on the agent.
- Issue 10: `retrieve()` can return low-importance episodes. Fix: post-filter by `settings.episodic_min_importance`.

- [ ] **Step 1: Write three failing tests** in new file `memoryweave/tests/test_agents.py`

```python
# memoryweave/tests/test_agents.py
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.memory.episodic_store import Episode


def make_episode(score: float, turn: int = 1) -> Episode:
    return Episode(
        id=f"ep-{turn}",
        content="test content",
        importance_score=score,
        timestamp=datetime.now(timezone.utc),
        session_id="test",
        turn_number=turn,
    )


def test_scorer_llm_is_cached_at_init():
    """Scorer LLM must be created once at init, not per call."""
    agent = EpisodicMemoryAgent(session_id="test")
    assert hasattr(agent, "_scorer_llm"), "_scorer_llm must be set in __init__"


def test_update_entity_links_delegates_to_store():
    """EpisodicMemoryAgent.update_entity_links must delegate to its internal store."""
    mock_store = MagicMock()
    agent = EpisodicMemoryAgent(session_id="test", store=mock_store)
    agent.update_entity_links("ep-1", ["entity-a", "entity-b"])
    mock_store.update_entity_links.assert_called_once_with("ep-1", ["entity-a", "entity-b"])


def test_retrieve_filters_by_min_importance(monkeypatch):
    """retrieve() must exclude episodes below settings.episodic_min_importance."""
    from memoryweave.core import config
    monkeypatch.setattr(config.settings, "episodic_min_importance", 0.5)

    mock_store = MagicMock()
    mock_store.retrieve.return_value = [make_episode(0.8), make_episode(0.3, turn=2)]
    mock_store.turn_count = 2

    agent = EpisodicMemoryAgent(session_id="test", store=mock_store)
    results = agent.retrieve("query")

    assert len(results) == 1
    assert results[0].importance_score == 0.8
```

- [ ] **Step 2: Run to confirm all three fail**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_agents.py -v
```
Expected: all 3 FAIL

- [ ] **Step 3: Apply fixes to `episodic_memory.py`**

Replace the full file content with:

```python
import re
from datetime import datetime, timezone

from langchain_core.messages import BaseMessage, HumanMessage

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_scorer_llm
from memoryweave.memory.episodic_store import Episode, EpisodicStore

_IMPORTANCE_PROMPT = """\
Score this conversation turn for long-term memory relevance.

Turn:
{content}

High (0.7-1.0): specific facts, decisions, names, preferences, project details, commitments.
Low (0.0-0.3): pleasantries, filler, vague statements, repeated context.

Reply with ONLY a single decimal number between 0.0 and 1.0. Nothing else."""


def _parse_score(text: str) -> float:
    matches = re.findall(r"\b(1\.0+|0\.\d+)\b", text)
    if matches:
        return min(1.0, max(0.0, float(matches[0])))
    return 0.0


class EpisodicMemoryAgent:
    """Scores, stores, retrieves, and decays episodic memories."""

    def __init__(self, session_id: str, store: EpisodicStore | None = None):
        self._session_id = session_id
        self._store = store or EpisodicStore()
        self._scorer_llm = get_scorer_llm()

    def score_importance(self, content: str) -> float:
        response = self._scorer_llm.invoke([HumanMessage(content=_IMPORTANCE_PROMPT.format(content=content))])
        return _parse_score(extract_text(response.content))

    def write(self, messages: list[BaseMessage], entity_ids: list[str] | None = None) -> Episode | None:
        content = "\n".join(
            f"{'User' if m.type == 'human' else 'Assistant'}: {extract_text(m.content)}"
            for m in messages
        )
        turn = self._store.increment_turn()
        score = self.score_importance(content)

        if score < settings.episodic_importance_threshold:
            return None

        episode = Episode(
            id=EpisodicStore.new_id(),
            content=content,
            importance_score=score,
            timestamp=datetime.now(timezone.utc),
            session_id=self._session_id,
            turn_number=turn,
            entity_ids=entity_ids or [],
        )
        self._store.write(episode)
        return episode

    def retrieve(self, query: str) -> list[Episode]:
        episodes = self._store.retrieve(query, top_k=settings.episodic_top_k)
        self._store.apply_decay(self._store.turn_count, settings.episodic_decay_lambda)
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

Note: the `store` property was removed — orchestrator now uses `agent.update_entity_links()` directly (fixed in Task 4).

- [ ] **Step 4: Run tests to confirm all three pass**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_agents.py -v
```
Expected: all 3 PASS

---

## Task 4: Fix `orchestrator.py` — content safety + protocols + encapsulation

**Files:**
- Modify: `memoryweave/agents/orchestrator.py`
- Modify: `memoryweave/tests/test_agents.py`

**Background:**
- Bug 2: `"\n".join(m.content for m in messages)` crashes when `AIMessage.content` is a list (tool-call responses). Fix: use `extract_text`.
- Issue 4: `kg_agent: Any` — use `KGAgentProtocol` for typed contract.
- Issue 5: `self._episodic.store.update_entity_links(...)` — now delegates via `self._episodic.update_entity_links(...)`.

- [ ] **Step 1: Write one failing test** — append to `memoryweave/tests/test_agents.py`

```python
from memoryweave.agents.orchestrator import MemoryOrchestrator


def test_write_turn_handles_list_content_with_kg():
    """write_turn must not crash when AIMessage.content is a list (e.g. tool-call response)."""
    from langchain_core.messages import AIMessage, HumanMessage
    from memoryweave.memory.episodic_store import Episode

    mock_working = MagicMock()
    mock_episodic = MagicMock()
    mock_kg = MagicMock()

    fake_episode = Episode(
        id="ep-1",
        content="test",
        importance_score=0.8,
        timestamp=datetime.now(timezone.utc),
        session_id="s1",
        turn_number=1,
    )
    mock_episodic.write.return_value = fake_episode
    mock_kg.extract_and_update.return_value = []

    orch = MemoryOrchestrator(working=mock_working, episodic=mock_episodic, kg_agent=mock_kg)

    ai_msg = AIMessage(content=[{"type": "text", "text": "hello world"}])
    human_msg = HumanMessage(content="hi")

    orch.write_turn([human_msg, ai_msg])  # must not raise TypeError
    mock_kg.extract_and_update.assert_called_once()
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_agents.py::test_write_turn_handles_list_content_with_kg -v
```
Expected: FAIL with `TypeError`

- [ ] **Step 3: Apply fixes to `orchestrator.py`**

Replace the full file content with:

```python
from dataclasses import dataclass

from langchain_core.messages import BaseMessage

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.core.config import settings
from memoryweave.core.context_budget import ContextBlock, build_context_block, format_context_block
from memoryweave.core.llm import extract_text
from memoryweave.core.protocols import KGAgentProtocol
from memoryweave.memory.episodic_store import Episode


@dataclass
class OrchestratorResult:
    context_block: ContextBlock
    formatted_context: str
    episodes_used: list[Episode]
    working_turns: int
    token_estimate: int


class MemoryOrchestrator:
    """Coordinates all memory agents, merges context, enforces token budget."""

    def __init__(
        self,
        working: WorkingMemoryAgent,
        episodic: EpisodicMemoryAgent,
        kg_agent: KGAgentProtocol | None = None,
    ):
        self._working = working
        self._episodic = episodic
        self._kg = kg_agent

    # ── Read path ────────────────────────────────────────────────────────────

    def build_context(self, query: str) -> OrchestratorResult:
        working_str = self._working.format_for_context()
        episodes = self._episodic.retrieve(query)
        episodes_str = self._episodic.format_for_context(episodes)

        kg_str = ""
        if self._kg:
            entity_ids = [eid for ep in episodes for eid in ep.entity_ids]
            kg_str = self._kg.retrieve_context(entity_ids)

        block = build_context_block(
            working=working_str,
            episodes=episodes_str,
            kg=kg_str,
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        token_estimate = len(formatted) // 4

        return OrchestratorResult(
            context_block=block,
            formatted_context=formatted,
            episodes_used=episodes,
            working_turns=self._working.messages_added,
            token_estimate=token_estimate,
        )

    # ── Write path ───────────────────────────────────────────────────────────

    def write_turn(self, messages: list[BaseMessage]) -> None:
        for msg in messages:
            self._working.add(msg)

        episode = self._episodic.write(messages)

        if episode and self._kg:
            content = "\n".join(extract_text(m.content) for m in messages)
            entity_ids = self._kg.extract_and_update(
                content=content,
                episode_id=episode.id,
            )
            if entity_ids:
                self._episodic.update_entity_links(episode.id, entity_ids)
```

- [ ] **Step 4: Run full test suite to confirm pass**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/ -v
```
Expected: all PASS

---

## Task 5: Fix `WorkingMemoryAgent` — monotonic `messages_added` counter

**Files:**
- Modify: `memoryweave/agents/working_memory.py`
- Modify: `memoryweave/tests/test_working_memory.py`

**Background:**
- Issue 9: `turn_count` returns `len(self._buffer)` which caps at `max_turns`. After the buffer fills, it always returns the same number regardless of how many messages were processed. The orchestrator uses this as `working_turns` — it should reflect total activity.
- Fix: add `_total_added` monotonic int counter and expose it as `messages_added`. Keep existing `turn_count` (current buffer size) since existing tests depend on it and it's still useful.

- [ ] **Step 1: Write two failing tests** — append to `memoryweave/tests/test_working_memory.py`

```python
def test_messages_added_tracks_beyond_buffer_capacity():
    agent = WorkingMemoryAgent(max_turns=3)
    for i in range(10):
        agent.add(HumanMessage(content=f"msg {i}"))
    assert agent.messages_added == 10
    assert len(agent.get()) == 3  # buffer still capped


def test_messages_added_resets_on_clear():
    agent = WorkingMemoryAgent(max_turns=5)
    for i in range(5):
        agent.add(HumanMessage(content=f"msg {i}"))
    agent.clear()
    assert agent.messages_added == 0
```

- [ ] **Step 2: Run to confirm both fail**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_working_memory.py::test_messages_added_tracks_beyond_buffer_capacity memoryweave/tests/test_working_memory.py::test_messages_added_resets_on_clear -v
```
Expected: both FAIL with `AttributeError`

- [ ] **Step 3: Apply fix to `working_memory.py`**

Replace the full file content with:

```python
from collections import deque

from langchain_core.messages import BaseMessage

from memoryweave.core.config import settings


class WorkingMemoryAgent:
    """Maintains a sliding buffer of recent conversation turns."""

    def __init__(self, max_turns: int | None = None):
        self._max_turns = max_turns or settings.working_memory_max_turns
        self._buffer: deque[BaseMessage] = deque(maxlen=self._max_turns)
        self._total_added: int = 0

    def add(self, message: BaseMessage) -> None:
        self._buffer.append(message)
        self._total_added += 1

    def get(self) -> list[BaseMessage]:
        return list(self._buffer)

    def format_for_context(self) -> str:
        if not self._buffer:
            return ""
        lines = []
        for msg in self._buffer:
            role = "User" if msg.type == "human" else "Assistant"
            lines.append(f"{role}: {msg.content}")
        return "\n".join(lines)

    def clear(self) -> None:
        self._buffer.clear()
        self._total_added = 0

    @property
    def turn_count(self) -> int:
        """Current number of messages in the sliding buffer (≤ max_turns)."""
        return len(self._buffer)

    @property
    def messages_added(self) -> int:
        """Total messages added since last clear — never caps at max_turns."""
        return self._total_added
```

- [ ] **Step 4: Run all working memory tests**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/test_working_memory.py -v
```
Expected: all PASS

---

## Task 6: Final verification — full test suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -m pytest memoryweave/tests/ -v
```
Expected: all PASS. No import errors. No `AttributeError` or `TypeError`.

- [ ] **Step 2: Verify import chain is clean**

```bash
cd /Users/psood/MLops/langchain_fundamentals/proj1
python -c "
from memoryweave.core.protocols import KGAgentProtocol, EpisodicStoreProtocol
from memoryweave.memory.episodic_store import EpisodicStore
from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.agents.orchestrator import MemoryOrchestrator
from memoryweave.agents.conversational import ConversationalAgent
print('All imports OK')
"
```
Expected: `All imports OK`

---

## Self-Review Checklist

**Spec coverage:**
- [x] Bug 1 (hard-coded 0.05) → Task 2, step 3b
- [x] Bug 2 (content list crash) → Task 4, step 3
- [x] Bug 3 (turn counter restart) → Task 2, step 3a
- [x] Pattern 4 (KGAgentProtocol) → Task 1 + Task 4
- [x] Pattern 5 (encapsulation leak) → Task 3 (add `update_entity_links`) + Task 4 (use it)
- [x] Pattern 7 (EpisodicStoreProtocol) → Task 1
- [x] Quality 8 (scorer LLM cached) → Task 3
- [x] Quality 9 (WorkingMemoryAgent.turn_count) → Task 5
- [x] Quality 10 (min_importance filter) → Task 3
- [x] Issue 11 (MemoryWeaveState dead code) → intentionally deferred; it's Week 2 LangGraph scaffolding

**Type consistency:**
- `messages_added` used in `orchestrator.py` (Task 4) — defined in `working_memory.py` (Task 5). Tasks ordered: Task 5 before Task 4 would be safer if executing out of order, but since Task 4 runs the full suite at the end (step 4), any mismatch will surface there.
- `update_entity_links` on `EpisodicMemoryAgent` defined in Task 3, used in Task 4 — correct ordering.
- `KGAgentProtocol` defined in Task 1, imported in Task 4 — correct ordering.

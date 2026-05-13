import math
import uuid
from datetime import datetime, timezone

import pytest

from memoryweave.memory.episodic_store import Episode, EpisodicStore


@pytest.fixture
def store(tmp_path):
    return EpisodicStore(collection_name=f"test_{uuid.uuid4().hex}", persist_dir=str(tmp_path))


def make_episode(store: EpisodicStore, content: str, score: float = 0.8, turn: int = 1) -> Episode:
    return Episode(
        id=EpisodicStore.new_id(),
        content=content,
        importance_score=score,
        timestamp=datetime.now(timezone.utc),
        session_id="test-session",
        turn_number=turn,
    )


def test_write_and_retrieve(store):
    ep = make_episode(store, "User discussed the ML pipeline architecture")
    store.write(ep)
    results = store.retrieve("ML pipeline", top_k=3)
    assert len(results) == 1
    assert "ML pipeline" in results[0].content


def test_decay_reduces_score(store):
    ep = make_episode(store, "Important meeting notes", score=0.9, turn=1)
    store.write(ep)
    store.apply_decay(current_turn=20, decay_lambda=0.05)
    results = store.retrieve("meeting notes", top_k=3)
    if results:
        expected = 0.9 * math.exp(-0.05 * 19)
        assert abs(results[0].importance_score - expected) < 0.01


def test_decay_prunes_low_score(store):
    ep = make_episode(store, "Trivial remark", score=0.1, turn=1)
    store.write(ep)
    store.apply_decay(current_turn=50, decay_lambda=0.05)
    assert store.count() == 0


def test_entity_link_update(store):
    ep = make_episode(store, "Alice joined the project")
    store.write(ep)
    store.update_entity_links(ep.id, ["entity-alice", "entity-project"])
    results = store.retrieve("Alice project", top_k=3)
    assert "entity-alice" in results[0].entity_ids


def test_token_budget_context(store):
    from memoryweave.core.context_budget import build_context_block
    block = build_context_block(
        working="recent turns",
        episodes="a" * 10000,
        kg="",
        token_budget=100,
    )
    total_chars = len(block.working_memory) + len(block.episodes) + len(block.kg_context)
    assert total_chars <= 100 * 4 + len("recent turns")

import uuid

import pytest

pytest.importorskip("qdrant_client")

from qdrant_client import QdrantClient

from memoryweave.memory.episodic_backend import QdrantEpisodicBackend

# Valid UUIDs for test IDs (Qdrant requires UUID format for string IDs)
_ID1 = "11111111-1111-1111-1111-111111111111"
_ID2 = "22222222-2222-2222-2222-222222222222"
_ID3 = "33333333-3333-3333-3333-333333333333"
_ID4 = "44444444-4444-4444-4444-444444444444"
_ID5 = "55555555-5555-5555-5555-555555555555"
_ID_A = str(uuid.uuid4())
_ID_B = str(uuid.uuid4())


def _meta(session_id: str, turn: int) -> dict:
    return {
        "session_id": session_id,
        "importance_score": "0.8",
        "turn_number": str(turn),
        "timestamp": "2024-01-01T00:00:00",
        "entity_ids": "",
    }


@pytest.fixture
def client():
    return QdrantClient(":memory:")


@pytest.fixture
def backend(client):
    return QdrantEpisodicBackend(session_id="sess1", client=client)


def test_upsert_and_query(backend):
    backend.upsert(
        ids=[_ID1],
        documents=["Paris is the capital of France"],
        metadatas=[_meta("sess1", 1)],
    )
    results = backend.query("capital city France", n_results=5)
    assert len(results) == 1
    id_, doc, meta = results[0]
    assert id_ == _ID1
    assert "France" in doc
    assert meta["session_id"] == "sess1"


def test_count_increments_on_upsert(backend):
    assert backend.count() == 0
    backend.upsert(ids=[_ID2], documents=["test doc"], metadatas=[_meta("sess1", 1)])
    assert backend.count() == 1


def test_delete_removes_point(backend):
    backend.upsert(ids=[_ID3], documents=["machine learning"], metadatas=[_meta("sess1", 2)])
    assert backend.count() == 1
    backend.delete([_ID3])
    assert backend.count() == 0


def test_get_all_returns_session_episodes(backend):
    backend.upsert(ids=[_ID4], documents=["neural nets"], metadatas=[_meta("sess1", 3)])
    items = backend.get_all()
    assert any(id_ == _ID4 for id_, _, _ in items)


def test_session_isolation(client):
    b1 = QdrantEpisodicBackend(session_id="sess-a", client=client)
    b2 = QdrantEpisodicBackend(session_id="sess-b", client=client)

    b1.upsert(
        ids=[_ID_A],
        documents=["sky is blue on earth"],
        metadatas=[_meta("sess-a", 1)],
    )

    results = b2.query("sky blue", n_results=5)
    assert all(meta.get("session_id") != "sess-a" for _, _, meta in results)
    assert b2.count() == 0


def test_update_entity_links(backend):
    backend.upsert(
        ids=[_ID5],
        documents=["Alice works at Anthropic"],
        metadatas=[_meta("sess1", 4)],
    )
    backend.update_entity_links(_ID5, ["Alice", "Anthropic"])
    items = backend.get_by_ids([_ID5])
    assert items
    _, _, meta = items[0]
    assert "Alice" in meta.get("entity_ids", "")
    assert "Anthropic" in meta.get("entity_ids", "")


def test_empty_collection_returns_safe_defaults(backend):
    assert backend.count() == 0
    assert backend.query("anything", n_results=5) == []
    assert backend.get_all() == []
    assert backend.get_by_ids([_ID1]) == []
    backend.delete([_ID1])  # should not raise

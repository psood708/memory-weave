import asyncio
import json
from datetime import datetime, timezone

import networkx as nx
import pytest

from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore


@pytest.fixture
def store(tmp_path):
    backend = FileKGBackend(str(tmp_path))
    s = KnowledgeGraphStore(backend=backend, user_id="u1")
    s.upsert_node("Alice", "Person", "engineer")
    s.upsert_node("Google", "Organization", "search company")
    s.upsert_node("Anthropic", "Organization", "AI company")
    return s


def test_upsert_edge_sets_validity_fields(store):
    store.upsert_edge("Alice", "Google", "works_at")
    data = store._graph["Alice"]["Google"]
    assert data["is_active"] == 1
    assert data["valid_until"] is None
    assert "valid_from" in data
    assert data["superseded_by"] is None


def test_soft_supersede_marks_old_inactive(store):
    store.upsert_edge("Alice", "Google", "works_at")
    store.upsert_edge("Alice", "Anthropic", "works_at")
    now = datetime.now(timezone.utc)
    store._soft_supersede("Alice", "Google", "Alice", "Anthropic", now)
    old = store._graph["Alice"]["Google"]
    assert old["is_active"] == 0
    assert old["valid_until"] is not None
    assert old["superseded_by"] == "Alice->Anthropic"


def test_traverse_excludes_inactive_edges(store):
    store.upsert_edge("Alice", "Google", "works_at")
    store.upsert_edge("Alice", "Anthropic", "works_at")
    store._soft_supersede("Alice", "Google", "Alice", "Anthropic")
    nodes = store.traverse(["Alice"], max_hops=1)
    node_names = [n for n, _ in nodes]
    assert "Anthropic" in node_names
    assert "Google" not in node_names


def test_format_context_excludes_inactive_edges(store):
    store.upsert_edge("Alice", "Google", "works_at")
    store.upsert_edge("Alice", "Anthropic", "works_at")
    store._soft_supersede("Alice", "Google", "Alice", "Anthropic")
    nodes = store.traverse(["Alice"], max_hops=1)
    ctx = store.format_context(nodes)
    assert "Anthropic" in ctx
    assert "Google" not in ctx


def test_load_backfills_validity_on_old_edges(tmp_path):
    """Old serialized graphs missing validity fields get defaults on load."""
    from unittest.mock import patch

    g = nx.DiGraph()
    g.add_node("Alice", type="Person", description="dev")
    g.add_node("Proj", type="Project", description="work")
    g.add_edge("Alice", "Proj", rel_type="works_on", weight=1.0)
    raw = json.dumps(nx.node_link_data(g))
    # FileKGBackend stores non-empty user_id at users/{user_id}/kg_store.json
    user_dir = tmp_path / "users" / "u1"
    user_dir.mkdir(parents=True)
    (user_dir / "kg_store.json").write_text(raw)
    backend = FileKGBackend(str(tmp_path))
    s = KnowledgeGraphStore(backend=backend, user_id="u1")
    with patch.object(KnowledgeGraphStore, "_rebuild_embeddings"):
        asyncio.run(s.load())
    data = s._graph["Alice"]["Proj"]
    assert data["is_active"] == 1
    assert data["valid_until"] is None


from memoryweave.agents.kg_agent import KGAgent, FusedResult, Entity, Relationship


def _make_agent(tmp_path):
    backend = FileKGBackend(str(tmp_path))
    store = KnowledgeGraphStore(backend=backend, user_id="u1")
    agent = KGAgent(store=store)
    return agent, store


def test_conflict_detection_supersedes_old_works_at(tmp_path):
    agent, store = _make_agent(tmp_path)
    fused1 = FusedResult(
        importance_score=0.9,
        entities=[
            Entity(name="Alice", type="Person", description="engineer"),
            Entity(name="Google", type="Organization", description="tech co"),
        ],
        relationships=[Relationship(source="Alice", target="Google", rel_type="works_at")],
    )
    agent.update_graph_sync(fused1, "ep1")
    assert store._graph["Alice"]["Google"]["is_active"] == 1

    fused2 = FusedResult(
        importance_score=0.9,
        entities=[
            Entity(name="Alice", type="Person", description="engineer"),
            Entity(name="Anthropic", type="Organization", description="AI co"),
        ],
        relationships=[Relationship(source="Alice", target="Anthropic", rel_type="works_at")],
    )
    agent.update_graph_sync(fused2, "ep2")

    assert store._graph["Alice"]["Google"]["is_active"] == 0
    assert store._graph["Alice"]["Google"]["superseded_by"] == "Alice->Anthropic"
    assert store._graph["Alice"]["Anthropic"]["is_active"] == 1


def test_additive_rel_type_not_superseded(tmp_path):
    """rel_type='uses' is not single-valued — both edges stay active."""
    agent, store = _make_agent(tmp_path)
    store.upsert_node("Alice", "Person", "engineer")
    store.upsert_node("Python", "Fact", "language")
    store.upsert_node("Rust", "Fact", "language")
    store.upsert_edge("Alice", "Python", "uses")

    fused = FusedResult(
        importance_score=0.9,
        entities=[Entity(name="Rust", type="Fact", description="language")],
        relationships=[Relationship(source="Alice", target="Rust", rel_type="uses")],
    )
    agent.update_graph_sync(fused, "ep1")

    assert store._graph["Alice"]["Python"]["is_active"] == 1
    assert store._graph["Alice"]["Rust"]["is_active"] == 1


def test_same_target_no_supersession(tmp_path):
    """Reinserting the same (source, target, rel_type) must not supersede itself."""
    agent, store = _make_agent(tmp_path)
    fused = FusedResult(
        importance_score=0.9,
        entities=[
            Entity(name="Alice", type="Person", description="engineer"),
            Entity(name="Anthropic", type="Organization", description="AI co"),
        ],
        relationships=[Relationship(source="Alice", target="Anthropic", rel_type="works_at")],
    )
    agent.update_graph_sync(fused, "ep1")
    agent.update_graph_sync(fused, "ep2")  # same facts again
    assert store._graph["Alice"]["Anthropic"]["is_active"] == 1


from memoryweave.memory.episodic_store import Episode, EpisodicStore


class _MemEpisodicBackend:
    """Minimal in-memory episodic backend for testing (no Chroma/Qdrant needed)."""

    def __init__(self):
        self._store: dict[str, tuple[str, dict]] = {}

    def upsert(self, ids, documents, metadatas):
        for id_, doc, meta in zip(ids, documents, metadatas):
            self._store[id_] = (doc, {**meta})

    def query(self, query_text, n_results, where=None):
        items = [(id_, doc, meta) for id_, (doc, meta) in self._store.items()]
        if where:
            def _matches(meta, where):
                for k, v in where.items():
                    meta_val = meta.get(k)
                    if isinstance(v, dict):
                        if "$eq" in v and meta_val != v["$eq"]:
                            return False
                    elif meta_val != v:
                        return False
                return True
            items = [(id_, doc, meta) for id_, doc, meta in items if _matches(meta, where)]
        return items[:n_results]

    def get_all(self):
        return [(id_, doc, meta) for id_, (doc, meta) in self._store.items()]

    def get_by_ids(self, ids):
        return [(id_, doc, meta) for id_, (doc, meta) in self._store.items() if id_ in ids]

    def delete(self, ids):
        for id_ in ids:
            self._store.pop(id_, None)

    def count(self):
        return len(self._store)

    def update_entity_links(self, episode_id, entity_ids):
        if episode_id in self._store:
            doc, meta = self._store[episode_id]
            meta["entity_ids"] = ",".join(entity_ids)


def _ep(id_: str, turn: int) -> Episode:
    return Episode(
        id=id_,
        content=f"content {id_}",
        importance_score=0.9,
        timestamp=datetime.now(timezone.utc),
        session_id="s1",
        turn_number=turn,
        entity_ids=[],
    )


def test_episode_to_metadata_includes_validity():
    ep = _ep("ep1", 1)
    meta = ep.to_metadata()
    assert meta["is_active"] == 1
    assert meta["valid_until"] == ""
    assert "valid_from" in meta


def test_episode_from_metadata_roundtrip():
    ep = _ep("ep1", 1)
    meta = ep.to_metadata()
    recovered = Episode.from_metadata("ep1", "content ep1", meta)
    assert recovered.is_active is True
    assert recovered.valid_until is None


def test_episodic_retrieve_excludes_inactive():
    backend = _MemEpisodicBackend()
    store = EpisodicStore(backend=backend)
    store.write(_ep("ep1", 1))
    store.write(_ep("ep2", 2))
    store.mark_episode_inactive("ep1")
    results = store.retrieve("content")
    ids = [ep.id for ep in results]
    assert "ep2" in ids
    assert "ep1" not in ids


def test_mark_episode_inactive_nonexistent_id_no_raise():
    backend = _MemEpisodicBackend()
    store = EpisodicStore(backend=backend)
    store.mark_episode_inactive("nonexistent")  # should not raise


def test_full_supersession_flow_two_turns(tmp_path):
    """
    Turn 1: 'Alice works at Google'
    Turn 2: 'Alice works at Anthropic'
    After turn 2: Google edge inactive, Anthropic edge active,
    context retrieved for 'where does Alice work' contains Anthropic only.
    """
    agent, store = _make_agent(tmp_path)

    fused1 = FusedResult(
        importance_score=0.9,
        entities=[
            Entity(name="Alice", type="Person", description="engineer"),
            Entity(name="Google", type="Organization", description="tech company"),
        ],
        relationships=[Relationship(source="Alice", target="Google", rel_type="works_at")],
    )
    agent.update_graph_sync(fused1, "ep1")

    fused2 = FusedResult(
        importance_score=0.9,
        entities=[
            Entity(name="Alice", type="Person", description="engineer"),
            Entity(name="Anthropic", type="Organization", description="AI company"),
        ],
        relationships=[Relationship(source="Alice", target="Anthropic", rel_type="works_at")],
    )
    agent.update_graph_sync(fused2, "ep2")

    assert store._graph["Alice"]["Google"]["is_active"] == 0
    assert store._graph["Alice"]["Google"]["superseded_by"] == "Alice->Anthropic"
    assert store._graph["Alice"]["Anthropic"]["is_active"] == 1

    seeds = agent.find_seed_nodes("where does Alice work")
    ctx = agent.retrieve_context(seeds)
    assert "Anthropic" in ctx
    assert "Google" not in ctx

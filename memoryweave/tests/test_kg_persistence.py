import os

import pytest

from memoryweave.memory.kg_store import KnowledgeGraphStore


@pytest.fixture
def path(tmp_path):
    return str(tmp_path / "kg.json")


def test_save_and_reload(path):
    store = KnowledgeGraphStore(persist_path=path)
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=0.8)
    store.save()

    store2 = KnowledgeGraphStore(persist_path=path)
    assert store2.node_count == 2
    assert store2.edge_count == 1
    assert abs(store2._graph["Alice"]["Proj"]["weight"] - 0.8) < 0.001


def test_reload_preserves_traversal(path):
    store = KnowledgeGraphStore(persist_path=path)
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=1.0)
    store.save()

    store2 = KnowledgeGraphStore(persist_path=path)
    nodes = store2.traverse(["Alice"], max_hops=1)
    assert nodes[0][0] == "Proj"


def test_atomic_write_creates_file(path):
    store = KnowledgeGraphStore(persist_path=path)
    store.upsert_node("X", "Fact", "something")
    store.save()
    assert os.path.exists(path)
    assert not os.path.exists(f".{path}.tmp")


def test_empty_graph_on_fresh_start(path):
    store = KnowledgeGraphStore(persist_path=path)
    assert store.node_count == 0
    assert store.edge_count == 0

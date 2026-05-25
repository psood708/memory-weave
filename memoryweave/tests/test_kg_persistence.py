import pytest

from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore

pytestmark = pytest.mark.asyncio


def _store(tmp_path, user_id: str = "test_user") -> KnowledgeGraphStore:
    backend = FileKGBackend(str(tmp_path))
    return KnowledgeGraphStore(backend=backend, user_id=user_id)


async def test_save_and_reload(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=0.8)
    await store.save()

    store2 = _store(tmp_path)
    await store2.load()
    assert store2.node_count == 2
    assert store2.edge_count == 1
    assert abs(store2._graph["Alice"]["Proj"]["weight"] - 0.8) < 0.001


async def test_reload_preserves_traversal(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=1.0)
    await store.save()

    store2 = _store(tmp_path)
    await store2.load()
    nodes = store2.traverse(["Alice"], max_hops=1)
    assert nodes[0][0] == "Proj"


async def test_empty_graph_on_fresh_start(tmp_path):
    store = _store(tmp_path, user_id="fresh_user")
    assert store.node_count == 0
    assert store.edge_count == 0


async def test_clear_wipes_persisted_graph(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("X", "Fact", "something")
    await store.save()
    await store.clear()

    store2 = _store(tmp_path)
    await store2.load()
    assert store2.node_count == 0

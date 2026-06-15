import pytest

from memoryweave.core.state import MemoryWeaveState
from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore


def test_state_shape():
    state: MemoryWeaveState = {
        "user_input": "hello",
        "working_context": "",
        "episodes": [],
        "episode_context": "",
        "kg_context": "",
        "formatted_context": "",
        "response": "",
        "token_estimate": 0,
    }
    assert state["user_input"] == "hello"
    assert state["token_estimate"] == 0


@pytest.fixture
def store(tmp_path):
    backend = FileKGBackend(str(tmp_path))
    return KnowledgeGraphStore(backend=backend, user_id="test_user")


def test_upsert_node(store):
    store.upsert_node("Alice", "Person", "a developer")
    assert store.node_count == 1


def test_upsert_node_updates_description(store):
    store.upsert_node("Alice", "Person", "old desc")
    store.upsert_node("Alice", "Person", "new desc")
    assert store.node_count == 1
    assert store._graph.nodes["Alice"]["description"] == "new desc"


def test_upsert_edge(store):
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on")
    assert store.edge_count == 1


def test_upsert_edge_does_not_overwrite_weight(store):
    store.upsert_node("A", "Person", "")
    store.upsert_node("B", "Project", "")
    store.upsert_edge("A", "B", "works_on", weight=1.0)
    store.upsert_edge("A", "B", "works_on", weight=99.0)
    assert store._graph["A"]["B"]["weight"] == 1.0


def test_traverse_one_hop(store):
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=1.0)
    nodes = store.traverse(["Alice"], max_hops=1)
    node_names = [n for n, _ in nodes]
    assert "Alice" in node_names
    assert "Proj" in node_names


def test_traverse_two_hops(store):
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_node("Tool", "Organization", "a tool")
    store.upsert_edge("Alice", "Proj", "works_on", weight=1.0)
    store.upsert_edge("Proj", "Tool", "uses", weight=1.0)
    nodes = store.traverse(["Alice"], max_hops=2)
    node_names = [n for n, _ in nodes]
    assert "Proj" in node_names
    assert "Tool" in node_names


def test_traverse_unknown_seed_returns_empty(store):
    nodes = store.traverse(["Ghost"], max_hops=2)
    assert nodes == []


def test_traverse_prioritises_higher_weight(store):
    store.upsert_node("Root", "Person", "")
    store.upsert_node("Strong", "Project", "")
    store.upsert_node("Weak", "Project", "")
    store.upsert_edge("Root", "Strong", "a", weight=2.0)
    store.upsert_edge("Root", "Weak", "b", weight=0.1)
    nodes = store.traverse(["Root"], max_hops=1, node_budget=2)
    non_seed = [n for n, _ in nodes if n != "Root"]
    assert non_seed[0] == "Strong"


def test_hebbian_reinforcement(store):
    store.upsert_node("A", "Person", "")
    store.upsert_node("B", "Project", "")
    store.upsert_edge("A", "B", "works_on", weight=1.0)
    store.traverse(["A"], max_hops=1)
    assert store._graph["A"]["B"]["weight"] > 1.0


def test_decay_all(store):
    store.upsert_node("A", "Person", "")
    store.upsert_node("B", "Project", "")
    store.upsert_edge("A", "B", "works_on", weight=1.0)
    store.decay_all()
    assert store._graph["A"]["B"]["weight"] < 1.0


def test_prune_removes_weak_edges_and_orphans(store):
    store.upsert_node("A", "Person", "")
    store.upsert_node("B", "Project", "")
    store.upsert_edge("A", "B", "works_on", weight=0.05)
    store.prune()
    assert store.edge_count == 0
    assert store.node_count == 0


def test_format_context_includes_entities_and_relations(store):
    store.upsert_node("Alice", "Person", "a developer")
    store.upsert_node("Proj", "Project", "a project")
    store.upsert_edge("Alice", "Proj", "works_on", weight=1.0)
    nodes = store.traverse(["Alice"], max_hops=1)
    ctx = store.format_context(nodes)
    assert "Proj" in ctx
    assert "works on" in ctx

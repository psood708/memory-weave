from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore


def _store(tmp_path) -> KnowledgeGraphStore:
    backend = FileKGBackend(str(tmp_path))
    return KnowledgeGraphStore(backend=backend, user_id="test_user")


def test_two_hop_surfaces_indirect_entity(tmp_path):
    """KG surfaces LangGraph even though query only mentions Parth — 2-hop proof."""
    store = _store(tmp_path)
    store.upsert_node("Parth", "Person", "the user")
    store.upsert_node("MemoryWeave", "Project", "multi-agent memory system")
    store.upsert_node("LangGraph", "Organization", "orchestration framework")
    store.upsert_edge("Parth", "MemoryWeave", "works_on", weight=1.0)
    store.upsert_edge("MemoryWeave", "LangGraph", "uses", weight=1.0)

    nodes = store.traverse(["Parth"], max_hops=2)
    node_names = [name for name, _ in nodes]

    assert "MemoryWeave" in node_names
    assert "LangGraph" in node_names


def test_one_hop_does_not_surface_two_hop_entity(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("Parth", "Person", "the user")
    store.upsert_node("MemoryWeave", "Project", "multi-agent memory system")
    store.upsert_node("LangGraph", "Organization", "orchestration framework")
    store.upsert_edge("Parth", "MemoryWeave", "works_on", weight=1.0)
    store.upsert_edge("MemoryWeave", "LangGraph", "uses", weight=1.0)

    nodes = store.traverse(["Parth"], max_hops=1)
    node_names = [name for name, _ in nodes]

    assert "MemoryWeave" in node_names
    assert "LangGraph" not in node_names


def test_weighted_traversal_prefers_stronger_path(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("Root", "Person", "")
    store.upsert_node("Strong", "Project", "")
    store.upsert_node("Weak", "Project", "")
    store.upsert_edge("Root", "Strong", "a", weight=2.0)
    store.upsert_edge("Root", "Weak", "b", weight=0.1)

    nodes = store.traverse(["Root"], max_hops=1, node_budget=1)
    assert nodes[0][0] == "Strong"


def test_context_string_includes_relationship_type(tmp_path):
    store = _store(tmp_path)
    store.upsert_node("Parth", "Person", "the user")
    store.upsert_node("MemoryWeave", "Project", "multi-agent memory system")
    store.upsert_edge("Parth", "MemoryWeave", "works_on", weight=1.0)

    nodes = store.traverse(["Parth"], max_hops=1)
    ctx = store.format_context(nodes)

    assert "MemoryWeave" in ctx
    assert "works_on" in ctx


def test_empty_graph_returns_empty_context(tmp_path):
    store = _store(tmp_path)
    nodes = store.traverse(["Parth"], max_hops=2)
    assert nodes == []
    assert store.format_context(nodes) == ""

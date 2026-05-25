import pytest

from memoryweave.agents.kg_agent import KGAgent
from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore


@pytest.fixture
def agent(tmp_path):
    backend = FileKGBackend(str(tmp_path))
    store = KnowledgeGraphStore(backend=backend, user_id="test_user")
    return KGAgent(store=store)


def test_fused_extract_returns_entities(agent):
    turn = (
        "User: My name is Parth and I'm building MemoryWeave using LangGraph.\n"
        "Assistant: That sounds great, Parth!"
    )
    result = agent.fused_extract(turn)
    names = [e.name.lower() for e in result.entities]
    assert any("parth" in n for n in names), f"Expected 'Parth' in {names}"


def test_fused_extract_returns_relationships(agent):
    turn = (
        "User: I'm building MemoryWeave and it uses LangGraph.\n"
        "Assistant: Got it!"
    )
    result = agent.fused_extract(turn)
    assert len(result.relationships) > 0


def test_fused_extract_fails_gracefully_on_empty(agent):
    result = agent.fused_extract("")
    assert result.entities == []
    assert result.relationships == []


def test_update_graph_sync_populates_graph(agent):
    turn = (
        "User: I prefer writing terse code without comments.\n"
        "Assistant: Noted!"
    )
    fused = agent.fused_extract(turn)
    entity_names = agent.update_graph_sync(fused, episode_id="ep-1")
    assert agent.store.node_count > 0
    assert isinstance(entity_names, list)


def test_retrieve_context_returns_string(agent):
    fused = agent.fused_extract(
        "User: Parth is building MemoryWeave.\nAssistant: OK"
    )
    agent.update_graph_sync(fused, episode_id="ep-2")
    ctx = agent.retrieve_context(["Parth"])
    assert isinstance(ctx, str)

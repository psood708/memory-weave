import pytest

from memoryweave.agents.kg_agent import KGAgent
from memoryweave.memory.kg_store import KnowledgeGraphStore


@pytest.fixture
def agent(tmp_path):
    store = KnowledgeGraphStore(persist_path=str(tmp_path / "kg.json"))
    return KGAgent(store=store)


def test_extraction_returns_entities(agent):
    turn = (
        "User: My name is Parth and I'm building MemoryWeave using LangGraph.\n"
        "Assistant: That sounds great, Parth!"
    )
    result = agent._extract(turn)
    names = [e.name.lower() for e in result.entities]
    assert any("parth" in n for n in names), f"Expected 'Parth' in {names}"


def test_extraction_returns_relationships(agent):
    turn = (
        "User: I'm building MemoryWeave and it uses LangGraph.\n"
        "Assistant: Got it!"
    )
    result = agent._extract(turn)
    assert len(result.relationships) > 0


def test_extraction_fails_gracefully_on_empty(agent):
    result = agent._extract("")
    assert result.entities == []
    assert result.relationships == []


def test_extract_and_update_populates_graph(agent):
    turn = (
        "User: I prefer writing terse code without comments.\n"
        "Assistant: Noted!"
    )
    entity_names = agent.extract_and_update(turn, episode_id="ep-1")
    assert agent.store.node_count > 0
    assert isinstance(entity_names, list)


def test_retrieve_context_returns_string(agent):
    agent.extract_and_update(
        "User: Parth is building MemoryWeave.\nAssistant: OK",
        episode_id="ep-2"
    )
    ctx = agent.retrieve_context(["Parth"])
    assert isinstance(ctx, str)

from unittest.mock import MagicMock, patch
from memoryweave.agents.kg_agent import KGAgent, FusedResult


def test_fused_result_schema():
    result = FusedResult.model_validate({
        "importance_score": 0.8,
        "entities": [{"name": "Alice", "type": "Person", "description": "engineer"}],
        "relationships": [],
    })
    assert result.importance_score == 0.8
    assert len(result.entities) == 1
    assert result.entities[0].name == "Alice"


def test_fused_extract_returns_score_and_entities():
    agent = KGAgent()
    mock_response = MagicMock()
    mock_response.content = '{"importance_score": 0.75, "entities": [{"name": "Bob", "type": "Person", "description": "developer"}], "relationships": []}'

    with patch("memoryweave.agents.kg_agent.KGAgent.fused_extract", return_value=FusedResult(
        importance_score=0.75,
        entities=[{"name": "Bob", "type": "Person", "description": "developer"}],
        relationships=[],
    )):
        result = agent.fused_extract("User: hi Bob\nAssistant: hello")

    assert result.importance_score == 0.75
    assert result.entities[0].name == "Bob"


def test_fused_extract_handles_bad_json():
    agent = KGAgent()
    mock_response = MagicMock()
    mock_response.content = "not valid json"

    with patch("langchain_ollama.ChatOllama.invoke", return_value=mock_response):
        result = agent.fused_extract("some text")

    assert result.importance_score == 0.0
    assert result.entities == []


def test_episodic_write_uses_external_score():
    from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
    from langchain_core.messages import HumanMessage, AIMessage
    import tempfile, os
    from memoryweave.memory.episodic_store import EpisodicStore

    with tempfile.TemporaryDirectory() as tmp:
        store = EpisodicStore(persist_dir=tmp)
        agent = EpisodicMemoryAgent(session_id="test", store=store)
        msgs = [HumanMessage(content="hi"), AIMessage(content="hello")]

        # score below threshold — nothing stored
        ep = agent.write(msgs, importance_score=0.1)
        assert ep is None
        assert store.count() == 0

        # score above threshold — stored
        ep = agent.write(msgs, importance_score=0.9)
        assert ep is not None
        assert store.count() == 1

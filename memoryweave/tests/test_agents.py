# memoryweave/tests/test_agents.py
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.core.config import settings
from memoryweave.memory.episodic_store import Episode


def make_episode(score: float, turn: int = 1) -> Episode:
    return Episode(
        id=f"ep-{turn}",
        content="test content",
        importance_score=score,
        timestamp=datetime.now(timezone.utc),
        session_id="test",
        turn_number=turn,
    )


def test_scorer_llm_is_cached_at_init():
    """Scorer LLM must be created once at init — same object reused across calls."""
    agent = EpisodicMemoryAgent(session_id="test")
    assert hasattr(agent, "_scorer_llm"), "_scorer_llm must be set in __init__"
    llm_at_init = agent._scorer_llm
    # Verify the attribute is stable (not recreated on access)
    assert agent._scorer_llm is llm_at_init


def test_update_entity_links_delegates_to_store():
    """EpisodicMemoryAgent.update_entity_links must delegate to its internal store."""
    mock_store = MagicMock()
    agent = EpisodicMemoryAgent(session_id="test", store=mock_store)
    agent.update_entity_links("ep-1", ["entity-a", "entity-b"])
    mock_store.update_entity_links.assert_called_once_with("ep-1", ["entity-a", "entity-b"])


def test_retrieve_filters_by_min_importance(monkeypatch):
    """retrieve() must exclude episodes below settings.episodic_min_importance."""
    from memoryweave.core import config
    monkeypatch.setattr(config.settings, "episodic_min_importance", 0.5)

    mock_store = MagicMock()
    mock_store.retrieve.return_value = [make_episode(0.8), make_episode(0.3, turn=2)]
    mock_store.turn_count = 2

    agent = EpisodicMemoryAgent(session_id="test", store=mock_store)
    results = agent.retrieve("query")

    assert len(results) == 1
    assert results[0].importance_score == 0.8
    mock_store.apply_decay.assert_called_once_with(2, settings.episodic_decay_lambda)


from memoryweave.agents.orchestrator import MemoryOrchestrator


def test_write_turn_handles_list_content_with_kg():
    """write_turn must not crash when AIMessage.content is a list (e.g. tool-call response)."""
    from langchain_core.messages import AIMessage, HumanMessage
    from memoryweave.memory.episodic_store import Episode

    mock_working = MagicMock()
    mock_episodic = MagicMock()
    mock_kg = MagicMock()

    fake_episode = Episode(
        id="ep-1",
        content="test",
        importance_score=0.8,
        timestamp=datetime.now(timezone.utc),
        session_id="s1",
        turn_number=1,
    )
    mock_episodic.write.return_value = fake_episode
    mock_kg.extract_and_update.return_value = []

    orch = MemoryOrchestrator(working=mock_working, episodic=mock_episodic, kg_agent=mock_kg)

    ai_msg = AIMessage(content=[{"type": "text", "text": "hello world"}])
    human_msg = HumanMessage(content="hi")

    orch.write_turn([human_msg, ai_msg])  # must not raise TypeError
    mock_kg.extract_and_update.assert_called_once()

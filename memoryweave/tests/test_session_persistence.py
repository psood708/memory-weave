"""Tests for working memory Redis persistence helpers."""
import json

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.api.session import SessionState, _restore_working_mem


def _make_state(session_id: str = "s1") -> SessionState:
    return SessionState(
        session_id=session_id,
        provider="ollama",
        graph=object(),
        working=WorkingMemoryAgent(max_turns=10),
        episodic=None,  # type: ignore[arg-type]
        kg=None,  # type: ignore[arg-type]
    )


def test_restore_new_format_loads_messages_and_turn_count():
    state = _make_state()
    payload = json.dumps({
        "messages": [{"type": "human", "content": "hi"}, {"type": "ai", "content": "hello"}],
        "turn_count": 5,
    })
    _restore_working_mem(state, payload)
    msgs = state.working.get()
    assert len(msgs) == 2
    assert isinstance(msgs[0], HumanMessage)
    assert isinstance(msgs[1], AIMessage)
    assert state.turn_count == 5


def test_restore_legacy_list_format_loads_messages_without_turn_count():
    state = _make_state()
    state.turn_count = 3
    payload = json.dumps([{"type": "human", "content": "hello"}])
    _restore_working_mem(state, payload)
    assert len(state.working.get()) == 1
    assert state.turn_count == 3  # unchanged — legacy format has no turn_count


def test_restore_clears_existing_buffer_before_loading():
    state = _make_state()
    state.working.add(HumanMessage(content="old"))
    payload = json.dumps({"messages": [{"type": "human", "content": "new"}], "turn_count": 1})
    _restore_working_mem(state, payload)
    msgs = state.working.get()
    assert len(msgs) == 1
    assert msgs[0].content == "new"


def test_restore_empty_messages_clears_buffer():
    state = _make_state()
    state.working.add(HumanMessage(content="something"))
    payload = json.dumps({"messages": [], "turn_count": 0})
    _restore_working_mem(state, payload)
    assert state.working.get() == []
    assert state.turn_count == 0


def test_working_memory_ttl_setting_exists_and_defaults_to_3600():
    from memoryweave.core.config import settings
    assert settings.working_memory_ttl == 3600

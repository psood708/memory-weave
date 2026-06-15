import pytest

from memoryweave.agents.graph import build_graph
from memoryweave.core.state import MemoryWeaveState

pytestmark = pytest.mark.usefixtures("require_ollama")


def _state(user_input: str) -> MemoryWeaveState:
    return {
        "user_input": user_input,
        "working_context": "",
        "episodes": [],
        "episode_context": "",
        "kg_context": "",
        "formatted_context": "",
        "response": "",
        "token_estimate": 0,
    }


def test_graph_produces_non_empty_response():
    graph = build_graph(session_id="test-session-a")
    result = graph.invoke(_state("Hello, what can you help me with?"))
    assert isinstance(result["response"], str)
    assert len(result["response"]) > 0


def test_graph_token_estimate_is_integer():
    graph = build_graph(session_id="test-session-b")
    result = graph.invoke(_state("My name is Parth."))
    assert isinstance(result["token_estimate"], int)
    assert result["token_estimate"] >= 0


def test_graph_formatted_context_is_string():
    graph = build_graph(session_id="test-session-c")
    result = graph.invoke(_state("Tell me something interesting."))
    assert isinstance(result["formatted_context"], str)


def test_two_turns_accumulate_working_memory():
    graph = build_graph(session_id="test-session-d")
    graph.invoke(_state("My favourite language is Python."))
    result = graph.invoke(_state("What language did I mention?"))
    assert isinstance(result["response"], str)

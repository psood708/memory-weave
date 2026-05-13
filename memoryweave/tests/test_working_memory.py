from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.working_memory import WorkingMemoryAgent


def test_sliding_buffer_eviction():
    agent = WorkingMemoryAgent(max_turns=3)
    for i in range(5):
        agent.add(HumanMessage(content=f"msg {i}"))
    turns = agent.get()
    assert len(turns) == 3
    assert turns[0].content == "msg 2"


def test_format_for_context():
    agent = WorkingMemoryAgent(max_turns=5)
    agent.add(HumanMessage(content="Hello"))
    agent.add(AIMessage(content="Hi there"))
    ctx = agent.format_for_context()
    assert "User: Hello" in ctx
    assert "Assistant: Hi there" in ctx


def test_clear():
    agent = WorkingMemoryAgent(max_turns=5)
    agent.add(HumanMessage(content="test"))
    agent.clear()
    assert agent.turn_count == 0
    assert agent.format_for_context() == ""


def test_messages_added_tracks_beyond_buffer_capacity():
    agent = WorkingMemoryAgent(max_turns=3)
    for i in range(10):
        agent.add(HumanMessage(content=f"msg {i}"))
    assert agent.messages_added == 10
    assert len(agent.get()) == 3  # buffer still capped


def test_messages_added_resets_on_clear():
    agent = WorkingMemoryAgent(max_turns=5)
    for i in range(5):
        agent.add(HumanMessage(content=f"msg {i}"))
    agent.clear()
    assert agent.messages_added == 0

from memoryweave.core.state import MemoryWeaveState


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

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from memoryweave.memory.episodic_store import Episode


class MemoryWeaveState(TypedDict):
    user_input: str
    working_context: str
    episodes: list["Episode"]
    episode_context: str
    kg_context: str
    formatted_context: str
    response: str
    token_estimate: int

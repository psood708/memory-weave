from typing import TypedDict

from memoryweave.memory.episodic_store import Episode


class MemoryWeaveState(TypedDict, total=False):
    user_input: str          # always required — set by caller
    query_mode: str          # "memory" | "question"; defaults to "memory" when absent
    working_context: str
    episodes: list[Episode]
    episode_context: str
    kg_context: str
    formatted_context: str
    response: str
    token_estimate: int

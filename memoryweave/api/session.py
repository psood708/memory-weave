import asyncio
from dataclasses import dataclass, field

from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.graph import GraphWithAgents, build_read_graph_with_state
from memoryweave.agents.kg_agent import KGAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent


@dataclass
class SessionState:
    session_id: str
    provider: str
    graph: object  # compiled read-only LangGraph (no write_node)
    working: WorkingMemoryAgent
    episodic: EpisodicMemoryAgent
    kg: KGAgent
    last_token_estimate: int = 0
    turn_count: int = 0

    async def write_turn_async(self, user_input: str, response: str) -> None:
        """Run memory-write operations in the background after the response is streamed."""
        msgs = [HumanMessage(content=user_input), AIMessage(content=response)]
        for msg in msgs:
            self.working.add(msg)
        turn_content = f"{user_input}\n{response}"
        fused = await asyncio.to_thread(self.kg.fused_extract, turn_content)
        episode = self.episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = self.kg.update_graph(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            self.episodic.update_entity_links(episode.id, entity_names)


# In-memory session registry: "{session_id}:{provider}" -> SessionState
_sessions: dict[str, SessionState] = {}


def clear_sessions() -> int:
    """Flush all in-memory sessions so the next request reloads from disk."""
    count = len(_sessions)
    _sessions.clear()
    return count


def get_or_create_session(session_id: str, provider: str = "ollama") -> SessionState:
    """Return the existing session or create a new one. Provider is part of the key."""
    key = f"{session_id}:{provider}"
    if key not in _sessions:
        bundle: GraphWithAgents = build_read_graph_with_state(session_id, provider=provider)
        _sessions[key] = SessionState(
            session_id=session_id,
            provider=provider,
            graph=bundle.graph,
            working=bundle.working,
            episodic=bundle.episodic,
            kg=bundle.kg,
        )
    return _sessions[key]

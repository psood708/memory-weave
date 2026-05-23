import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from langchain_core.messages import AIMessage, HumanMessage

_logger = logging.getLogger(__name__)

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

    def update_provider(self, provider: str, user_config=None) -> None:
        """Swap the inference LLM for a different provider while keeping all memory intact."""
        from memoryweave.agents.graph import _compile_graph
        from memoryweave.core.llm import get_extraction_llm, get_llm
        self.provider = provider
        llm = get_llm(provider=provider, user_config=user_config)
        self.kg._extraction_llm = get_extraction_llm(provider=provider, user_config=user_config)
        self.graph = _compile_graph(self.working, self.episodic, self.kg, llm)

    async def write_turn_async(
        self,
        user_input: str,
        response: str,
        *,
        total_latency_ms: int = 0,
        kg_context: str = "",
    ) -> None:
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

        try:
            from memoryweave.api.app import eval_bus
            from memoryweave.eval.events import TurnEvent

            retrieved_episodes = self.episodic.retrieve(user_input)
            kg_texts = [ln.strip() for ln in kg_context.splitlines() if ln.strip()]
            event = TurnEvent(
                session_id=self.session_id,
                user_id=getattr(self, "user_id", ""),
                turn_number=self.turn_count,
                question=user_input,
                answer=response,
                episode_texts=[ep.content for ep in retrieved_episodes],
                kg_texts=kg_texts,
                episode_embeddings=[],
                kg_embedding=[],
                system_tokens=self.last_token_estimate,
                naive_tokens=self.last_token_estimate,
                retrieval_latency_ms=0,
                total_latency_ms=total_latency_ms,
                timestamp=datetime.now(timezone.utc),
            )
            eval_bus.emit(event)
        except Exception:
            _logger.exception("eval_bus emit failed — metrics skipped for turn %d", self.turn_count)


# In-memory session registry: "{session_id}:{user_id}" -> SessionState
# Provider is NOT part of the key — memory is shared across provider switches.
_sessions: dict[str, SessionState] = {}


def clear_sessions() -> int:
    """Flush all in-memory sessions so the next request reloads from disk."""
    count = len(_sessions)
    _sessions.clear()
    return count


def get_or_create_session(session_id: str, provider: str = "ollama", user_config=None) -> SessionState:
    """Return the existing session or create a new one.
    Keyed by session+user only — provider switches update the LLM without touching memory."""
    user_id = user_config.user_id if user_config else ""
    key = f"{session_id}:{user_id}"
    if key not in _sessions:
        bundle: GraphWithAgents = build_read_graph_with_state(session_id, provider=provider, user_config=user_config)
        _sessions[key] = SessionState(
            session_id=session_id,
            provider=provider,
            graph=bundle.graph,
            working=bundle.working,
            episodic=bundle.episodic,
            kg=bundle.kg,
        )
    else:
        session = _sessions[key]
        if session.provider != provider:
            session.update_provider(provider, user_config)
    return _sessions[key]

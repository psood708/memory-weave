from dataclasses import dataclass

from langchain_core.messages import BaseMessage

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.core.config import settings
from memoryweave.core.context_budget import ContextBlock, build_context_block, format_context_block
from memoryweave.core.llm import extract_text
from memoryweave.core.protocols import KGAgentProtocol
from memoryweave.memory.episodic_store import Episode


@dataclass
class OrchestratorResult:
    context_block: ContextBlock
    formatted_context: str
    episodes_used: list[Episode]
    working_turns: int
    token_estimate: int


class MemoryOrchestrator:
    """Coordinates all memory agents, merges context, enforces token budget."""

    def __init__(
        self,
        working: WorkingMemoryAgent,
        episodic: EpisodicMemoryAgent,
        kg_agent: KGAgentProtocol | None = None,
    ):
        self._working = working
        self._episodic = episodic
        self._kg = kg_agent

    # ── Read path ────────────────────────────────────────────────────────────

    def build_context(self, query: str) -> OrchestratorResult:
        working_str = self._working.format_for_context()
        episodes = self._episodic.retrieve(query)
        episodes_str = self._episodic.format_for_context(episodes)

        kg_str = ""
        if self._kg:
            entity_ids = [eid for ep in episodes for eid in ep.entity_ids]
            kg_str = self._kg.retrieve_context(entity_ids)

        block = build_context_block(
            working=working_str,
            episodes=episodes_str,
            kg=kg_str,
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        token_estimate = len(formatted) // 4

        return OrchestratorResult(
            context_block=block,
            formatted_context=formatted,
            episodes_used=episodes,
            working_turns=self._working.messages_added,
            token_estimate=token_estimate,
        )

    # ── Write path ───────────────────────────────────────────────────────────

    def write_turn(self, messages: list[BaseMessage]) -> None:
        for msg in messages:
            self._working.add(msg)

        episode = self._episodic.write(messages)

        if episode and self._kg:
            content = "\n".join(extract_text(m.content) for m in messages)
            entity_ids = self._kg.extract_and_update(
                content=content,
                episode_id=episode.id,
            )
            if entity_ids:
                self._episodic.update_entity_links(episode.id, entity_ids)

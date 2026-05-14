from datetime import datetime, timezone

from langchain_core.messages import BaseMessage

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text
from memoryweave.memory.episodic_store import Episode, EpisodicStore


class EpisodicMemoryAgent:
    """Stores, retrieves, and decays episodic memories."""

    def __init__(self, session_id: str, store: EpisodicStore | None = None):
        self._session_id = session_id
        self._store = store or EpisodicStore()

    def write(self, messages: list[BaseMessage], importance_score: float, entity_ids: list[str] | None = None) -> Episode | None:
        content = "\n".join(
            f"{'User' if m.type == 'human' else 'Assistant'}: {extract_text(m.content)}"
            for m in messages
        )
        turn = self._store.increment_turn()

        if importance_score < settings.episodic_importance_threshold:
            return None

        episode = Episode(
            id=EpisodicStore.new_id(),
            content=content,
            importance_score=importance_score,
            timestamp=datetime.now(timezone.utc),
            session_id=self._session_id,
            turn_number=turn,
            entity_ids=entity_ids or [],
        )
        self._store.write(episode)
        return episode

    def retrieve(self, query: str) -> list[Episode]:
        episodes = self._store.retrieve(query, top_k=settings.episodic_top_k)
        self._store._maybe_decay(settings.episodic_decay_lambda)
        return [ep for ep in episodes if ep.importance_score >= settings.episodic_min_importance]

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        self._store.update_entity_links(episode_id, entity_ids)

    def format_for_context(self, episodes: list[Episode]) -> str:
        if not episodes:
            return ""
        lines = []
        for ep in sorted(episodes, key=lambda e: e.importance_score, reverse=True):
            ts = ep.timestamp.strftime("%Y-%m-%d")
            lines.append(f"[{ts}, importance={ep.importance_score:.2f}] {ep.content}")
        return "\n\n".join(lines)

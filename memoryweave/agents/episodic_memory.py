from datetime import datetime, timezone

from anthropic import Anthropic
from langchain_core.messages import BaseMessage

from memoryweave.core.config import settings
from memoryweave.memory.episodic_store import Episode, EpisodicStore

_IMPORTANCE_PROMPT = """\
You are scoring a conversation turn for long-term memory relevance.

Conversation turn:
{content}

Score this turn from 0.0 to 1.0 based on how likely it is to be useful in future sessions.
High scores (0.7-1.0): specific facts, decisions, names, preferences, project details, commitments.
Low scores (0.0-0.3): pleasantries, filler, vague statements, repetition of prior context.

Respond with ONLY a float between 0.0 and 1.0. No explanation."""


class EpisodicMemoryAgent:
    """Scores, stores, retrieves, and decays episodic memories."""

    def __init__(self, session_id: str, store: EpisodicStore | None = None):
        self._session_id = session_id
        self._store = store or EpisodicStore()
        self._client = Anthropic(api_key=settings.anthropic_api_key)

    def score_importance(self, content: str) -> float:
        response = self._client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": _IMPORTANCE_PROMPT.format(content=content)}],
        )
        try:
            return min(1.0, max(0.0, float(response.content[0].text.strip())))
        except (ValueError, IndexError):
            return 0.0

    def write(self, messages: list[BaseMessage], entity_ids: list[str] | None = None) -> Episode | None:
        content = "\n".join(
            f"{'User' if m.type == 'human' else 'Assistant'}: {m.content}" for m in messages
        )
        turn = self._store.increment_turn()
        score = self.score_importance(content)

        if score < settings.episodic_importance_threshold:
            return None

        episode = Episode(
            id=EpisodicStore.new_id(),
            content=content,
            importance_score=score,
            timestamp=datetime.now(timezone.utc),
            session_id=self._session_id,
            turn_number=turn,
            entity_ids=entity_ids or [],
        )
        self._store.write(episode)
        return episode

    def retrieve(self, query: str) -> list[Episode]:
        episodes = self._store.retrieve(query, top_k=settings.episodic_top_k)
        self._store.apply_decay(self._store.turn_count, settings.episodic_decay_lambda)
        return episodes

    def format_for_context(self, episodes: list[Episode]) -> str:
        if not episodes:
            return ""
        lines = []
        for ep in sorted(episodes, key=lambda e: e.importance_score, reverse=True):
            ts = ep.timestamp.strftime("%Y-%m-%d")
            lines.append(f"[{ts}, importance={ep.importance_score:.2f}] {ep.content}")
        return "\n\n".join(lines)

    @property
    def store(self) -> EpisodicStore:
        return self._store

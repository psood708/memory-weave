import re
from datetime import datetime, timezone

from langchain_core.messages import BaseMessage, HumanMessage

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_scorer_llm
from memoryweave.memory.episodic_store import Episode, EpisodicStore

_IMPORTANCE_PROMPT = """\
Score this conversation turn for long-term memory relevance.

Turn:
{content}

High (0.7-1.0): specific facts, decisions, names, preferences, project details, commitments.
Low (0.0-0.3): pleasantries, filler, vague statements, repeated context.

Reply with ONLY a single decimal number between 0.0 and 1.0. Nothing else."""


def _parse_score(text: str) -> float:
    matches = re.findall(r"\b(1\.0+|0\.\d+)\b", text)
    if matches:
        return min(1.0, max(0.0, float(matches[0])))
    return 0.0


class EpisodicMemoryAgent:
    """Scores, stores, retrieves, and decays episodic memories."""

    def __init__(self, session_id: str, store: EpisodicStore | None = None):
        self._session_id = session_id
        self._store = store or EpisodicStore()
        self._scorer_llm = get_scorer_llm()

    def score_importance(self, content: str) -> float:
        response = self._scorer_llm.invoke([HumanMessage(content=_IMPORTANCE_PROMPT.format(content=content))])
        return _parse_score(extract_text(response.content))

    def write(self, messages: list[BaseMessage], entity_ids: list[str] | None = None) -> Episode | None:
        content = "\n".join(
            f"{'User' if m.type == 'human' else 'Assistant'}: {extract_text(m.content)}"
            for m in messages
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

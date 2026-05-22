import logging
import uuid
from datetime import datetime, timezone

import numpy as np
import tiktoken

from memoryweave.core.config import settings
from memoryweave.eval.events import TurnEvent
from memoryweave.eval.repository.base import MetricsRepository, TurnMetrics

_enc = tiktoken.get_encoding("cl100k_base")
logger = logging.getLogger(__name__)


def _count_tokens(text: str) -> int:
    return len(_enc.encode(text))


def compute_kg_contribution(
    episode_embeddings: list[list[float]],
    kg_embedding: list[float],
    threshold: float,
) -> tuple[bool, float]:
    """Returns (kg_contributed, similarity_score). No LLM calls."""
    if not episode_embeddings or not kg_embedding:
        return False, 1.0
    mean_ep = np.mean(episode_embeddings, axis=0)
    kg = np.array(kg_embedding)
    norm_ep = np.linalg.norm(mean_ep)
    norm_kg = np.linalg.norm(kg)
    if norm_ep == 0 or norm_kg == 0:
        return False, 1.0
    similarity = float(np.dot(mean_ep, kg) / (norm_ep * norm_kg))
    return similarity < threshold, similarity


class NaiveBufferTracker:
    """Accumulates token counts as if the full conversation history were in context. No LLM calls."""

    def __init__(self):
        self._total = 0

    def add_turn(self, user_msg: str, assistant_msg: str) -> int:
        tokens = _count_tokens(user_msg) + _count_tokens(assistant_msg)
        self._total += tokens
        return tokens

    def total_tokens(self) -> int:
        return self._total

    def reset(self) -> None:
        self._total = 0


class TokenMetricsWorker:
    def __init__(self, repo: MetricsRepository):
        self._repo = repo
        self._naive_trackers: dict[str, NaiveBufferTracker] = {}

    def _get_tracker(self, session_id: str) -> NaiveBufferTracker:
        if session_id not in self._naive_trackers:
            self._naive_trackers[session_id] = NaiveBufferTracker()
        return self._naive_trackers[session_id]

    async def process(self, event: TurnEvent) -> str:
        try:
            tracker = self._get_tracker(event.session_id)
            naive_tokens = tracker.add_turn(event.question, event.answer)

            efficiency = (
                (naive_tokens - event.system_tokens) / naive_tokens
                if naive_tokens > 0 else 0.0
            )

            kg_contributed, kg_distance = compute_kg_contribution(
                event.episode_embeddings,
                event.kg_embedding,
                threshold=settings.kg_contribution_threshold,
            )

            turn_id = str(uuid.uuid4())
            turn = TurnMetrics(
                id=turn_id,
                session_id=event.session_id,
                turn_number=event.turn_number,
                timestamp=event.timestamp,
                system_tokens=event.system_tokens,
                naive_tokens=naive_tokens,
                token_efficiency=max(0.0, efficiency),
                kg_contributed=kg_contributed,
                kg_cosine_distance=kg_distance,
                retrieval_latency_ms=event.retrieval_latency_ms,
                total_latency_ms=event.total_latency_ms,
            )
            await self._repo.write_turn(turn)
            return turn_id
        except Exception:
            logger.exception("TokenMetricsWorker failed — skipping turn")
            return ""

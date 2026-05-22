import logging
import time

from memoryweave.eval.judges.base import BaseJudge
from memoryweave.eval.repository.base import MetricsRepository

logger = logging.getLogger(__name__)


class LLMJudgeWorker:
    """Async judge worker with in-process circuit breaker.
    On circuit open: skips scoring, logs, continues — never propagates to user."""

    def __init__(
        self,
        judge: BaseJudge,
        repo: MetricsRepository,
        max_failures: int = 3,
        timeout_secs: int = 300,
    ):
        self._judge = judge
        self._repo = repo
        self._max_failures = max_failures
        self._timeout_secs = timeout_secs
        self._failure_count = 0
        self._circuit_opened_at: float | None = None

    @property
    def circuit_open(self) -> bool:
        if self._circuit_opened_at is None:
            return False
        if time.monotonic() - self._circuit_opened_at > self._timeout_secs:
            self._failure_count = 0
            self._circuit_opened_at = None
            return False
        return True

    async def process(
        self, turn_metric_id: str, question: str, contexts: list[str], answer: str
    ) -> None:
        if self.circuit_open:
            logger.debug("Judge circuit open — skipping turn %s", turn_metric_id)
            return
        try:
            result = await self._judge.score(question, contexts, answer)
            await self._repo.patch_judge_score(turn_metric_id, result)
            self._failure_count = 0
        except Exception as e:
            self._failure_count += 1
            logger.warning("Judge failed (%d/%d): %s", self._failure_count, self._max_failures, e)
            if self._failure_count >= self._max_failures:
                self._circuit_opened_at = time.monotonic()
                logger.error("Judge circuit opened — disabling for %ds", self._timeout_secs)

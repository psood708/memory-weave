import asyncio
import logging

from memoryweave.eval.judges.base import BaseJudge
from memoryweave.eval.repository.base import JudgeResult

logger = logging.getLogger(__name__)


class RagasJudge(BaseJudge):
    """Ragas faithfulness + context_precision judge. LLM backend configured via Ragas env."""

    async def score(self, question: str, contexts: list[str], answer: str) -> JudgeResult:
        try:
            return await asyncio.to_thread(self._score_sync, question, contexts, answer)
        except Exception as e:
            logger.warning("RagasJudge failed: %s", e)
            raise

    def _score_sync(self, question: str, contexts: list[str], answer: str) -> JudgeResult:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics.collections import context_precision, faithfulness

        data = {
            "question": [question],
            "answer": [answer],
            "contexts": [contexts],
            "ground_truth": [answer],
        }
        dataset = Dataset.from_dict(data)
        result = evaluate(dataset, metrics=[faithfulness, context_precision])
        row = result.to_pandas().to_dict(orient="records")[0]

        faith = float(row.get("faithfulness", 0.0) or 0.0)
        prec = float(row.get("context_precision", 0.0) or 0.0)
        score = (faith + prec) / 2

        return JudgeResult(
            score=round(score, 4),
            reasoning=f"faithfulness={faith:.3f}, context_precision={prec:.3f}",
            metric_breakdown={"faithfulness": faith, "context_precision": prec},
        )

from rouge_score import rouge_scorer

from memoryweave.eval.judges.base import BaseJudge
from memoryweave.eval.repository.base import JudgeResult

_scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)


class HeuristicJudge(BaseJudge):
    """ROUGE-L overlap between retrieved contexts and the answer. No LLM calls."""

    async def score(self, question: str, contexts: list[str], answer: str) -> JudgeResult:
        if not contexts or not answer:
            return JudgeResult(score=0.0, reasoning="No context or answer", metric_breakdown={"rouge": 0.0})

        combined_context = " ".join(contexts)
        scores = _scorer.score(combined_context, answer)
        rouge_l = scores["rougeL"].fmeasure

        return JudgeResult(
            score=round(rouge_l, 4),
            reasoning=f"ROUGE-L F1 between retrieved context and answer: {rouge_l:.3f}",
            metric_breakdown={"rouge": rouge_l},
        )

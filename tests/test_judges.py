import pytest
from memoryweave.eval.judges.heuristic_judge import HeuristicJudge


@pytest.mark.asyncio
async def test_heuristic_judge_scores_relevant_answer():
    judge = HeuristicJudge()
    result = await judge.score(
        question="What is Paris?",
        contexts=["Paris is the capital of France."],
        answer="Paris is the capital city of France.",
    )
    assert 0.0 <= result.score <= 1.0
    assert isinstance(result.reasoning, str)
    assert "rouge" in result.metric_breakdown


@pytest.mark.asyncio
async def test_heuristic_judge_scores_irrelevant_answer():
    judge = HeuristicJudge()
    result = await judge.score(
        question="What is Paris?",
        contexts=["Paris is the capital of France."],
        answer="The weather today is sunny.",
    )
    assert result.score < 0.5

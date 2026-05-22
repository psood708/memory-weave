import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from memoryweave.eval.judges.ragas_judge import RagasJudge

@pytest.mark.asyncio
async def test_ragas_judge_returns_judge_result():
    mock_result = MagicMock()
    mock_result.to_pandas.return_value = MagicMock(
        to_dict=lambda orient: [{"faithfulness": 0.9, "context_precision": 0.85}]
    )
    with patch("ragas.evaluate", return_value=mock_result):
        judge = RagasJudge()
        result = await judge.score(
            question="What is the capital of France?",
            contexts=["Paris is the capital of France."],
            answer="Paris",
        )
    assert 0.0 <= result.score <= 1.0
    assert "faithfulness" in result.metric_breakdown

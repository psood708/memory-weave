import pytest
from unittest.mock import AsyncMock, MagicMock
from memoryweave.eval.workers.judge import LLMJudgeWorker
from memoryweave.eval.judges.base import JudgeResult
from memoryweave.eval.repository.base import MetricsRepository


def _make_repo():
    return AsyncMock(spec=MetricsRepository)


@pytest.mark.asyncio
async def test_judge_worker_patches_score_on_success():
    judge = AsyncMock()
    judge.score.return_value = JudgeResult(score=0.9, reasoning="good", metric_breakdown={})
    repo = _make_repo()
    worker = LLMJudgeWorker(judge=judge, repo=repo, max_failures=3, timeout_secs=1)
    await worker.process(turn_metric_id="t1", question="q", contexts=["c"], answer="a")
    repo.patch_judge_score.assert_awaited_once()
    args = repo.patch_judge_score.call_args
    assert args[0][0] == "t1"
    assert args[0][1].score == 0.9


@pytest.mark.asyncio
async def test_judge_worker_opens_circuit_after_failures():
    judge = AsyncMock()
    judge.score.side_effect = RuntimeError("API down")
    repo = _make_repo()
    worker = LLMJudgeWorker(judge=judge, repo=repo, max_failures=2, timeout_secs=60)
    for _ in range(2):
        await worker.process("t1", "q", ["c"], "a")
    assert worker.circuit_open
    # Next call should be skipped without calling judge.score again
    await worker.process("t1", "q", ["c"], "a")
    assert judge.score.call_count == 2

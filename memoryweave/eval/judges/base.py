from abc import ABC, abstractmethod

from memoryweave.eval.repository.base import JudgeResult


class BaseJudge(ABC):
    @abstractmethod
    async def score(
        self,
        question: str,
        contexts: list[str],
        answer: str,
    ) -> JudgeResult: ...

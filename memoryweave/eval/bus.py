import asyncio
import logging

from memoryweave.eval.events import TurnEvent

logger = logging.getLogger(__name__)


class EvalEventBus:
    def __init__(self, maxsize: int = 1000):
        self._queue: asyncio.Queue[TurnEvent] = asyncio.Queue(maxsize=maxsize)

    def emit(self, event: TurnEvent) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning(
                "EvalEventBus: queue full (maxsize=%d), dropping event for session=%s",
                self._queue.maxsize,
                getattr(event, "session_id", "?"),
            )

    async def get(self) -> TurnEvent:
        return await self._queue.get()

    def qsize(self) -> int:
        return self._queue.qsize()

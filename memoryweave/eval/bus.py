import asyncio
from memoryweave.eval.events import TurnEvent


class EvalEventBus:
    def __init__(self, maxsize: int = 1000):
        self._queue: asyncio.Queue[TurnEvent] = asyncio.Queue(maxsize=maxsize)

    def emit(self, event: TurnEvent) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            pass  # drop event rather than block — eval must never affect the hot path

    async def get(self) -> TurnEvent:
        return await self._queue.get()

    def qsize(self) -> int:
        return self._queue.qsize()

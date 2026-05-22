import asyncio
import pytest
from memoryweave.eval.events import TurnEvent
from memoryweave.eval.bus import EvalEventBus

@pytest.mark.asyncio
async def test_emit_delivers_to_subscriber():
    bus = EvalEventBus()
    received = []

    async def consumer():
        event = await asyncio.wait_for(bus.get(), timeout=1.0)
        received.append(event)

    task = asyncio.create_task(consumer())
    event = TurnEvent(
        session_id="s1", user_id="u1", turn_number=1,
        question="hi", answer="hello",
        episode_texts=["old msg"], kg_texts=["entity A"],
        episode_embeddings=[[0.1, 0.2]], kg_embedding=[0.1, 0.3],
        system_tokens=100, naive_tokens=500,
        retrieval_latency_ms=30, total_latency_ms=200,
    )
    bus.emit(event)
    await task
    assert len(received) == 1
    assert received[0].session_id == "s1"

@pytest.mark.asyncio
async def test_emit_is_nonblocking():
    bus = EvalEventBus(maxsize=10)
    for i in range(5):
        bus.emit(TurnEvent(
            session_id="s", user_id="u", turn_number=i,
            question="q", answer="a",
            episode_texts=[], kg_texts=[],
            episode_embeddings=[], kg_embedding=[],
            system_tokens=10, naive_tokens=50,
            retrieval_latency_ms=5, total_latency_ms=20,
        ))
    assert bus._queue.qsize() == 5

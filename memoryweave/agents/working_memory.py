from collections import deque

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from memoryweave.core.config import settings


class WorkingMemoryAgent:
    """Maintains a sliding buffer of recent conversation turns."""

    def __init__(self, max_turns: int | None = None):
        self._max_turns = max_turns or settings.working_memory_max_turns
        self._buffer: deque[BaseMessage] = deque(maxlen=self._max_turns)
        self._total_added: int = 0

    def add(self, message: BaseMessage) -> None:
        self._buffer.append(message)
        self._total_added += 1

    def get(self) -> list[BaseMessage]:
        return list(self._buffer)

    def format_for_context(self) -> str:
        if not self._buffer:
            return ""
        lines = []
        for msg in self._buffer:
            role = "User" if msg.type == "human" else "Assistant"
            lines.append(f"{role}: {msg.content}")
        return "\n".join(lines)

    def to_json(self) -> list[dict]:
        return [{"type": msg.type, "content": msg.content} for msg in self._buffer]

    def load_buffer(self, data: list[dict]) -> None:
        """Restore buffer from serialized data (e.g. loaded from Redis)."""
        for item in data:
            msg = HumanMessage(content=item["content"]) if item["type"] == "human" else AIMessage(content=item["content"])
            self._buffer.append(msg)
            self._total_added += 1

    def clear(self) -> None:
        self._buffer.clear()
        self._total_added = 0

    @property
    def turn_count(self) -> int:
        """Current number of messages in the sliding buffer (≤ max_turns)."""
        return len(self._buffer)

    @property
    def messages_added(self) -> int:
        """Total messages added since last clear — never caps at max_turns."""
        return self._total_added

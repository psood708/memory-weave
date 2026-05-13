from collections import deque

from langchain_core.messages import BaseMessage

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

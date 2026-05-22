class ForgettingTracker:
    """Tracks which decayed episodes were later retrieved.
    Forgetting precision = decayed episodes never retrieved / total decayed."""

    def __init__(self):
        self._decayed: set[str] = set()
        self._retrieved_after_decay: set[str] = set()

    def record_decay(self, episode_id: str) -> None:
        self._decayed.add(episode_id)

    def record_retrieval(self, episode_id: str) -> None:
        if episode_id in self._decayed:
            self._retrieved_after_decay.add(episode_id)

    def precision(self) -> float:
        if not self._decayed:
            return 0.0
        correctly_forgotten = len(self._decayed - self._retrieved_after_decay)
        return correctly_forgotten / len(self._decayed)

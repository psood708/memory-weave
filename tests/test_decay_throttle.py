from unittest.mock import patch
from memoryweave.memory.episodic_store import EpisodicStore


def test_decay_only_runs_on_interval(tmp_path):
    store = EpisodicStore(persist_dir=str(tmp_path))
    with patch.object(store, "apply_decay") as mock_decay:
        for i in range(1, 6):
            store._turn_counter = i
            store._maybe_decay(decay_lambda=0.05)
        # interval=5, so only fires when turn_counter % 5 == 0, i.e. at i=5
        assert mock_decay.call_count == 1


def test_decay_skipped_between_intervals(tmp_path):
    store = EpisodicStore(persist_dir=str(tmp_path))
    store._turn_counter = 3  # not a multiple of 5
    with patch.object(store, "apply_decay") as mock_decay:
        store._maybe_decay(decay_lambda=0.05)
        mock_decay.assert_not_called()

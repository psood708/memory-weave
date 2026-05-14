from unittest.mock import patch
from memoryweave.memory.kg_store import KnowledgeGraphStore


def test_kg_decay_only_runs_on_interval(tmp_path):
    store = KnowledgeGraphStore(persist_path=str(tmp_path / "kg.json"))
    with patch.object(store, "decay_all") as mock_decay, \
         patch.object(store, "prune") as mock_prune:
        for _ in range(5):
            store._maybe_maintain()
        assert mock_decay.call_count == 1
        assert mock_prune.call_count == 1


def test_kg_decay_skipped_between_intervals(tmp_path):
    store = KnowledgeGraphStore(persist_path=str(tmp_path / "kg.json"))
    store._call_count = 2  # pre-set so next 2 calls don't hit interval=5
    with patch.object(store, "decay_all") as mock_decay:
        store._maybe_maintain()
        store._maybe_maintain()
        mock_decay.assert_not_called()

from unittest.mock import patch
from memoryweave.memory.kg_backend import FileKGBackend
from memoryweave.memory.kg_store import KnowledgeGraphStore


def _store(tmp_path) -> KnowledgeGraphStore:
    backend = FileKGBackend(str(tmp_path))
    return KnowledgeGraphStore(backend=backend, user_id="test_user")


def test_kg_decay_only_runs_on_interval(tmp_path):
    store = _store(tmp_path)
    with patch.object(store, "decay_all") as mock_decay, \
         patch.object(store, "prune") as mock_prune:
        for _ in range(5):
            store._maybe_maintain()
        assert mock_decay.call_count == 1
        assert mock_prune.call_count == 1


def test_kg_decay_skipped_between_intervals(tmp_path):
    store = _store(tmp_path)
    store._call_count = 2
    with patch.object(store, "decay_all") as mock_decay:
        store._maybe_maintain()
        store._maybe_maintain()
        mock_decay.assert_not_called()

from memoryweave.eval.workers.forgetting import ForgettingTracker

def test_precision_zero_when_no_decays():
    tracker = ForgettingTracker()
    assert tracker.precision() == 0.0

def test_precision_one_when_decayed_never_retrieved():
    tracker = ForgettingTracker()
    tracker.record_decay("ep1")
    tracker.record_decay("ep2")
    assert tracker.precision() == 1.0

def test_precision_zero_when_all_decayed_retrieved():
    tracker = ForgettingTracker()
    tracker.record_decay("ep1")
    tracker.record_retrieval("ep1")
    assert tracker.precision() == 0.0

def test_precision_half_when_one_of_two_retrieved():
    tracker = ForgettingTracker()
    tracker.record_decay("ep1")
    tracker.record_decay("ep2")
    tracker.record_retrieval("ep1")
    assert abs(tracker.precision() - 0.5) < 0.001

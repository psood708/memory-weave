import pytest
import numpy as np
from memoryweave.eval.workers.token_metrics import NaiveBufferTracker, compute_kg_contribution

def test_naive_buffer_accumulates():
    tracker = NaiveBufferTracker()
    tracker.add_turn("Hello there", "I am doing well")
    tracker.add_turn("Another message", "Another reply")
    total = tracker.total_tokens()
    assert total > 0

def test_naive_buffer_resets():
    tracker = NaiveBufferTracker()
    tracker.add_turn("msg", "reply")
    tracker.reset()
    assert tracker.total_tokens() == 0

def test_kg_contribution_unique():
    ep_embs = [[1.0, 0.0, 0.0], [0.9, 0.1, 0.0]]
    kg_emb = [0.0, 0.0, 1.0]   # orthogonal — clearly unique
    contributed, distance = compute_kg_contribution(ep_embs, kg_emb, threshold=0.85)
    assert contributed is True
    assert distance < 0.85

def test_kg_contribution_not_unique():
    ep_embs = [[1.0, 0.0, 0.0]]
    kg_emb = [0.99, 0.01, 0.0]  # nearly identical
    contributed, distance = compute_kg_contribution(ep_embs, kg_emb, threshold=0.85)
    assert contributed is False
    assert distance >= 0.85

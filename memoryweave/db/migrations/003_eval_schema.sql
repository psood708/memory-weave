CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    turn_count  INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS turn_metrics (
    id                      TEXT PRIMARY KEY,
    session_id              TEXT REFERENCES sessions(id),
    turn_number             INTEGER NOT NULL,
    timestamp               TIMESTAMPTZ NOT NULL,
    system_tokens           INTEGER,
    naive_tokens            INTEGER,
    token_efficiency        REAL,
    kg_contributed          INTEGER,
    kg_cosine_distance      REAL,
    retrieval_latency_ms    INTEGER,
    total_latency_ms        INTEGER,
    judge_score             REAL,
    judge_reasoning         TEXT,
    judge_metric_breakdown  TEXT
);

CREATE TABLE IF NOT EXISTS judge_tasks (
    id              TEXT PRIMARY KEY,
    turn_metric_id  TEXT REFERENCES turn_metrics(id),
    status          TEXT DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_turn_metrics_session ON turn_metrics(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_judge_tasks_status ON judge_tasks(status);

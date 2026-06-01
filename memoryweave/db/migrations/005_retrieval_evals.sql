CREATE TABLE IF NOT EXISTS retrieval_evals (
    id                  TEXT PRIMARY KEY,
    turn_metric_id      TEXT REFERENCES turn_metrics(id) ON DELETE CASCADE,
    session_id          TEXT NOT NULL,
    turn_number         INTEGER NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- context composition (structural, no LLM needed)
    kg_seed_found       BOOLEAN NOT NULL DEFAULT FALSE,
    episode_count       INTEGER NOT NULL DEFAULT 0,
    kg_node_count       INTEGER NOT NULL DEFAULT 0,

    -- RAGAS-inspired quality scores (0.0 – 1.0, LLM-judged)
    context_relevance   REAL,   -- are retrieved facts relevant to the query?
    faithfulness        REAL,   -- does the answer only use retrieved facts?
    answer_relevance    REAL,   -- does the answer address the question?

    reasoning           TEXT
);

CREATE INDEX IF NOT EXISTS idx_retrieval_evals_session
    ON retrieval_evals(session_id);

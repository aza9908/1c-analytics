-- Метаданные ETL: watermark per entity + история запусков.
-- Идемпотентно: можно применять повторно.

CREATE SCHEMA IF NOT EXISTS etl;

CREATE TABLE IF NOT EXISTS etl.sync_state (
  entity              TEXT PRIMARY KEY,
  last_watermark_ts   TIMESTAMPTZ,
  last_watermark_id   BIGINT,
  last_run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_status     TEXT NOT NULL DEFAULT 'pending',
  last_run_id         UUID,
  rows_added          BIGINT DEFAULT 0,
  rows_updated        BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS etl.sync_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity              TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL,
  rows_fetched        BIGINT DEFAULT 0,
  rows_inserted       BIGINT DEFAULT 0,
  rows_updated        BIGINT DEFAULT 0,
  pages_fetched       INT DEFAULT 0,
  watermark_before    JSONB,
  watermark_after     JSONB,
  error               TEXT,
  duration_ms         INT
);

CREATE INDEX IF NOT EXISTS sync_runs_entity_started_idx
  ON etl.sync_runs (entity, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_runs_failed_idx
  ON etl.sync_runs (status) WHERE status <> 'success';

-- Health view (см. §10.1 reference)
CREATE OR REPLACE VIEW etl.health AS
SELECT
  s.entity,
  s.last_run_at,
  s.last_run_status,
  EXTRACT(EPOCH FROM (NOW() - s.last_run_at)) / 60 AS minutes_since_last_run,
  s.rows_added,
  s.rows_updated,
  CASE
    WHEN s.entity IN ('receipts','sales','inventory')
         AND NOW() - s.last_run_at > INTERVAL '90 minutes' THEN 'STALE'
    WHEN s.entity IN ('products','stores')
         AND NOW() - s.last_run_at > INTERVAL '26 hours' THEN 'STALE'
    WHEN s.last_run_status = 'failed' THEN 'FAILED'
    ELSE 'OK'
  END AS health
FROM etl.sync_state s;

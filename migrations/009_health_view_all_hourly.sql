-- Все DAG-и теперь ежечасные → единый SLA 90 минут для всех.
-- Раньше разделяли hourly (90 min) и daily (26h).

CREATE OR REPLACE VIEW etl.health AS
SELECT
  entity,
  last_run_at,
  last_run_status,
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) / 60.0 AS minutes_since_last_run,
  rows_added,
  rows_updated,
  CASE
    WHEN last_run_status = 'failed' THEN 'FAILED'
    WHEN (NOW() - last_run_at) > INTERVAL '90 minutes' THEN 'STALE'
    ELSE 'OK'
  END AS health
FROM etl.sync_state;

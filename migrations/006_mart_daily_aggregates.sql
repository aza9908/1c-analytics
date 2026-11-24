-- Daily aggregates для произвольных date range фильтров (7д/30д/90д/custom).
-- Источник: mart.receipts + mart.receipt_items.
-- REFRESH делается после receipts loader.

CREATE MATERIALIZED VIEW IF NOT EXISTS mart.sales_daily_by_store_product AS
SELECT
  r.date_local,
  r.store_guid,
  ri.product_guid,
  SUM(ri.quantity)::numeric(18,3)        AS qty,
  SUM(ri.sum)::numeric(18,2)             AS revenue,
  COUNT(DISTINCT r.ref_key)::int         AS receipt_count
FROM mart.receipts r
JOIN mart.receipt_items ri ON ri.receipt_ref_key = r.ref_key
WHERE ri.product_guid IS NOT NULL
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS sales_daily_by_sp_uidx
  ON mart.sales_daily_by_store_product (date_local, store_guid, product_guid);
CREATE INDEX IF NOT EXISTS sales_daily_by_sp_date_idx
  ON mart.sales_daily_by_store_product (date_local DESC);
CREATE INDEX IF NOT EXISTS sales_daily_by_sp_store_idx
  ON mart.sales_daily_by_store_product (store_guid, date_local DESC);

-- Per-store daily (для скоростных stores/dynamics запросов)
CREATE MATERIALIZED VIEW IF NOT EXISTS mart.sales_daily_by_store AS
SELECT
  date_local,
  store_guid,
  SUM(amount)::numeric(18,2)          AS revenue,
  SUM(item_count)::int                AS qty,
  COUNT(*)::int                       AS receipt_count
FROM mart.receipts
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS sales_daily_by_store_uidx
  ON mart.sales_daily_by_store (date_local, store_guid);

-- Helper: какие даты вообще есть
CREATE OR REPLACE VIEW mart.available_date_range AS
SELECT MIN(date_local) AS min_date, MAX(date_local) AS max_date
FROM mart.receipts;

-- Месячные агрегаты для дашбордов (categories/dynamics/stores/products/abc-xyz/...).
-- Источник: mart.receipts + mart.receipt_items. Cost = 0 пока не загружена себестоимость.
--
-- ВАЖНО: MATERIALIZED VIEW, потому что:
--   - запрос фронта /api/data?month=X дёргается часто
--   - агрегация по 142k items даёт ~10k уникальных продуктов на месяц
--   - on-demand агрегация добавляет 200-500ms на запрос; кэшируем
-- Обновляем REFRESH MATERIALIZED VIEW CONCURRENTLY после каждого receipts-прогона.

-- Per-store per-month: для дашбордов stores/dynamics/profitability/categories
CREATE MATERIALIZED VIEW IF NOT EXISTS mart.sales_monthly_by_store AS
SELECT
  date_trunc('month', r.date_local)::date AS month_start,
  r.store_guid,
  COALESCE(SUM(r.amount), 0)::numeric(18,2)         AS revenue,
  COALESCE(SUM(r.item_count), 0)::int               AS qty,
  COUNT(*)::int                                      AS receipt_count,
  CASE WHEN COUNT(*) > 0
       THEN (SUM(r.amount) / COUNT(*))::numeric(18,2)
       ELSE 0::numeric(18,2) END                     AS avg_check
FROM mart.receipts r
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS sales_monthly_by_store_uidx
  ON mart.sales_monthly_by_store (month_start, store_guid);

-- Per-store per-product per-month: для allProducts (categories/abc-xyz/products)
CREATE MATERIALIZED VIEW IF NOT EXISTS mart.sales_monthly_by_product AS
SELECT
  date_trunc('month', r.date_local)::date            AS month_start,
  r.store_guid,
  ri.product_guid,
  COALESCE(SUM(ri.quantity), 0)::numeric(18,3)       AS qty,
  COALESCE(SUM(ri.sum), 0)::numeric(18,2)            AS revenue,
  COUNT(DISTINCT r.ref_key)::int                     AS receipt_count,
  CASE WHEN SUM(ri.quantity) > 0
       THEN (SUM(ri.sum) / SUM(ri.quantity))::numeric(18,2)
       ELSE 0::numeric(18,2) END                     AS avg_price
FROM mart.receipts r
JOIN mart.receipt_items ri ON ri.receipt_ref_key = r.ref_key
WHERE ri.product_guid IS NOT NULL
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS sales_monthly_by_product_uidx
  ON mart.sales_monthly_by_product (month_start, store_guid, product_guid);
CREATE INDEX IF NOT EXISTS sales_monthly_by_product_month_idx
  ON mart.sales_monthly_by_product (month_start);
CREATE INDEX IF NOT EXISTS sales_monthly_by_product_product_idx
  ON mart.sales_monthly_by_product (product_guid);

-- Helper для FastAPI: какие месяцы доступны
CREATE OR REPLACE VIEW mart.available_months AS
SELECT DISTINCT month_start
FROM mart.sales_monthly_by_store
ORDER BY month_start;

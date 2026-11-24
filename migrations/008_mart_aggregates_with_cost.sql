-- Пересоздаём mart.sales_monthly_by_product / sales_daily_by_store_product с колонками cost/gp/markup.
-- Источник cost: mart.product_avg_cost (средневзвешенная ССБ единицы товара).
-- Покрытие по выручке ~98.6%: товары без остатка → cost = NULL → gp = NULL.

DROP MATERIALIZED VIEW IF EXISTS mart.sales_monthly_by_product CASCADE;
CREATE MATERIALIZED VIEW mart.sales_monthly_by_product AS
SELECT
  date_trunc('month', r.date_local)::date            AS month_start,
  r.store_guid,
  ri.product_guid,
  COALESCE(SUM(ri.quantity), 0)::numeric(18,3)       AS qty,
  COALESCE(SUM(ri.sum), 0)::numeric(18,2)            AS revenue,
  COUNT(DISTINCT r.ref_key)::int                     AS receipt_count,
  CASE WHEN SUM(ri.quantity) > 0
       THEN (SUM(ri.sum) / SUM(ri.quantity))::numeric(18,2)
       ELSE 0::numeric(18,2) END                     AS avg_price,
  (pac.avg_unit_cost * SUM(ri.quantity))::numeric(18,2)                       AS cost,
  (SUM(ri.sum) - pac.avg_unit_cost * SUM(ri.quantity))::numeric(18,2)         AS gross_profit,
  CASE WHEN SUM(ri.sum) > 0 AND pac.avg_unit_cost IS NOT NULL
       THEN ((SUM(ri.sum) - pac.avg_unit_cost * SUM(ri.quantity)) / SUM(ri.sum) * 100)::numeric(8,2)
       ELSE NULL END                                                          AS gross_margin_pct,
  CASE WHEN pac.avg_unit_cost > 0
       THEN ((SUM(ri.sum) - pac.avg_unit_cost * SUM(ri.quantity)) / (pac.avg_unit_cost * SUM(ri.quantity)) * 100)::numeric(10,2)
       ELSE NULL END                                                          AS markup_pct
FROM mart.receipts r
JOIN mart.receipt_items ri ON ri.receipt_ref_key = r.ref_key
LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = ri.product_guid
WHERE ri.product_guid IS NOT NULL
GROUP BY 1, 2, 3, pac.avg_unit_cost;

CREATE UNIQUE INDEX sales_monthly_by_product_uidx
  ON mart.sales_monthly_by_product (month_start, store_guid, product_guid);
CREATE INDEX sales_monthly_by_product_month_idx
  ON mart.sales_monthly_by_product (month_start);
CREATE INDEX sales_monthly_by_product_product_idx
  ON mart.sales_monthly_by_product (product_guid);


DROP MATERIALIZED VIEW IF EXISTS mart.sales_daily_by_store_product CASCADE;
CREATE MATERIALIZED VIEW mart.sales_daily_by_store_product AS
SELECT
  r.date_local,
  r.store_guid,
  ri.product_guid,
  SUM(ri.quantity)::numeric(18,3)        AS qty,
  SUM(ri.sum)::numeric(18,2)             AS revenue,
  COUNT(DISTINCT r.ref_key)::int         AS receipt_count,
  (pac.avg_unit_cost * SUM(ri.quantity))::numeric(18,2)                       AS cost,
  (SUM(ri.sum) - pac.avg_unit_cost * SUM(ri.quantity))::numeric(18,2)         AS gross_profit,
  CASE WHEN SUM(ri.sum) > 0 AND pac.avg_unit_cost IS NOT NULL
       THEN ((SUM(ri.sum) - pac.avg_unit_cost * SUM(ri.quantity)) / SUM(ri.sum) * 100)::numeric(8,2)
       ELSE NULL END                                                          AS gross_margin_pct
FROM mart.receipts r
JOIN mart.receipt_items ri ON ri.receipt_ref_key = r.ref_key
LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = ri.product_guid
WHERE ri.product_guid IS NOT NULL
GROUP BY 1, 2, 3, pac.avg_unit_cost;

CREATE UNIQUE INDEX sales_daily_by_sp_uidx
  ON mart.sales_daily_by_store_product (date_local, store_guid, product_guid);
CREATE INDEX sales_daily_by_sp_date_idx
  ON mart.sales_daily_by_store_product (date_local DESC);
CREATE INDEX sales_daily_by_sp_store_idx
  ON mart.sales_daily_by_store_product (store_guid, date_local DESC);


-- Per-store per-month с маржой (сводный)
DROP MATERIALIZED VIEW IF EXISTS mart.sales_monthly_by_store CASCADE;
CREATE MATERIALIZED VIEW mart.sales_monthly_by_store AS
WITH base AS (
  SELECT
    date_trunc('month', r.date_local)::date AS month_start,
    r.store_guid,
    SUM(r.amount)                            AS revenue,
    SUM(r.item_count)                        AS qty,
    COUNT(*)                                 AS receipt_count
  FROM mart.receipts r
  GROUP BY 1, 2
), gp AS (
  SELECT
    month_start, store_guid,
    SUM(revenue)      AS gp_revenue,
    SUM(cost)         AS gp_cost
  FROM mart.sales_monthly_by_product
  WHERE cost IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  b.month_start,
  b.store_guid,
  b.revenue::numeric(18,2)            AS revenue,
  b.qty::int                          AS qty,
  b.receipt_count::int                AS receipt_count,
  CASE WHEN b.receipt_count > 0
       THEN (b.revenue / b.receipt_count)::numeric(18,2)
       ELSE 0::numeric(18,2) END      AS avg_check,
  gp.gp_cost::numeric(18,2)                          AS cost,
  (b.revenue - COALESCE(gp.gp_cost, 0))::numeric(18,2) AS gross_profit,
  CASE WHEN gp.gp_revenue > 0
       THEN ((gp.gp_revenue - gp.gp_cost) / gp.gp_revenue * 100)::numeric(8,2)
       ELSE NULL END                  AS gross_margin_pct
FROM base b
LEFT JOIN gp USING (month_start, store_guid);

CREATE UNIQUE INDEX sales_monthly_by_store_uidx
  ON mart.sales_monthly_by_store (month_start, store_guid);


-- Helper-view с месяцами не меняется
CREATE OR REPLACE VIEW mart.available_months AS
SELECT DISTINCT month_start
FROM mart.sales_monthly_by_store
ORDER BY month_start;


-- Daily by store пересоздаём с маржой
DROP MATERIALIZED VIEW IF EXISTS mart.sales_daily_by_store CASCADE;
CREATE MATERIALIZED VIEW mart.sales_daily_by_store AS
WITH base AS (
  SELECT
    date_local,
    store_guid,
    SUM(amount)     AS revenue,
    SUM(item_count) AS qty,
    COUNT(*)        AS receipt_count
  FROM mart.receipts
  GROUP BY 1, 2
), gp AS (
  SELECT
    date_local,
    store_guid,
    SUM(cost) AS gp_cost,
    SUM(revenue) AS gp_revenue
  FROM mart.sales_daily_by_store_product
  WHERE cost IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  b.date_local,
  b.store_guid,
  b.revenue::numeric(18,2)               AS revenue,
  b.qty::int                             AS qty,
  b.receipt_count::int                   AS receipt_count,
  gp.gp_cost::numeric(18,2)                          AS cost,
  (b.revenue - COALESCE(gp.gp_cost, 0))::numeric(18,2) AS gross_profit,
  CASE WHEN gp.gp_revenue > 0
       THEN ((gp.gp_revenue - gp.gp_cost) / gp.gp_revenue * 100)::numeric(8,2)
       ELSE NULL END                     AS gross_margin_pct
FROM base b
LEFT JOIN gp USING (date_local, store_guid);

CREATE UNIQUE INDEX sales_daily_by_store_uidx
  ON mart.sales_daily_by_store (date_local, store_guid);

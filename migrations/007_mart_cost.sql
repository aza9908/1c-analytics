-- ССБ-инфраструктура: ключи аналитики + балансы себестоимости + средняя ССБ единицы.
-- Источники в 1С:
--   raw.analytics_keys      ← Catalog_КлючиАналитикиУчетаНоменклатуры (30k)
--   raw.cost_balance        ← AccumulationRegister_СебестоимостьТоваров/Balance (55k)
-- Mart:
--   mart.analytics_keys     — плоский маппинг analytics_guid → product_guid (+склад/характеристика/серия)
--   mart.cost_balance       — текущая ССБ остатков по аналитике
--   mart.product_avg_cost   — материализованное (средневзвешенная ССБ единицы товара по всем партиям)

------------------------------------------------------------------- RAW
CREATE TABLE IF NOT EXISTS raw.analytics_keys (
  ref_key             UUID PRIMARY KEY,
  product_guid        UUID,
  store_guid          UUID,
  characteristic_guid UUID,
  series_guid         UUID,
  payload             JSONB NOT NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw.cost_balance (
  analytics_guid  UUID NOT NULL,
  partition_guid  UUID NOT NULL,             -- партия (документ-источник партии)
  quantity        NUMERIC(18, 3) NOT NULL,
  cost_no_vat     NUMERIC(18, 2) NOT NULL,
  cost_with_vat   NUMERIC(18, 2) NOT NULL,
  payload         JSONB NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (analytics_guid, partition_guid)
);

------------------------------------------------------------------ MART
CREATE TABLE IF NOT EXISTS mart.analytics_keys (
  analytics_guid      UUID PRIMARY KEY,
  product_guid        UUID,
  store_guid          UUID,
  characteristic_guid UUID,
  series_guid         UUID
);
CREATE INDEX IF NOT EXISTS mart_analytics_product_idx
  ON mart.analytics_keys (product_guid);

CREATE TABLE IF NOT EXISTS mart.cost_balance (
  analytics_guid  UUID NOT NULL,
  partition_guid  UUID NOT NULL,
  quantity        NUMERIC(18, 3) NOT NULL,
  cost_no_vat     NUMERIC(18, 2) NOT NULL,
  cost_with_vat   NUMERIC(18, 2) NOT NULL,
  PRIMARY KEY (analytics_guid, partition_guid)
);
CREATE INDEX IF NOT EXISTS mart_cost_balance_analytics_idx
  ON mart.cost_balance (analytics_guid);

-- Средняя ССБ единицы товара (без НДС, средневзвешенная по партиям).
-- Не учитывает склад: одна ставка ССБ на товар по всей сети.
-- Обновляется CONCURRENTLY после cost_balance loader'а.
CREATE MATERIALIZED VIEW IF NOT EXISTS mart.product_avg_cost AS
SELECT
  ak.product_guid,
  (SUM(cb.cost_no_vat) / NULLIF(SUM(cb.quantity), 0))::numeric(18,4) AS avg_unit_cost,
  SUM(cb.quantity)::numeric(18,3)        AS total_qty_on_stock,
  SUM(cb.cost_no_vat)::numeric(18,2)     AS total_cost_no_vat
FROM mart.cost_balance cb
JOIN mart.analytics_keys ak ON ak.analytics_guid = cb.analytics_guid
WHERE cb.quantity > 0
  AND ak.product_guid IS NOT NULL
GROUP BY ak.product_guid;

CREATE UNIQUE INDEX IF NOT EXISTS product_avg_cost_uidx
  ON mart.product_avg_cost (product_guid);

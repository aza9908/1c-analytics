-- Mart-витрины для реализации (выручка по строкам) и остатков.

-- Строки реализации (по 1 на товар/документ/строку) — для дашбордов
-- categories / products / dynamics / profitability (без себестоимости пока).
CREATE TABLE IF NOT EXISTS mart.sales (
  doc_ref_key   UUID NOT NULL,
  line_no       INT NOT NULL,
  date          TIMESTAMPTZ NOT NULL,
  date_local    DATE NOT NULL,
  store_guid    UUID,
  product_guid  UUID,
  quantity      NUMERIC(18, 3) NOT NULL DEFAULT 0,
  price         NUMERIC(18, 2) NOT NULL DEFAULT 0,
  sum           NUMERIC(18, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_ref_key, line_no)
);
CREATE INDEX IF NOT EXISTS mart_sales_date_idx
  ON mart.sales (date_local DESC);
CREATE INDEX IF NOT EXISTS mart_sales_store_date_idx
  ON mart.sales (store_guid, date_local DESC);
CREATE INDEX IF NOT EXISTS mart_sales_product_idx
  ON mart.sales (product_guid);

-- Текущие остатки (snapshot по дню, без накопления истории кроме raw.inventory_snapshots).
-- Source: AccumulationRegister_ТоварыНаСкладах/Balance()
CREATE TABLE IF NOT EXISTS mart.inventory (
  store_guid    UUID NOT NULL,
  product_guid  UUID NOT NULL,
  quantity      NUMERIC(18, 3) NOT NULL,
  as_of         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_guid, product_guid)
);
CREATE INDEX IF NOT EXISTS mart_inventory_store_idx
  ON mart.inventory (store_guid);

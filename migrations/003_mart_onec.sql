-- MART: плоские витрины для фронта/API. Денормализованные, готовые к JOIN.

CREATE SCHEMA IF NOT EXISTS mart;

-- Справочник складов. Наполняется loader'ом stores.py из `Catalog_Склады`:
-- guid/name приходят из 1С, city/color при желании проставляются вручную
-- (loader их не перетирает). Сида здесь нет — состав точек у каждой базы свой.
CREATE TABLE IF NOT EXISTS mart.stores (
  guid      UUID PRIMARY KEY,
  name      TEXT NOT NULL,
  city      TEXT,
  color     TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Номенклатура (плоская копия для JOIN)
CREATE TABLE IF NOT EXISTS mart.products (
  guid        UUID PRIMARY KEY,
  name        TEXT,
  category    TEXT,
  parent_guid UUID
);

-- Чеки (агрегат документа)
CREATE TABLE IF NOT EXISTS mart.receipts (
  ref_key     UUID PRIMARY KEY,
  date        TIMESTAMPTZ NOT NULL,
  date_local  DATE NOT NULL,             -- Asia/Almaty
  hour_local  SMALLINT NOT NULL,         -- 0..23 в локальном TZ
  store_guid  UUID NOT NULL REFERENCES mart.stores(guid) ON UPDATE CASCADE,
  amount      NUMERIC(18, 2) NOT NULL,
  item_count  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mart_receipts_date_local_idx
  ON mart.receipts (date_local DESC);
CREATE INDEX IF NOT EXISTS mart_receipts_store_date_idx
  ON mart.receipts (store_guid, date_local DESC);

-- Строки чека (детализация по товару)
CREATE TABLE IF NOT EXISTS mart.receipt_items (
  receipt_ref_key UUID NOT NULL REFERENCES mart.receipts(ref_key) ON DELETE CASCADE,
  line_no         INT NOT NULL,
  product_guid    UUID,
  quantity        NUMERIC(18, 3) NOT NULL,
  sum             NUMERIC(18, 2) NOT NULL,
  PRIMARY KEY (receipt_ref_key, line_no)
);
CREATE INDEX IF NOT EXISTS mart_receipt_items_product_idx
  ON mart.receipt_items (product_guid);

-- RAW: дампы из 1C OData. JSONB payload + плоские поля для быстрого фильтра.

CREATE SCHEMA IF NOT EXISTS raw;

-- Чеки ККМ (Document_ЧекККМ)
CREATE TABLE IF NOT EXISTS raw.receipts (
  ref_key     UUID PRIMARY KEY,
  date        TIMESTAMPTZ NOT NULL,
  store_guid  UUID,
  posted      BOOLEAN,
  amount      NUMERIC(18, 2),
  payload     JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS raw_receipts_date_idx  ON raw.receipts (date DESC);
CREATE INDEX IF NOT EXISTS raw_receipts_store_idx ON raw.receipts (store_guid);

-- Номенклатура (Catalog_Номенклатура)
CREATE TABLE IF NOT EXISTS raw.products (
  ref_key     UUID PRIMARY KEY,
  description TEXT,
  parent_key  UUID,
  is_folder   BOOLEAN,
  payload     JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Склады (Catalog_Склады)
CREATE TABLE IF NOT EXISTS raw.stores (
  ref_key     UUID PRIMARY KEY,
  description TEXT,
  payload     JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Реализации (Document_РеализацияТоваровУслуг) — для GP/cost
-- TODO: точный энд-поинт уточнит пользователь
CREATE TABLE IF NOT EXISTS raw.sales (
  ref_key     UUID PRIMARY KEY,
  date        TIMESTAMPTZ NOT NULL,
  payload     JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS raw_sales_date_idx ON raw.sales (date DESC);

-- Срезы остатков по себестоимости (AccumulationRegister_СебестоимостьТоваров.SliceLast)
-- TODO: точный энд-поинт уточнит пользователь
CREATE TABLE IF NOT EXISTS raw.inventory_snapshots (
  id             BIGSERIAL PRIMARY KEY,
  snapshot_date  DATE NOT NULL,
  store_guid     UUID,
  product_guid   UUID,
  quantity       NUMERIC(18, 3),
  cost           NUMERIC(18, 2),
  payload        JSONB,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_date, store_guid, product_guid)
);
CREATE INDEX IF NOT EXISTS raw_inventory_snap_idx
  ON raw.inventory_snapshots (snapshot_date DESC, store_guid);

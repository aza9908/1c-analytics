"""Loader: Catalog_КлючиАналитикиУчетаНоменклатуры (full refresh).

Это «розеттский камень» между регистрами учёта (себестоимость, выручка/ССБ)
и реальной номенклатурой. Раз в сутки апсёртим все ключи.
"""
from __future__ import annotations

import json
import logging

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "analytics_keys"

UPSERT_RAW = """
INSERT INTO raw.analytics_keys
  (ref_key, product_guid, store_guid, characteristic_guid, series_guid, payload, ingested_at)
SELECT
  (e->>'Ref_Key')::uuid,
  NULLIF(e->>'Номенклатура_Key','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Склад','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Характеристика_Key','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Серия_Key','00000000-0000-0000-0000-000000000000')::uuid,
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (ref_key) DO UPDATE SET
  product_guid        = EXCLUDED.product_guid,
  store_guid          = EXCLUDED.store_guid,
  characteristic_guid = EXCLUDED.characteristic_guid,
  series_guid         = EXCLUDED.series_guid,
  payload             = EXCLUDED.payload,
  ingested_at         = NOW();
"""

UPSERT_MART = """
INSERT INTO mart.analytics_keys
  (analytics_guid, product_guid, store_guid, characteristic_guid, series_guid)
SELECT
  (e->>'Ref_Key')::uuid,
  NULLIF(e->>'Номенклатура_Key','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Склад','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Характеристика_Key','00000000-0000-0000-0000-000000000000')::uuid,
  NULLIF(e->>'Серия_Key','00000000-0000-0000-0000-000000000000')::uuid
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (analytics_guid) DO UPDATE SET
  product_guid        = EXCLUDED.product_guid,
  store_guid          = EXCLUDED.store_guid,
  characteristic_guid = EXCLUDED.characteristic_guid,
  series_guid         = EXCLUDED.series_guid;
"""


def main() -> None:
    cfg = onec_config()
    with run(ENTITY, watermark_before={}) as (stats, _after):
        with OnecClient(cfg) as client, connect() as conn:
            for batch in client.paginate(
                "Catalog_КлючиАналитикиУчетаНоменклатуры",
                select="Ref_Key,Номенклатура_Key,Склад,Характеристика_Key,Серия_Key",
                page_size=2000,
            ):
                payload = json.dumps(batch, default=str)
                with conn.cursor() as cur:
                    cur.execute(UPSERT_RAW, (payload,))
                    cur.execute(UPSERT_MART, (payload,))
                conn.commit()
                stats.rows_fetched += len(batch)
                stats.rows_inserted += len(batch)
                stats.pages_fetched += 1
                logger.info("[%s] page rows=%d total=%d", ENTITY, len(batch), stats.rows_fetched)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()

"""Loader: Catalog_Склады (full refresh).

Наполняет `mart.stores` складами из 1С (guid + name). `city`/`color` —
необязательные UI-поля: их проставляют вручную (или своим сидом), и loader
их не трогает.
"""
from __future__ import annotations

import json
import logging

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "stores"

UPSERT_RAW = """
INSERT INTO raw.stores (ref_key, description, payload, ingested_at)
SELECT
  (e->>'Ref_Key')::uuid,
  e->>'Description',
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (ref_key) DO UPDATE SET
  description = EXCLUDED.description,
  payload     = EXCLUDED.payload,
  ingested_at = NOW();
"""

# Идемпотентно: добавляем новые склады, но НЕ перезаписываем уже существующие
# строки — имя/цвет могли быть поправлены вручную под UI.
UPSERT_MART = """
INSERT INTO mart.stores (guid, name)
SELECT (e->>'Ref_Key')::uuid, e->>'Description'
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'Description','') IS NOT NULL
ON CONFLICT (guid) DO NOTHING;
"""


def main() -> None:
    cfg = onec_config()
    with run(ENTITY, watermark_before={}) as (stats, _after):
        with OnecClient(cfg) as client, connect() as conn:
            for batch in client.paginate(
                "Catalog_Склады",
                select="Ref_Key,Description",
                order_by="Description",
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

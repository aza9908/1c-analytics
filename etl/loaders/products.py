"""Loader: Catalog_Номенклатура (полный refresh, апсёрт по Ref_Key)."""
from __future__ import annotations

import json
import logging

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "products"

UPSERT_RAW = """
INSERT INTO raw.products (ref_key, description, parent_key, is_folder, payload, ingested_at)
SELECT
  (e->>'Ref_Key')::uuid,
  e->>'Description',
  NULLIF(e->>'Parent_Key','')::uuid,
  COALESCE((e->>'IsFolder')::bool, false),
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (ref_key) DO UPDATE SET
  description = EXCLUDED.description,
  parent_key  = EXCLUDED.parent_key,
  is_folder   = EXCLUDED.is_folder,
  payload     = EXCLUDED.payload,
  ingested_at = NOW();
"""

UPSERT_MART = """
INSERT INTO mart.products (guid, name, category, parent_guid)
SELECT
  (e->>'Ref_Key')::uuid,
  e->>'Description',
  NULL,
  NULLIF(e->>'Parent_Key','')::uuid
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE COALESCE((e->>'IsFolder')::bool, false) = false
ON CONFLICT (guid) DO UPDATE SET
  name        = EXCLUDED.name,
  parent_guid = EXCLUDED.parent_guid;
"""


def main() -> None:
    cfg = onec_config()
    with run(ENTITY, watermark_before={}) as (stats, _after):
        with OnecClient(cfg) as client, connect() as conn:
            for batch in client.paginate(
                "Catalog_Номенклатура",
                select="Ref_Key,Description,Parent_Key,IsFolder",
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

"""Loader: текущие остатки на складах.

Source: AccumulationRegister_ТоварыНаСкладах/Balance() — виртуальная таблица 1C,
отдающая текущие остатки в плоском формате.

Стратегия:
  1) скачать все balance-записи (Постранично через $top/$skip)
  2) полностью заменить mart.inventory (TRUNCATE + INSERT)
  3) сделать snapshot в raw.inventory_snapshots (по сегодняшней дате)
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "inventory"

# Snapshot текущих остатков — записываем в raw как историю по дню.
UPSERT_RAW_SNAPSHOT = """
INSERT INTO raw.inventory_snapshots
  (snapshot_date, store_guid, product_guid, quantity, payload, ingested_at)
SELECT
  %s::date,
  NULLIF(e->>'Склад_Key','')::uuid,
  NULLIF(e->>'Номенклатура_Key','')::uuid,
  COALESCE((e->>'ВНаличииBalance')::numeric, 0),
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'Склад_Key','') IS NOT NULL
  AND NULLIF(e->>'Номенклатура_Key','') IS NOT NULL
ON CONFLICT (snapshot_date, store_guid, product_guid) DO UPDATE
  SET quantity = EXCLUDED.quantity,
      payload  = EXCLUDED.payload,
      ingested_at = NOW();
"""

INSERT_MART = """
INSERT INTO mart.inventory (store_guid, product_guid, quantity, as_of)
SELECT
  NULLIF(e->>'Склад_Key','')::uuid,
  NULLIF(e->>'Номенклатура_Key','')::uuid,
  COALESCE((e->>'ВНаличииBalance')::numeric, 0),
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'Склад_Key','') IS NOT NULL
  AND NULLIF(e->>'Номенклатура_Key','') IS NOT NULL
ON CONFLICT (store_guid, product_guid) DO UPDATE
  SET quantity = EXCLUDED.quantity,
      as_of    = EXCLUDED.as_of;
"""


def main() -> None:
    cfg = onec_config()
    today = date.today()
    with run(ENTITY, watermark_before={"snapshot_date": str(today)}) as (stats, after):
        # Полная замена mart.inventory: чистим, потом наполняем.
        with OnecClient(cfg) as client, connect() as conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE mart.inventory;")
            conn.commit()

            for batch in client.paginate(
                "AccumulationRegister_ТоварыНаСкладах/Balance",
                # ВНаличииBalance > 0 — отсекаем пустые ноль-строки сразу
                filter_="ВНаличииBalance gt 0",
                page_size=2000,
            ):
                payload = json.dumps(batch, default=str)
                with conn.cursor() as cur:
                    cur.execute(UPSERT_RAW_SNAPSHOT, (today, payload))
                    cur.execute(INSERT_MART, (payload,))
                conn.commit()
                stats.rows_fetched += len(batch)
                stats.rows_inserted += len(batch)
                stats.pages_fetched += 1
                logger.info("[%s] page rows=%d total=%d", ENTITY, len(batch), stats.rows_fetched)
        after["snapshot_date"] = str(today)
        after["new_ts"] = datetime.now(timezone.utc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()

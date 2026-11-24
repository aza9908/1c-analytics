"""Loader: AccumulationRegister_СебестоимостьТоваров/Balance() — текущая ССБ остатков.

Стратегия: TRUNCATE + INSERT по mart.cost_balance (как inventory).
Снапшот без истории — нам нужна актуальная ССБ единицы товара для JOIN'а с продажами.
После прогона REFRESH mart.product_avg_cost CONCURRENTLY.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "cost_balance"

# Партия — это reference на документ-источник (ОприходованиеИзлишковТоваров, ПриобретениеТоваровУслуг…).
# OData возвращает 'Партия' как UUID + 'Партия_Type' как тип документа. Нам важен только UUID,
# чтобы уникально идентифицировать строку баланса.
UPSERT_RAW = """
INSERT INTO raw.cost_balance
  (analytics_guid, partition_guid, quantity, cost_no_vat, cost_with_vat, payload, ingested_at)
SELECT
  (e->>'АналитикаУчетаНоменклатуры_Key')::uuid,
  COALESCE(NULLIF(NULLIF(e->>'Партия',''), '00000000-0000-0000-0000-000000000000')::uuid,
           '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE((e->>'КоличествоBalance')::numeric, 0),
  COALESCE((e->>'СтоимостьБезНДСBalance')::numeric, 0),
  COALESCE((e->>'СтоимостьBalance')::numeric, 0),
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'АналитикаУчетаНоменклатуры_Key','') IS NOT NULL
ON CONFLICT (analytics_guid, partition_guid) DO UPDATE SET
  quantity      = EXCLUDED.quantity,
  cost_no_vat   = EXCLUDED.cost_no_vat,
  cost_with_vat = EXCLUDED.cost_with_vat,
  payload       = EXCLUDED.payload,
  ingested_at   = NOW();
"""

INSERT_MART = """
INSERT INTO mart.cost_balance
  (analytics_guid, partition_guid, quantity, cost_no_vat, cost_with_vat)
SELECT
  (e->>'АналитикаУчетаНоменклатуры_Key')::uuid,
  COALESCE(NULLIF(NULLIF(e->>'Партия',''), '00000000-0000-0000-0000-000000000000')::uuid,
           '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE((e->>'КоличествоBalance')::numeric, 0),
  COALESCE((e->>'СтоимостьБезНДСBalance')::numeric, 0),
  COALESCE((e->>'СтоимостьBalance')::numeric, 0)
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'АналитикаУчетаНоменклатуры_Key','') IS NOT NULL
ON CONFLICT (analytics_guid, partition_guid) DO UPDATE SET
  quantity      = EXCLUDED.quantity,
  cost_no_vat   = EXCLUDED.cost_no_vat,
  cost_with_vat = EXCLUDED.cost_with_vat;
"""


def main() -> None:
    cfg = onec_config()
    with run(ENTITY, watermark_before={}) as (stats, after):
        with OnecClient(cfg) as client, connect() as conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE mart.cost_balance;")
            conn.commit()

            for batch in client.paginate(
                "AccumulationRegister_СебестоимостьТоваров/Balance",
                # Партии без остатка нам не нужны — забираем только Количество > 0.
                filter_="КоличествоBalance gt 0",
                page_size=2000,
            ):
                payload = json.dumps(batch, default=str)
                with conn.cursor() as cur:
                    cur.execute(UPSERT_RAW, (payload,))
                    cur.execute(INSERT_MART, (payload,))
                conn.commit()
                stats.rows_fetched += len(batch)
                stats.rows_inserted += len(batch)
                stats.pages_fetched += 1
                logger.info("[%s] page rows=%d total=%d", ENTITY, len(batch), stats.rows_fetched)
        after["new_ts"] = datetime.now(timezone.utc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()

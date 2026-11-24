"""Loader: реализации (Document_РеализацияТоваровУслуг) → raw.sales + mart.sales.

Инкрементальный по Date. Watermark — последний загруженный Date.
mart.sales — плоская строка реализации (1 row на товар в документе).

Внимание: себестоимость в этом документе НЕ присутствует — её рассчитывают через
AccumulationRegister_ВыручкаИСебестоимостьПродаж. Для GP/markup нужен отдельный
loader (costs) с резолвом АналитикаУчетаНоменклатуры → Номенклатура.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

# 1C OData Date — naive wall-clock в часовом поясе компании (Алматы).
ONEC_TZ = ZoneInfo("Asia/Almaty")

from etl.config import onec_config
from etl.loaders.db import connect
from etl.loaders.state import get_watermark, run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "sales"
DEFAULT_START = "2024-01-01T00:00:00"

UPSERT_RAW = """
INSERT INTO raw.sales (ref_key, date, payload, ingested_at)
SELECT
  (e->>'Ref_Key')::uuid,
  ((e->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty'),
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (ref_key) DO UPDATE SET
  date        = EXCLUDED.date,
  payload     = EXCLUDED.payload,
  ingested_at = NOW();
"""

# 1) удаляем старые строки документа (на случай если поменялось кол-во товаров)
# 2) заново вставляем все строки из payload->'Товары'
DELETE_OLD_LINES = """
DELETE FROM mart.sales
WHERE doc_ref_key IN (
  SELECT (e->>'Ref_Key')::uuid
  FROM jsonb_array_elements(%s::jsonb) AS e
);
"""

INSERT_MART_LINES = """
WITH docs AS (
  SELECT e FROM jsonb_array_elements(%s::jsonb) AS e
  WHERE COALESCE((e->>'Posted')::bool, false) = true
),
lines AS (
  SELECT
    (d.e->>'Ref_Key')::uuid                                AS doc_ref_key,
    (t.ord - 1)::int                                       AS line_no,
    ((d.e->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty') AS date,
    ((d.e->>'Date')::timestamp)::date                      AS date_local,
    NULLIF(COALESCE(t.value->>'Склад_Key', d.e->>'Склад_Key'),'')::uuid AS store_guid,
    NULLIF(t.value->>'Номенклатура_Key','')::uuid          AS product_guid,
    COALESCE((t.value->>'Количество')::numeric, 0)         AS quantity,
    COALESCE((t.value->>'Цена')::numeric, 0)               AS price,
    COALESCE((t.value->>'Сумма')::numeric, 0)              AS sum
  FROM docs d,
       jsonb_array_elements(d.e->'Товары') WITH ORDINALITY AS t(value, ord)
)
INSERT INTO mart.sales (doc_ref_key, line_no, date, date_local, store_guid, product_guid, quantity, price, sum)
SELECT doc_ref_key, line_no, date, date_local, store_guid, product_guid, quantity, price, sum
FROM lines
WHERE product_guid IS NOT NULL;
"""


def _format_odata_ts(ts: datetime) -> str:
    # 1C ждёт naive wall-clock в TZ Алматы.
    if ts.tzinfo is not None:
        ts = ts.astimezone(ONEC_TZ).replace(tzinfo=None)
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


def main() -> None:
    cfg = onec_config()
    last_ts, _ = get_watermark(ENTITY)
    start_str = _format_odata_ts(last_ts) if last_ts else DEFAULT_START
    filter_ = f"Date ge datetime'{start_str}' and Posted eq true"

    before = {"ts": start_str}
    with run(ENTITY, watermark_before=before) as (stats, after):
        max_ts: datetime | None = None
        with OnecClient(cfg) as client, connect() as conn:
            for batch in client.paginate(
                "Document_РеализацияТоваровУслуг",
                filter_=filter_,
                order_by="Date",
                page_size=200,  # документы тяжёлые из-за вложенных таблиц
            ):
                payload = json.dumps(batch, default=str)
                with conn.cursor() as cur:
                    cur.execute(UPSERT_RAW, (payload,))
                    cur.execute(DELETE_OLD_LINES, (payload,))
                    cur.execute(INSERT_MART_LINES, (payload,))
                conn.commit()
                stats.rows_fetched += len(batch)
                stats.rows_inserted += len(batch)
                stats.pages_fetched += 1
                for row in batch:
                    d = row.get("Date")
                    if not d:
                        continue
                    try:
                        ts = datetime.fromisoformat(d.replace("Z", "+00:00"))
                    except ValueError:
                        continue
                    if ts.tzinfo is None:
                        # 1C отдаёт naive — это Almaty wall-clock
                        ts = ts.replace(tzinfo=ONEC_TZ)
                    if max_ts is None or ts > max_ts:
                        max_ts = ts
                logger.info("[%s] page rows=%d total=%d", ENTITY, len(batch), stats.rows_fetched)
        if max_ts is not None:
            after["new_ts"] = max_ts
            after["ts"] = max_ts.isoformat()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    main()

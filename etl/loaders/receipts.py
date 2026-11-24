"""Loader: чеки ККМ (Document_ЧекККМ).

Инкрементальный по Date. Watermark — последний загруженный Date.
RAW: raw.receipts (UPSERT по Ref_Key).
MART: mart.receipts + mart.receipt_items (распакованные строки).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from etl.config import onec_config

# 1C OData Date — naive wall-clock в часовом поясе компании (Алматы).
ONEC_TZ = ZoneInfo("Asia/Almaty")
from etl.loaders.db import connect
from etl.loaders.state import get_watermark, run
from etl.onec.client import OnecClient

logger = logging.getLogger(__name__)

ENTITY = "receipts"
DEFAULT_START = "2024-01-01T00:00:00"

# RAW upsert: батч из jsonb-массива → UPSERT по Ref_Key
UPSERT_RAW = """
INSERT INTO raw.receipts (ref_key, date, store_guid, posted, amount, payload, ingested_at)
SELECT
  (e->>'Ref_Key')::uuid,
  (e->>'Date')::timestamptz,
  NULLIF(e->>'Склад_Key','')::uuid,
  COALESCE((e->>'Posted')::bool, false),
  COALESCE((e->>'СуммаДокумента')::numeric, 0),
  e,
  NOW()
FROM jsonb_array_elements(%s::jsonb) AS e
ON CONFLICT (ref_key) DO UPDATE SET
  date        = EXCLUDED.date,
  store_guid  = EXCLUDED.store_guid,
  posted      = EXCLUDED.posted,
  amount      = EXCLUDED.amount,
  payload     = EXCLUDED.payload,
  ingested_at = NOW();
"""

# MART receipts upsert. ВАЖНО: 1C OData отдаёт `Date` как naive wall-clock
# в часовом поясе компании (Asia/Almaty). Поэтому:
#   - сначала ::timestamp (naive)
#   - потом AT TIME ZONE 'Asia/Almaty' → timestamptz (правильный момент в UTC)
#   - date_local / hour_local берём прямо из naive (это уже Almaty)
UPSERT_MART_RECEIPTS = """
INSERT INTO mart.receipts (ref_key, date, date_local, hour_local, store_guid, amount, item_count)
SELECT
  (e->>'Ref_Key')::uuid,
  ((e->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty'),
  ((e->>'Date')::timestamp)::date,
  EXTRACT(HOUR FROM (e->>'Date')::timestamp)::smallint,
  NULLIF(e->>'Склад_Key','')::uuid,
  COALESCE((e->>'СуммаДокумента')::numeric, 0),
  COALESCE(jsonb_array_length(e->'Товары'), 0)
FROM jsonb_array_elements(%s::jsonb) AS e
WHERE NULLIF(e->>'Склад_Key','') IS NOT NULL
  AND COALESCE((e->>'Posted')::bool, false) = true
ON CONFLICT (ref_key) DO UPDATE SET
  date        = EXCLUDED.date,
  date_local  = EXCLUDED.date_local,
  hour_local  = EXCLUDED.hour_local,
  store_guid  = EXCLUDED.store_guid,
  amount      = EXCLUDED.amount,
  item_count  = EXCLUDED.item_count;
"""

# MART receipt_items: распаковка payload->'Товары' с порядковым номером строки
UPSERT_MART_ITEMS = """
WITH receipts AS (
  SELECT e FROM jsonb_array_elements(%s::jsonb) AS e
  WHERE COALESCE((e->>'Posted')::bool, false) = true
),
items AS (
  SELECT
    (r.e->>'Ref_Key')::uuid AS receipt_ref_key,
    (t.ord - 1)::int        AS line_no,
    NULLIF(t.value->>'Номенклатура_Key','')::uuid AS product_guid,
    COALESCE((t.value->>'Количество')::numeric, 0)  AS quantity,
    COALESCE((t.value->>'Сумма')::numeric, 0)        AS sum
  FROM receipts r,
       jsonb_array_elements(r.e->'Товары') WITH ORDINALITY AS t(value, ord)
)
INSERT INTO mart.receipt_items (receipt_ref_key, line_no, product_guid, quantity, sum)
SELECT receipt_ref_key, line_no, product_guid, quantity, sum
FROM items
ON CONFLICT (receipt_ref_key, line_no) DO UPDATE SET
  product_guid = EXCLUDED.product_guid,
  quantity     = EXCLUDED.quantity,
  sum          = EXCLUDED.sum;
"""


def _format_odata_ts(ts: datetime) -> str:
    # OData v3 ждёт naive wall-clock в TZ компании (Алматы):
    # `datetime'YYYY-MM-DDThh:mm:ss'`. Если ts aware — приводим к Almaty.
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
                "Document_ЧекККМ",
                filter_=filter_,
                order_by="Date",
            ):
                payload = json.dumps(batch, default=str)
                with conn.cursor() as cur:
                    cur.execute(UPSERT_RAW, (payload,))
                    cur.execute(UPSERT_MART_RECEIPTS, (payload,))
                    cur.execute(UPSERT_MART_ITEMS, (payload,))
                conn.commit()
                stats.rows_fetched += len(batch)
                stats.rows_inserted += len(batch)
                stats.pages_fetched += 1
                # отслеживаем максимальную Date в батче для нового watermark
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

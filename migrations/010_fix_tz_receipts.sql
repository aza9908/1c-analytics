-- One-shot фикс: 1C отдаёт Date как naive wall-clock в Алматы,
-- но раньше его парсили как UTC → mart.receipts.hour_local был сдвинут +5h.
--
-- Логика фикса:
--   • raw.receipts.date: было stored как "Almaty-as-UTC" → вычитаем 5 часов,
--     чтобы получить настоящий UTC-момент (= Almaty - 5h).
--   • mart.receipts: пересоздаём date / date_local / hour_local прямо из
--     raw.receipts.payload, теперь интерпретируя Date как Almaty.
--   • то же для raw.sales / mart.sales.
--   • etl.sync_state.last_watermark_ts тоже сдвигаем (хранился как fake-UTC).

BEGIN;

-- raw.receipts.date: timestamptz, был = (Almaty wall) but tagged UTC.
-- Хотим: tagged как настоящий UTC момент = Almaty - 5h.
UPDATE raw.receipts
SET date = date - INTERVAL '5 hours';

-- mart.receipts: пересоздаём date/date_local/hour_local из raw payload.
UPDATE mart.receipts m
SET
  date       = ((rr.payload->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty'),
  date_local = ((rr.payload->>'Date')::timestamp)::date,
  hour_local = EXTRACT(HOUR FROM (rr.payload->>'Date')::timestamp)::smallint
FROM raw.receipts rr
WHERE m.ref_key = rr.ref_key;

-- raw.sales / mart.sales — то же самое.
UPDATE raw.sales SET date = date - INTERVAL '5 hours';

UPDATE mart.sales m
SET
  date       = ((rs.payload->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty'),
  date_local = ((rs.payload->>'Date')::timestamp)::date
FROM raw.sales rs
WHERE m.doc_ref_key = rs.ref_key;

-- Watermarks (last_watermark_ts): хранились как Almaty-tagged-UTC.
-- Сдвигаем на -5h чтобы получить правильный UTC момент.
UPDATE etl.sync_state
SET last_watermark_ts = last_watermark_ts - INTERVAL '5 hours'
WHERE entity IN ('receipts', 'sales')
  AND last_watermark_ts IS NOT NULL;

COMMIT;

-- Sanity-check
SELECT
  rr.payload->>'Date' AS onec_raw,
  r.date              AS stored_utc,
  r.date_local,
  r.hour_local
FROM mart.receipts r
JOIN raw.receipts rr ON rr.ref_key = r.ref_key
ORDER BY r.date DESC
LIMIT 5;

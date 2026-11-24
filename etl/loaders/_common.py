"""Общие хелперы для loader'ов: батч-upsert через jsonb_array_elements."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Iterable

logger = logging.getLogger(__name__)


def upsert_jsonb_batch(conn, sql: str, batch: Iterable[dict[str, Any]]) -> int:
    """Выполняет SQL вида:
        INSERT INTO ... SELECT ... FROM jsonb_array_elements($1::jsonb) AS x
        ON CONFLICT (...) DO ...
    передавая batch как jsonb-массив одним параметром.

    Возвращает количество строк, переданных в батч (не реально вставленных).
    Реальные insert/update метрики берём из `cur.rowcount` если нужно.
    """
    items = list(batch)
    if not items:
        return 0
    payload = json.dumps(items, default=str)
    with conn.cursor() as cur:
        cur.execute(sql, (payload,))
    return len(items)


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def to_unix(ts: datetime) -> int:
    return int(ts.timestamp())

"""ETL статус — заменяет Airflow DAG-UI.

Источник: `etl.sync_state` (текущий статус) + `etl.sync_runs` (история прогонов)
+ `etl.health` (SLA-вью).

Используется страницей `/dashboard/data` и шапкой-баннером поверх дашбордов
("данные обновлены X минут назад · все ✓ / ошибки в Y загрузчиках").
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter

from api.deps import db_conn
from api.settings import settings

router = APIRouter(tags=["etl"])

# Все исходящие timestamps — в Asia/Almaty (UTC+5).
APP_TZ = ZoneInfo(settings.timezone or "Asia/Almaty")


def _iso(dt: datetime | None) -> str | None:
    """Конвертирует datetime в ISO с offset Asia/Almaty."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(APP_TZ).isoformat()

ENTITY_LABELS = {
    "receipts": "Чеки ККМ",
    "sales": "Реализации (опт)",
    "products": "Каталог номенклатуры",
    "stores": "Каталог складов",
    "inventory": "Остатки",
    "analytics_keys": "Ключи аналитики учёта",
    "cost_balance": "Себестоимость партий",
}

# По entity — расписание для UI (все hourly, минуты разнесены).
SCHEDULE_LABELS = {
    "receipts": "каждый час, :05",
    "sales": "каждый час, :15",
    "inventory": "каждый час, :20",
    "products": "каждый час, :25",
    "stores": "каждый час, :30",
    "analytics_keys": "каждый час, :40",
    "cost_balance": "каждый час, :50",
}


@router.get("/etl-status")
async def etl_status() -> dict[str, Any]:
    """Сводный статус ETL для UI: список entity + последние прогоны."""
    async with db_conn() as conn:
        state_rows = await conn.fetch(
            """
            SELECT s.entity,
                   s.last_run_at,
                   s.last_run_status,
                   s.last_watermark_ts,
                   s.rows_added,
                   s.rows_updated,
                   EXTRACT(EPOCH FROM (NOW() - s.last_run_at))/60 AS minutes_since,
                   h.health
            FROM etl.sync_state s
            LEFT JOIN etl.health h ON h.entity = s.entity
            ORDER BY s.entity
            """
        )

        # Последние 10 запусков для каждого entity (для drill-down)
        recent_rows = await conn.fetch(
            """
            SELECT *
            FROM (
              SELECT r.entity,
                     r.started_at,
                     r.finished_at,
                     r.status,
                     r.rows_fetched,
                     r.rows_inserted,
                     r.rows_updated,
                     r.pages_fetched,
                     r.duration_ms,
                     r.error,
                     ROW_NUMBER() OVER (PARTITION BY r.entity ORDER BY r.started_at DESC) AS rn
              FROM etl.sync_runs r
            ) t
            WHERE rn <= 10
            ORDER BY entity, started_at DESC
            """
        )

    entities = []
    has_failure = False
    has_stale = False
    last_data_at = None
    for r in state_rows:
        ent = r["entity"]
        health = r["health"] or "OK"
        if health == "FAILED":
            has_failure = True
        if health == "STALE":
            has_stale = True
        last_run = r["last_run_at"]
        if last_run and (last_data_at is None or last_run > last_data_at):
            last_data_at = last_run
        entities.append({
            "entity": ent,
            "label": ENTITY_LABELS.get(ent, ent),
            "schedule": SCHEDULE_LABELS.get(ent, ""),
            "lastRunAt": _iso(last_run),
            "lastRunStatus": r["last_run_status"],
            "watermark": _iso(r["last_watermark_ts"]),
            "rowsAdded": int(r["rows_added"] or 0),
            "rowsUpdated": int(r["rows_updated"] or 0),
            "minutesSince": float(r["minutes_since"]) if r["minutes_since"] is not None else None,
            "health": health,
        })

    runs_by_entity: dict[str, list[dict]] = {}
    for r in recent_rows:
        runs_by_entity.setdefault(r["entity"], []).append({
            "startedAt": _iso(r["started_at"]),
            "finishedAt": _iso(r["finished_at"]),
            "status": r["status"],
            "rowsFetched": int(r["rows_fetched"] or 0),
            "rowsInserted": int(r["rows_inserted"] or 0),
            "rowsUpdated": int(r["rows_updated"] or 0),
            "pagesFetched": int(r["pages_fetched"] or 0),
            "durationMs": int(r["duration_ms"] or 0),
            "error": r["error"],
        })

    overall = "ok"
    if has_failure:
        overall = "failed"
    elif has_stale:
        overall = "stale"

    return {
        "overall": overall,
        "lastDataAt": _iso(last_data_at),
        "now": datetime.now(tz=APP_TZ).isoformat(),
        "timezone": str(APP_TZ),
        "entities": entities,
        "recentRuns": runs_by_entity,
    }

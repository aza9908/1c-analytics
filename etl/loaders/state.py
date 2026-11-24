"""Менеджмент watermark и истории прогонов в etl.sync_state / etl.sync_runs.

Всё в одной транзакции: begin_run → ... → end_run.
"""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterator

from etl.loaders.db import connect

logger = logging.getLogger(__name__)


@dataclass
class RunStats:
    rows_fetched: int = 0
    rows_inserted: int = 0
    rows_updated: int = 0
    pages_fetched: int = 0


def get_watermark(entity: str) -> tuple[datetime | None, int | None]:
    """Возвращает (last_watermark_ts, last_watermark_id)."""
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT last_watermark_ts, last_watermark_id "
                "FROM etl.sync_state WHERE entity = %s",
                (entity,),
            )
            row = cur.fetchone()
    if not row:
        return (None, None)
    return (row[0], row[1])


def _ensure_state_row(conn, entity: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO etl.sync_state (entity) VALUES (%s) "
            "ON CONFLICT (entity) DO NOTHING",
            (entity,),
        )


def _begin_run(conn, entity: str, watermark_before: dict[str, Any]) -> str:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO etl.sync_runs (entity, status, watermark_before) "
            "VALUES (%s, 'running', %s::jsonb) RETURNING id",
            (entity, json.dumps(watermark_before, default=str)),
        )
        run_id = cur.fetchone()[0]
        cur.execute(
            "UPDATE etl.sync_state SET last_run_at = NOW(), "
            "last_run_status = 'running', last_run_id = %s WHERE entity = %s",
            (run_id, entity),
        )
    return run_id


def _end_run(
    conn,
    run_id: str,
    entity: str,
    *,
    status: str,
    started_monotonic: float,
    stats: RunStats,
    watermark_after: dict[str, Any],
    new_ts: datetime | None,
    new_id: int | None,
    error: str | None = None,
) -> None:
    duration_ms = int((time.monotonic() - started_monotonic) * 1000)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE etl.sync_runs SET
              finished_at = NOW(),
              status = %s,
              rows_fetched = %s,
              rows_inserted = %s,
              rows_updated = %s,
              pages_fetched = %s,
              watermark_after = %s::jsonb,
              error = %s,
              duration_ms = %s
            WHERE id = %s
            """,
            (
                status,
                stats.rows_fetched,
                stats.rows_inserted,
                stats.rows_updated,
                stats.pages_fetched,
                json.dumps(watermark_after, default=str),
                error,
                duration_ms,
                run_id,
            ),
        )
        cur.execute(
            """
            UPDATE etl.sync_state SET
              last_run_status = %s,
              rows_added = %s,
              rows_updated = %s,
              last_watermark_ts = COALESCE(%s, last_watermark_ts),
              last_watermark_id = COALESCE(%s, last_watermark_id)
            WHERE entity = %s
            """,
            (
                status,
                stats.rows_inserted,
                stats.rows_updated,
                new_ts if status == "success" else None,
                new_id if status == "success" else None,
                entity,
            ),
        )


@contextmanager
def run(
    entity: str, *, watermark_before: dict[str, Any]
) -> Iterator[tuple[RunStats, dict[str, Any]]]:
    """Контекст-менеджер прогона.

    Использование:

        before = {"ts": str(last_ts)}
        with run("leads", watermark_before=before) as (stats, after):
            ...do work, mutate stats...
            after["ts"] = str(new_ts)
            after["new_ts"] = new_ts            # для записи в sync_state
            after["new_id"] = None              # для id-based watermark
    """
    stats = RunStats()
    after: dict[str, Any] = {}
    started = time.monotonic()
    started_at = datetime.now(timezone.utc)
    error: str | None = None
    status = "success"
    try:
        # Используем отдельный коннект для метаданных, чтобы прогон бизнес-логики
        # мог управлять собственными транзакциями.
        with connect(autocommit=True) as conn:
            _ensure_state_row(conn, entity)
            run_id = _begin_run(conn, entity, watermark_before)
        logger.info("[%s] run %s started at %s", entity, run_id, started_at.isoformat())
        try:
            yield stats, after
        except Exception as exc:  # noqa: BLE001
            status = "failed"
            error = repr(exc)[:1000]
            raise
        finally:
            with connect(autocommit=True) as conn:
                _end_run(
                    conn,
                    run_id,
                    entity,
                    status=status,
                    started_monotonic=started,
                    stats=stats,
                    watermark_after=after,
                    new_ts=after.get("new_ts"),
                    new_id=after.get("new_id"),
                    error=error,
                )
            logger.info(
                "[%s] run %s finished status=%s rows_fetched=%d inserted=%d updated=%d "
                "pages=%d duration_ms=%d",
                entity,
                run_id,
                status,
                stats.rows_fetched,
                stats.rows_inserted,
                stats.rows_updated,
                stats.pages_fetched,
                int((time.monotonic() - started) * 1000),
            )
    except Exception:  # noqa: BLE001
        # двойной try чтобы _end_run всегда отработал, и наружу проброшено
        raise

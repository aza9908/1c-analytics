"""Live dashboard endpoint — точное соответствие LiveDashboardData в lib/odata.ts.

Все агрегаты считаются из mart.receipts + mart.receipt_items.
Дата `latest` — последний день, для которого есть чеки. `isToday` — совпадает ли
с текущим днём в Asia/Almaty.
"""
from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from api.deps import db_conn
from api.settings import settings

router = APIRouter(prefix="/live", tags=["live"])


@router.get("/dashboard")
async def live_dashboard() -> dict:
    tz = ZoneInfo(settings.timezone)
    today = datetime.now(tz).date()

    async with db_conn() as conn:
        latest = await conn.fetchval("SELECT MAX(date_local) FROM mart.receipts")
        if latest is None:
            # Нет данных вообще — отдаём пустой каркас, фронт покажет пустое состояние.
            return _empty_response(today)

        # Сводка по магазинам (даже без чеков — чтобы было видно "0" по точке)
        by_store_rows = await conn.fetch(
            """
            SELECT s.guid, s.name, s.city, s.color,
                   COALESCE(SUM(r.amount), 0)::numeric  AS revenue,
                   COALESCE(SUM(r.item_count), 0)::int  AS qty,
                   COUNT(r.ref_key)::int                AS count
            FROM mart.stores s
            LEFT JOIN mart.receipts r
              ON r.store_guid = s.guid AND r.date_local = $1
            WHERE s.is_active IS DISTINCT FROM FALSE
            GROUP BY s.guid, s.name, s.city, s.color
            ORDER BY revenue DESC, s.name
            """,
            latest,
        )

        # Часовые срезы (8..22)
        hourly_rows = await conn.fetch(
            """
            WITH per_store AS (
              SELECT r.hour_local, s.name AS store_name,
                     SUM(r.amount)::numeric     AS revenue,
                     SUM(r.item_count)::int     AS qty,
                     COUNT(*)::int              AS cnt
              FROM mart.receipts r
              JOIN mart.stores s ON s.guid = r.store_guid
              WHERE r.date_local = $1 AND r.hour_local BETWEEN 8 AND 22
              GROUP BY r.hour_local, s.name
            )
            SELECT hour_local AS hour,
                   SUM(revenue)::numeric AS total,
                   SUM(qty)::int         AS total_qty,
                   SUM(cnt)::int         AS total_count,
                   jsonb_object_agg(store_name, revenue) AS stores
            FROM per_store
            GROUP BY hour_local
            ORDER BY hour_local
            """,
            latest,
        )

        # Топ-10 товаров за день
        top_rows = await conn.fetch(
            """
            SELECT COALESCE(p.name, ri.product_guid::text)   AS product_name,
                   s.name                                     AS store_name,
                   SUM(ri.quantity)::numeric                  AS qty,
                   SUM(ri.sum)::numeric                       AS revenue
            FROM mart.receipt_items ri
            JOIN mart.receipts r ON r.ref_key = ri.receipt_ref_key
            JOIN mart.stores s   ON s.guid = r.store_guid
            LEFT JOIN mart.products p ON p.guid = ri.product_guid
            WHERE r.date_local = $1
            GROUP BY 1, 2
            ORDER BY revenue DESC
            LIMIT 10
            """,
            latest,
        )

        prev_day_revenue = await conn.fetchval(
            """
            SELECT SUM(amount)::numeric
            FROM mart.receipts
            WHERE date_local = ($1::date - 1)
            """,
            latest,
        )

    # ---- Сборка ответа в форме LiveDashboardData ----
    by_store = [
        {
            "store": r["name"],
            "city": r["city"] or "",
            "color": r["color"] or "#6b7280",
            "revenue": float(r["revenue"] or 0),
            "qty": int(r["qty"] or 0),
            "count": int(r["count"] or 0),
            "avgCheck": (float(r["revenue"]) / r["count"]) if r["count"] else 0.0,
        }
        for r in by_store_rows
    ]
    # Магазины без чеков — оставляем, но при сортировке "топовые" окажутся первыми.

    hourly = []
    for r in hourly_rows:
        # jsonb_object_agg возвращается asyncpg как строка — парсим
        raw = r["stores"] or "{}"
        stores_json = json.loads(raw) if isinstance(raw, str) else raw
        hourly.append(
            {
                "hour": int(r["hour"]),
                "total": float(r["total"] or 0),
                "totalQty": int(r["total_qty"] or 0),
                "totalCount": int(r["total_count"] or 0),
                "stores": {k: float(v) for k, v in stores_json.items()},
            }
        )

    top_products = [
        {
            "name": r["product_name"] or "",
            "store": r["store_name"] or "",
            "qty": float(r["qty"] or 0),
            "revenue": float(r["revenue"] or 0),
        }
        for r in top_rows
    ]

    total_revenue = sum(s["revenue"] for s in by_store)
    total_qty = sum(s["qty"] for s in by_store)
    total_receipts = sum(s["count"] for s in by_store)
    avg_check = (total_revenue / total_receipts) if total_receipts else 0.0
    store_names = [s["store"] for s in by_store]

    return {
        "fetchedAt": datetime.now(tz).isoformat(),
        "dateLabel": latest.strftime("%d.%m.%Y"),
        "isToday": latest == today,
        "totalRevenue": total_revenue,
        "totalQty": total_qty,
        "totalReceipts": total_receipts,
        "avgCheck": avg_check,
        "hourly": hourly,
        "byStore": by_store,
        "topProducts": top_products,
        "prevDayRevenue": float(prev_day_revenue) if prev_day_revenue else None,
        "storeNames": store_names,
    }


def _empty_response(today) -> dict:
    return {
        "fetchedAt": datetime.now(ZoneInfo(settings.timezone)).isoformat(),
        "dateLabel": today.strftime("%d.%m.%Y"),
        "isToday": True,
        "totalRevenue": 0,
        "totalQty": 0,
        "totalReceipts": 0,
        "avgCheck": 0,
        "hourly": [],
        "byStore": [],
        "topProducts": [],
        "prevDayRevenue": None,
        "storeNames": [],
    }

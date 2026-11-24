"""Дашборд-агрегат за произвольный период.

Принимает либо `month=YYYY-MM` (whole month), либо `from=YYYY-MM-DD&to=YYYY-MM-DD`.
Источник: mart.sales_daily_by_store_product + mart.sales_daily_by_store
(daily materialized views, освежаются после receipts loader).

Cost/profit/markup = 0 пока не загружена себестоимость.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from api.deps import db_conn

router = APIRouter(tags=["data"])

MONTH_NAMES_RU = {
    1: "Январь", 2: "Февраль", 3: "Март", 4: "Апрель", 5: "Май", 6: "Июнь",
    7: "Июль", 8: "Август", 9: "Сентябрь", 10: "Октябрь", 11: "Ноябрь", 12: "Декабрь",
}

# Legacy short keys (как было раньше) → first-of-month дата
LEGACY_KEY_TO_MONTH: dict[str, str] = {
    "february": "2026-02", "march": "2026-03",
    "april": "2026-04", "may": "2026-05",
}


def _parse_month(month: str) -> tuple[date, date]:
    s = LEGACY_KEY_TO_MONTH.get(month, month)
    try:
        start = datetime.strptime(s, "%Y-%m").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"invalid month: {month!r}")
    # last day of month
    if start.month == 12:
        end = date(start.year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(start.year, start.month + 1, 1) - timedelta(days=1)
    return start, end


def _parse_date(s: str, name: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"invalid {name}: {s!r}, expected YYYY-MM-DD")


def _period_label(d_from: date, d_to: date) -> str:
    if d_from == d_to:
        return d_from.strftime("%d.%m.%Y")
    # Целый месяц
    if d_from.day == 1:
        last_day = (date(d_from.year + (1 if d_from.month == 12 else 0),
                         1 if d_from.month == 12 else d_from.month + 1, 1)
                    - timedelta(days=1))
        if d_to == last_day:
            return f"{MONTH_NAMES_RU[d_from.month]} {d_from.year}"
    # Один год
    if d_from.year == d_to.year:
        return f"{d_from.strftime('%d.%m')} – {d_to.strftime('%d.%m.%Y')}"
    return f"{d_from.strftime('%d.%m.%Y')} – {d_to.strftime('%d.%m.%Y')}"


def _classify_abc(products: list[dict[str, Any]]) -> None:
    total = sum(p["revenue"] for p in products)
    if total <= 0:
        for p in products:
            p["abcClass"] = "D"
        return
    cum = 0.0
    for p in sorted(products, key=lambda p: p["revenue"], reverse=True):
        cum += p["revenue"]
        pct = cum / total
        if p["revenue"] <= 0:
            p["abcClass"] = "D"
        elif pct <= 0.80:
            p["abcClass"] = "A"
        elif pct <= 0.95:
            p["abcClass"] = "B"
        else:
            p["abcClass"] = "C"


def _mk_group() -> dict[str, Any]:
    return {"count": 0, "revenue": 0.0, "profit": 0.0, "pctRevenue": 0.0, "pctSku": 0.0}


@router.get("/available-range")
async def available_range() -> dict:
    """Возвращает min/max даты в БД + список месяцев для UI-пресетов."""
    async with db_conn() as conn:
        row = await conn.fetchrow("SELECT min_date, max_date FROM mart.available_date_range")
        months = await conn.fetch("SELECT month_start FROM mart.available_months ORDER BY month_start DESC")
    months_list = []
    for r in months:
        m = r["month_start"]
        months_list.append({
            "month": m.strftime("%Y-%m"),
            "from": m.strftime("%Y-%m-%d"),
            "label": f"{MONTH_NAMES_RU[m.month]} {m.year}",
        })
    return {
        "minDate": row["min_date"].strftime("%Y-%m-%d") if row and row["min_date"] else None,
        "maxDate": row["max_date"].strftime("%Y-%m-%d") if row and row["max_date"] else None,
        "months": months_list,
    }


@router.get("/available-months")
async def available_months() -> dict:
    """Backward-compat — список месяцев."""
    async with db_conn() as conn:
        rows = await conn.fetch("SELECT month_start FROM mart.available_months ORDER BY month_start")
    months = []
    for r in rows:
        d = r["month_start"]
        months.append({"month": d.strftime("%Y-%m"), "label": f"{MONTH_NAMES_RU[d.month]} {d.year}"})
    return {"months": months}


@router.get("/data")
async def data(
    month: str | None = Query(None, description="YYYY-MM или legacy 'february'/'march'"),
    from_: str | None = Query(None, alias="from", description="YYYY-MM-DD"),
    to: str | None = Query(None, description="YYYY-MM-DD"),
) -> dict:
    if month:
        d_from, d_to = _parse_month(month)
    elif from_ and to:
        d_from = _parse_date(from_, "from")
        d_to = _parse_date(to, "to")
        if d_from > d_to:
            raise HTTPException(status_code=400, detail="from > to")
    else:
        raise HTTPException(status_code=400, detail="either `month` or `from`+`to` required")

    period = _period_label(d_from, d_to)

    async with db_conn() as conn:
        # Per-store totals
        store_rows = await conn.fetch(
            """
            SELECT s.guid, s.name, s.city,
                   COALESCE(SUM(d.revenue), 0)::float8       AS revenue,
                   COALESCE(SUM(d.qty),     0)::int          AS qty,
                   COALESCE(SUM(d.receipt_count), 0)::int    AS receipt_count
            FROM mart.stores s
            LEFT JOIN mart.sales_daily_by_store d
              ON d.store_guid = s.guid
              AND d.date_local BETWEEN $1 AND $2
            WHERE s.is_active IS DISTINCT FROM FALSE
            GROUP BY s.guid, s.name, s.city
            ORDER BY revenue DESC NULLS LAST, s.name
            """,
            d_from, d_to,
        )

        # Per-store: средний и медианный чек за период
        check_rows = await conn.fetch(
            """
            SELECT store_guid,
                   AVG(amount)::float8                                            AS avg_check,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount)::float8    AS median_check
            FROM mart.receipts
            WHERE date_local BETWEEN $1 AND $2
              AND amount > 0
            GROUP BY store_guid
            """,
            d_from, d_to,
        )
        check_by_store: dict[str, dict] = {
            r["store_guid"]: {"avg": r["avg_check"], "median": r["median_check"]}
            for r in check_rows
        }

        # Per-store per-product rows (с маржой)
        prod_rows = await conn.fetch(
            """
            SELECT d.store_guid, d.product_guid,
                   SUM(d.qty)::float8      AS qty,
                   SUM(d.revenue)::float8  AS revenue,
                   CASE WHEN SUM(d.qty) > 0
                        THEN (SUM(d.revenue) / SUM(d.qty))::float8
                        ELSE 0::float8 END AS price,
                   SUM(d.cost)::float8     AS cost,
                   SUM(d.gross_profit)::float8 AS profit,
                   p.name              AS product_name,
                   s.name              AS store_name
            FROM mart.sales_daily_by_store_product d
            JOIN mart.stores   s ON s.guid = d.store_guid
            LEFT JOIN mart.products p ON p.guid = d.product_guid
            WHERE d.date_local BETWEEN $1 AND $2
              AND s.is_active IS DISTINCT FROM FALSE
            GROUP BY d.store_guid, d.product_guid, p.name, s.name
            HAVING SUM(d.revenue) > 0
            ORDER BY revenue DESC
            """,
            d_from, d_to,
        )

        # Inventory
        inv_rows = await conn.fetch(
            "SELECT store_guid, product_guid, quantity::float8 AS quantity FROM mart.inventory WHERE quantity > 0"
        )

    store_positions: dict[str, int] = {}
    stock_map: dict[tuple[str, str], float] = {}
    for r in inv_rows:
        key = (r["store_guid"], r["product_guid"])
        stock_map[key] = r["quantity"]
        store_positions[r["store_guid"]] = store_positions.get(r["store_guid"], 0) + 1

    # speed = qty / days_in_period
    days_in_period = max(1, (d_to - d_from).days + 1)

    by_store_products: dict[str, list[dict[str, Any]]] = {}
    for r in prod_rows:
        free_stock = stock_map.get((r["store_guid"], r["product_guid"]))
        qty = r["qty"]
        speed = qty / days_in_period if qty > 0 else 0
        days_supply = (free_stock / speed) if free_stock and speed > 0 else None
        revenue = r["revenue"] or 0
        cost = r["cost"] if r["cost"] is not None else None
        profit = r["profit"] if r["profit"] is not None else None
        rentability = (profit / revenue * 100) if (profit is not None and revenue > 0) else None
        markup = (profit / cost * 100) if (profit is not None and cost and cost > 0) else None
        by_store_products.setdefault(r["store_guid"], []).append({
            "name": r["product_name"] or str(r["product_guid"])[:8],
            "supplier": "",
            "abcDeals": "",
            "xyzClass": "Z",
            "price": r["price"],
            "soldQty": qty,
            "revenue": revenue,
            "cost": cost if cost is not None else 0.0,
            "profit": profit if profit is not None else 0.0,
            "rentability": round(rentability, 2) if rentability is not None else 0.0,
            "markup": round(markup, 2) if markup is not None else 0.0,
            "daysInStock": days_in_period if free_stock else None,
            "speed": round(speed, 3) if speed > 0 else None,
            "daysSupply": round(days_supply, 1) if days_supply else None,
            "freeStock": free_stock,
            "surplusSum": (free_stock * cost) if (free_stock and cost) else None,
            "store": r["store_name"],
        })

    stores_payload = []
    all_products = []
    for s in store_rows:
        sguid = s["guid"]
        prods = by_store_products.get(sguid, [])
        _classify_abc(prods)
        abc = {"A": _mk_group(), "B": _mk_group(), "C": _mk_group()}
        for p in prods:
            cls = p["abcClass"]
            if cls in ("A", "B", "C"):
                abc[cls]["count"] += 1
                abc[cls]["revenue"] += p["revenue"]
                abc[cls]["profit"] += p["profit"]
        rev_total = s["revenue"]
        sku_total = len(prods)
        for key in ("A", "B", "C"):
            abc[key]["pctRevenue"] = (abc[key]["revenue"] / rev_total * 100) if rev_total > 0 else 0
            abc[key]["pctSku"] = (abc[key]["count"] / sku_total * 100) if sku_total > 0 else 0
        xyz = {"X": 0, "Y": 0, "Z": len(prods)}
        positions = store_positions.get(sguid, 0)

        store_cost = sum(p["cost"] for p in prods)
        store_profit = sum(p["profit"] for p in prods)
        avg_rent = (store_profit / rev_total * 100) if rev_total > 0 else 0
        avg_markup = (store_profit / store_cost * 100) if store_cost > 0 else 0
        surplus_total = sum((p.get("surplusSum") or 0) for p in prods)
        loss_products = [
            {"name": p["name"], "revenue": p["revenue"], "cost": p["cost"], "loss": p["cost"] - p["revenue"]}
            for p in prods
            if p["cost"] and p["cost"] > p["revenue"] and p["revenue"] > 0
        ]
        loss_products.sort(key=lambda x: -x["loss"])

        checks = check_by_store.get(sguid, {})
        stores_payload.append({
            "store": s["name"],
            "city": s["city"] or "",
            "products": prods,
            "totalRevenue": rev_total,
            "totalCost": round(store_cost, 2),
            "totalProfit": round(store_profit, 2),
            "totalQty": s["qty"],
            "avgRentability": round(avg_rent, 2),
            "avgMarkup": round(avg_markup, 2),
            "avgCheck": round(checks.get("avg") or 0, 2),
            "medianCheck": round(checks.get("median") or 0, 2),
            "receiptCount": int(s["receipt_count"] or 0),
            "soldSkuCount": sku_total,
            "deadSkuCount": max(0, positions - sku_total),
            "surplusTotal": round(surplus_total, 2),
            "lossProducts": loss_products[:20],
            "abc": abc,
            "xyz": xyz,
        })
        all_products.extend(prods)

    total_revenue = sum(s["totalRevenue"] for s in stores_payload)
    total_cost = sum(s["totalCost"] for s in stores_payload)
    total_profit = sum(s["totalProfit"] for s in stores_payload)
    total_qty = sum(s["totalQty"] for s in stores_payload)
    total_sold_sku = sum(s["soldSkuCount"] for s in stores_payload)
    total_dead_sku = sum(s["deadSkuCount"] for s in stores_payload)
    total_surplus = sum(s["surplusTotal"] for s in stores_payload)
    avg_rent_total = (total_profit / total_revenue * 100) if total_revenue > 0 else 0
    avg_markup_total = (total_profit / total_cost * 100) if total_cost > 0 else 0

    return {
        "period": period,
        "from": d_from.strftime("%Y-%m-%d"),
        "to": d_to.strftime("%Y-%m-%d"),
        "stores": stores_payload,
        "allProducts": all_products,
        "totalRevenue": total_revenue,
        "totalCost": round(total_cost, 2),
        "totalProfit": round(total_profit, 2),
        "totalQty": total_qty,
        "avgRentability": round(avg_rent_total, 2),
        "avgMarkup": round(avg_markup_total, 2),
        "totalSurplus": round(total_surplus, 2),
        "totalDeadSku": total_dead_sku,
        "totalSoldSku": total_sold_sku,
    }

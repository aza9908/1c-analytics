"""
MCP server for the 1c-analytics `onec` Postgres database. Exposes read-only
analytics over the `mart` schema (and a sliver of `etl`) to Claude via the
MCP streamable-HTTP transport.

Data model — schema `mart`
==========================

Dimensions
----------
  stores(guid, name, city, is_active)              — 9 stores, 7 active.
  products(guid, name, parent_guid)                — ~16k SKUs.

Facts
-----
  receipts(ref_key, date, date_local, hour_local,
           store_guid, amount, item_count)         — retail receipts (Document_ЧекККМ).
  receipt_items(receipt_ref_key, line_no,
                product_guid, quantity, sum)       — lines of each receipt.
  sales(...)                                       — wholesale (Document_Реализация). Small (~140 lines).
  inventory(store_guid, product_guid,
            quantity, as_of)                       — current stock balance (truncate+insert daily).

Cost / profitability backbone
-----------------------------
  cost_balance, analytics_keys                     — raw cost-of-goods inputs.
  product_avg_cost(product_guid, avg_unit_cost,
                   total_qty_on_stock,
                   total_cost_no_vat)              — matview, weighted avg cost per SKU.

Aggregates (matviews — what dashboards actually read)
-----------------------------------------------------
  sales_daily_by_store_product
        (date_local, store_guid, product_guid,
         qty, revenue, receipt_count,
         cost, gross_profit, gross_margin_pct)     — finest grain, ~100k rows.

  sales_daily_by_store
        (date_local, store_guid,
         revenue, qty, receipt_count,
         cost, gross_profit, gross_margin_pct)     — per-day per-store, ~500 rows.

  sales_monthly_by_product
        (month_start, store_guid, product_guid,
         qty, revenue, receipt_count, avg_price,
         cost, gross_profit, gross_margin_pct,
         markup_pct)                               — month×store×product, ~40k rows.

  sales_monthly_by_store
        (month_start, store_guid,
         revenue, qty, receipt_count, avg_check,
         cost, gross_profit, gross_margin_pct)     — month×store, ~20 rows.

Helpers
-------
  available_months(month_start)                    — months that exist in the data.
  available_date_range(min_date, max_date)         — overall date span.

ETL meta — schema `etl`
=======================
  sync_state(entity, last_run_at, last_run_status, ...) — per-entity sync info.
  health(entity, minutes_since_last_run, health)        — SLA view, marks STALE.

Conventions
===========
- All money in KZT (tenge).
- All dates are local (Asia/Almaty) — use the `*_local` / `month_start` columns.
- `gross_margin_pct` = gp / revenue × 100.
- `markup_pct` = gp / cost × 100.
- Cost is NULL for ~1.4% of revenue (SKUs sold to zero stock; partition closed).
  The aggregations propagate that as 0 in the cost column, which keeps gp/margin
  approximate but never overstated. Loss/margin tools filter to cost > 0 when needed.
"""

import contextlib
import os
import re
from collections.abc import AsyncIterator
from datetime import date, datetime
from typing import Any

import asyncpg
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

DB_DSN = (
    f"postgresql://{os.environ['ONEC_DB_USER']}:{os.environ['ONEC_DB_PASSWORD']}"
    f"@{os.environ.get('ONEC_DB_HOST', '127.0.0.1')}:{os.environ.get('ONEC_DB_PORT', '5432')}"
    f"/{os.environ.get('ONEC_DB_NAME', 'onec')}"
)

QUERY_SQL_MAX_ROWS = 1000
QUERY_SQL_TIMEOUT_MS = 15_000
SELECT_RE = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


@contextlib.asynccontextmanager
async def lifespan(_app: FastMCP) -> AsyncIterator[dict[str, asyncpg.Pool]]:
    pool = await asyncpg.create_pool(DB_DSN, min_size=1, max_size=8)
    try:
        yield {"pool": pool}
    finally:
        await pool.close()


mcp = FastMCP(
    "onec-mart",
    lifespan=lifespan,
    stateless_http=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["mcp.example.com", "127.0.0.1", "localhost"],
        allowed_origins=["https://claude.ai", "https://*.claude.ai"],
    ),
)


def _pool(ctx: Context) -> asyncpg.Pool:
    return ctx.request_context.lifespan_context["pool"]


def _serialize(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _rows(records: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [{k: _serialize(v) for k, v in r.items()} for r in records]


# ─────────────────────────────────────────────────────────────────────────────
# Schema resource — let Claude self-document
# ─────────────────────────────────────────────────────────────────────────────

@mcp.resource("schema://mart")
def schema_doc() -> str:
    """Markdown summary of the mart schema, costing model, and naming conventions.
    Read this before composing a query_sql call."""
    return __doc__ or ""


# ─────────────────────────────────────────────────────────────────────────────
# Discovery — what data is here
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def data_overview(ctx: Context) -> dict[str, Any]:
    """One-stop introspection: date range covered, latest receipt, inventory snapshot age,
    row counts, ETL health, and revenue for the last 7/30 days.

    Call this FIRST in a fresh conversation to know what time window is meaningful and
    whether the data is fresh enough to answer "today"/"now" questions.
    """
    p = _pool(ctx)
    overview = await p.fetchrow(
        """
        SELECT
            (SELECT min_date FROM mart.available_date_range)        AS first_date,
            (SELECT max_date FROM mart.available_date_range)        AS last_date,
            (SELECT MAX(as_of) FROM mart.inventory)                 AS inventory_as_of,
            (SELECT COUNT(*) FROM mart.receipts)                    AS receipts_total,
            (SELECT COUNT(*) FROM mart.products)                    AS products_total,
            (SELECT COUNT(*) FROM mart.stores WHERE is_active)      AS active_stores,
            (SELECT COALESCE(SUM(revenue),0)::float FROM mart.sales_daily_by_store
                WHERE date_local >= (SELECT max_date FROM mart.available_date_range) - INTERVAL '6 days') AS revenue_last_7d,
            (SELECT COALESCE(SUM(revenue),0)::float FROM mart.sales_daily_by_store
                WHERE date_local >= (SELECT max_date FROM mart.available_date_range) - INTERVAL '29 days') AS revenue_last_30d,
            (SELECT COALESCE(SUM(gross_profit),0)::float FROM mart.sales_daily_by_store
                WHERE date_local >= (SELECT max_date FROM mart.available_date_range) - INTERVAL '29 days') AS gross_profit_last_30d
        """
    )
    months = await p.fetch("SELECT month_start FROM mart.available_months ORDER BY month_start")
    etl = await p.fetch("SELECT entity, last_run_at, last_run_status, minutes_since_last_run::float, health FROM etl.health ORDER BY entity")
    return {
        **{k: _serialize(v) for k, v in overview.items()},
        "available_months": [m["month_start"].isoformat() for m in months],
        "etl_health": _rows(etl),
    }


@mcp.tool()
async def list_stores(ctx: Context, only_active: bool = True) -> list[dict[str, Any]]:
    """List stores (магазины). Returns guid, name, city, is_active.
    Use this to discover `store_guid` values before passing them to other tools.
    """
    sql = "SELECT guid::text, name, city, is_active FROM mart.stores"
    if only_active:
        sql += " WHERE is_active = true"
    sql += " ORDER BY name"
    return _rows(await _pool(ctx).fetch(sql))


@mcp.tool()
async def search_products(
    ctx: Context, query: str, limit: int = 20
) -> list[dict[str, Any]]:
    """Find products by name (case-insensitive substring) and return guid, name,
    weighted-avg unit cost, and total stock across all stores.

    Use this to resolve a product_guid before drill-down tools (product_card, stock, etc).
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT p.guid::text,
               p.name,
               pac.avg_unit_cost::float,
               pac.total_qty_on_stock::float AS stock_total,
               COALESCE((SELECT COUNT(*) FROM mart.inventory i
                         WHERE i.product_guid = p.guid AND i.quantity > 0), 0) AS stores_with_stock
        FROM mart.products p
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = p.guid
        WHERE p.name ILIKE '%' || $1 || '%'
        ORDER BY p.name
        LIMIT $2
        """,
        query,
        limit,
    )
    return _rows(rows)


@mcp.tool()
async def available_periods(ctx: Context) -> dict[str, Any]:
    """Returns the list of months available + overall min/max date.
    Use to pick a sensible period when the user says "last month" / "this quarter" etc.
    """
    p = _pool(ctx)
    months = await p.fetch("SELECT month_start FROM mart.available_months ORDER BY month_start")
    rng = await p.fetchrow("SELECT min_date, max_date FROM mart.available_date_range")
    return {
        "months": [m["month_start"].isoformat() for m in months],
        "min_date": rng["min_date"].isoformat() if rng["min_date"] else None,
        "max_date": rng["max_date"].isoformat() if rng["max_date"] else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sales — revenue + profit
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def period_summary(
    ctx: Context,
    date_from: date,
    date_to: date,
    store_guid: str | None = None,
) -> dict[str, Any]:
    """Aggregate sales for a date range (inclusive): revenue, receipt count, items sold,
    average check, cost-of-goods, gross profit, and margin/markup percent.

    Backed by `mart.sales_daily_by_store` for speed. Optional `store_guid` filters to one store.
    Use this for "how much did we sell from X to Y" / "what's the margin this month" questions.
    """
    row = await _pool(ctx).fetchrow(
        """
        SELECT
            COALESCE(SUM(revenue),0)::float       AS revenue,
            COALESCE(SUM(cost),0)::float          AS cost,
            COALESCE(SUM(gross_profit),0)::float  AS gross_profit,
            COALESCE(SUM(qty),0)                  AS items_sold,
            COALESCE(SUM(receipt_count),0)        AS receipts,
            CASE WHEN SUM(receipt_count) > 0
                 THEN (SUM(revenue) / SUM(receipt_count))::float ELSE 0 END AS avg_check,
            CASE WHEN SUM(revenue) > 0
                 THEN (SUM(gross_profit) / SUM(revenue) * 100)::float ELSE 0 END AS gross_margin_pct,
            CASE WHEN SUM(cost) > 0
                 THEN (SUM(gross_profit) / SUM(cost) * 100)::float ELSE 0 END AS markup_pct
        FROM mart.sales_daily_by_store
        WHERE date_local BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR store_guid = $3::uuid)
        """,
        date_from, date_to, store_guid,
    )
    return {k: _serialize(v) for k, v in row.items()}


@mcp.tool()
async def by_store(
    ctx: Context,
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    """Per-store revenue / cost / gross_profit / margin for a date range.
    Sorted by revenue desc. Use for "compare stores" / "which point performs best" questions.
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT s.name, s.city,
               COALESCE(SUM(d.revenue),0)::float       AS revenue,
               COALESCE(SUM(d.cost),0)::float          AS cost,
               COALESCE(SUM(d.gross_profit),0)::float  AS gross_profit,
               COALESCE(SUM(d.receipt_count),0)        AS receipts,
               CASE WHEN SUM(d.receipt_count) > 0
                    THEN (SUM(d.revenue)/SUM(d.receipt_count))::float ELSE 0 END AS avg_check,
               CASE WHEN SUM(d.revenue) > 0
                    THEN (SUM(d.gross_profit)/SUM(d.revenue)*100)::float ELSE 0 END AS gross_margin_pct
        FROM mart.stores s
        LEFT JOIN mart.sales_daily_by_store d
          ON d.store_guid = s.guid
         AND d.date_local BETWEEN $1 AND $2
        GROUP BY s.name, s.city
        ORDER BY revenue DESC
        """,
        date_from, date_to,
    )
    return _rows(rows)


@mcp.tool()
async def daily_trend(
    ctx: Context,
    date_from: date,
    date_to: date,
    store_guid: str | None = None,
) -> list[dict[str, Any]]:
    """Daily revenue + cost + gross_profit + margin series over a date range.
    One row per day. Use for trend charts and anomaly detection.
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT date_local                        AS day,
               SUM(revenue)::float               AS revenue,
               SUM(cost)::float                  AS cost,
               SUM(gross_profit)::float          AS gross_profit,
               SUM(receipt_count)                AS receipts,
               CASE WHEN SUM(revenue) > 0
                    THEN (SUM(gross_profit)/SUM(revenue)*100)::float ELSE 0 END AS gross_margin_pct
        FROM mart.sales_daily_by_store
        WHERE date_local BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR store_guid = $3::uuid)
        GROUP BY date_local
        ORDER BY date_local
        """,
        date_from, date_to, store_guid,
    )
    return _rows(rows)


@mcp.tool()
async def monthly_trend(
    ctx: Context,
    store_guid: str | None = None,
) -> list[dict[str, Any]]:
    """All months that exist in the data with revenue / cost / gross_profit / margin / markup
    / receipt_count / avg_check. Use for month-over-month comparisons and high-level trend.
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT month_start,
               SUM(revenue)::float               AS revenue,
               SUM(cost)::float                  AS cost,
               SUM(gross_profit)::float          AS gross_profit,
               SUM(receipt_count)                AS receipts,
               CASE WHEN SUM(receipt_count) > 0
                    THEN (SUM(revenue)/SUM(receipt_count))::float ELSE 0 END AS avg_check,
               CASE WHEN SUM(revenue) > 0
                    THEN (SUM(gross_profit)/SUM(revenue)*100)::float ELSE 0 END AS gross_margin_pct,
               CASE WHEN SUM(cost) > 0
                    THEN (SUM(gross_profit)/SUM(cost)*100)::float ELSE 0 END AS markup_pct
        FROM mart.sales_monthly_by_store
        WHERE ($1::uuid IS NULL OR store_guid = $1::uuid)
        GROUP BY month_start
        ORDER BY month_start
        """,
        store_guid,
    )
    return _rows(rows)


@mcp.tool()
async def hourly_pattern(
    ctx: Context,
    date_from: date,
    date_to: date,
    store_guid: str | None = None,
) -> list[dict[str, Any]]:
    """Receipt count and revenue by hour-of-day, summed across the date range.
    Use for "when are peak hours" / staffing / opening-time decisions.
    Returns 0..23 hours (rows present only for hours with activity).
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT hour_local                AS hour,
               SUM(amount)::float        AS revenue,
               COUNT(*)                  AS receipts,
               (SUM(amount)/COUNT(*))::float AS avg_check
        FROM mart.receipts
        WHERE date_local BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR store_guid = $3::uuid)
        GROUP BY hour_local
        ORDER BY hour_local
        """,
        date_from, date_to, store_guid,
    )
    return _rows(rows)


@mcp.tool()
async def top_products(
    ctx: Context,
    date_from: date,
    date_to: date,
    limit: int = 20,
    store_guid: str | None = None,
    by: str = "revenue",
) -> list[dict[str, Any]]:
    """Top products over a date range.
    `by` ∈ {"revenue", "quantity", "gross_profit", "gross_margin_pct"}.
    Returns name, qty, revenue, cost, gross_profit, gross_margin_pct.
    """
    valid = {"revenue", "quantity", "gross_profit", "gross_margin_pct"}
    if by not in valid:
        raise ValueError(f"`by` must be one of {valid}")
    order = {
        "revenue": "revenue DESC",
        "quantity": "qty DESC",
        "gross_profit": "gross_profit DESC",
        "gross_margin_pct": "gross_margin_pct DESC NULLS LAST",
    }[by]
    rows = await _pool(ctx).fetch(
        f"""
        SELECT p.name, p.guid::text AS product_guid,
               SUM(d.qty)::float           AS qty,
               SUM(d.revenue)::float       AS revenue,
               SUM(d.cost)::float          AS cost,
               SUM(d.gross_profit)::float  AS gross_profit,
               CASE WHEN SUM(d.revenue) > 0
                    THEN (SUM(d.gross_profit)/SUM(d.revenue)*100)::float ELSE 0 END AS gross_margin_pct
        FROM mart.sales_daily_by_store_product d
        LEFT JOIN mart.products p ON p.guid = d.product_guid
        WHERE d.date_local BETWEEN $1 AND $2
          AND ($3::uuid IS NULL OR d.store_guid = $3::uuid)
        GROUP BY p.name, p.guid
        ORDER BY {order}
        LIMIT $4
        """,
        date_from, date_to, store_guid, limit,
    )
    return _rows(rows)


@mcp.tool()
async def loss_products(
    ctx: Context,
    date_from: date,
    date_to: date,
    limit: int = 20,
    max_margin_pct: float = 0.0,
    store_guid: str | None = None,
) -> list[dict[str, Any]]:
    """Products operating at a loss or thin margin in the period.
    Default threshold: margin < 0 (real losses). Pass `max_margin_pct=10` for "thin margin".
    Filters to rows where cost > 0 (margin is meaningful).
    Sorted by gross_profit ascending (biggest losers first).
    """
    rows = await _pool(ctx).fetch(
        """
        WITH agg AS (
            SELECT d.product_guid,
                   SUM(d.qty)          AS qty,
                   SUM(d.revenue)      AS revenue,
                   SUM(d.cost)         AS cost,
                   SUM(d.gross_profit) AS gross_profit
            FROM mart.sales_daily_by_store_product d
            WHERE d.date_local BETWEEN $1 AND $2
              AND ($3::uuid IS NULL OR d.store_guid = $3::uuid)
            GROUP BY d.product_guid
        )
        SELECT p.name, a.product_guid::text,
               a.qty::float, a.revenue::float, a.cost::float, a.gross_profit::float,
               (a.gross_profit / NULLIF(a.revenue,0) * 100)::float AS gross_margin_pct
        FROM agg a
        LEFT JOIN mart.products p ON p.guid = a.product_guid
        WHERE a.cost > 0
          AND (a.gross_profit / NULLIF(a.revenue,0) * 100) < $4
        ORDER BY a.gross_profit ASC
        LIMIT $5
        """,
        date_from, date_to, store_guid, max_margin_pct, limit,
    )
    return _rows(rows)


@mcp.tool()
async def abc_classification(
    ctx: Context,
    date_from: date,
    date_to: date,
    store_guid: str | None = None,
) -> dict[str, Any]:
    """ABC analysis by revenue. Returns counts and revenue per tier:
      A — top SKUs cumulatively contributing first 80% of revenue
      B — next 15% (80–95%)
      C — last 5%
    Use for "what are the vital few products" decisions, assortment optimization.
    """
    rows = await _pool(ctx).fetch(
        """
        WITH agg AS (
            SELECT d.product_guid, SUM(d.revenue) AS revenue
            FROM mart.sales_daily_by_store_product d
            WHERE d.date_local BETWEEN $1 AND $2
              AND ($3::uuid IS NULL OR d.store_guid = $3::uuid)
              AND d.revenue > 0
            GROUP BY d.product_guid
        ),
        ranked AS (
            SELECT product_guid, revenue,
                   SUM(revenue) OVER (ORDER BY revenue DESC
                                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                       / SUM(revenue) OVER ()  AS cum_share
            FROM agg
        )
        SELECT CASE WHEN cum_share <= 0.80 THEN 'A'
                    WHEN cum_share <= 0.95 THEN 'B'
                    ELSE 'C' END AS tier,
               COUNT(*)              AS skus,
               SUM(revenue)::float   AS revenue
        FROM ranked
        GROUP BY tier
        ORDER BY tier
        """,
        date_from, date_to, store_guid,
    )
    return {"tiers": _rows(rows)}


# ─────────────────────────────────────────────────────────────────────────────
# Inventory
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def stock(
    ctx: Context,
    product_query: str | None = None,
    store_guid: str | None = None,
    limit: int = 50,
    only_in_stock: bool = True,
) -> list[dict[str, Any]]:
    """Current inventory rows with cost value. Filter by product name and/or store.
    Returns per (store, product): quantity, unit_cost, stock_value (qty × avg_cost), as_of.
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT s.name                       AS store,
               p.name                       AS product,
               i.quantity::float            AS quantity,
               pac.avg_unit_cost::float     AS unit_cost,
               (i.quantity * pac.avg_unit_cost)::float AS stock_value,
               i.as_of
        FROM mart.inventory i
        JOIN mart.stores   s   ON s.guid = i.store_guid
        JOIN mart.products p   ON p.guid = i.product_guid
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = i.product_guid
        WHERE ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%')
          AND ($2::uuid IS NULL OR i.store_guid = $2::uuid)
          AND ($3 IS FALSE OR i.quantity > 0)
        ORDER BY stock_value DESC NULLS LAST
        LIMIT $4
        """,
        product_query, store_guid, only_in_stock, limit,
    )
    return _rows(rows)


@mcp.tool()
async def dead_stock(
    ctx: Context,
    no_sales_since_days: int = 30,
    store_guid: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Slow-moving / dead stock: products with positive inventory that haven't sold
    in the last N days at the given store (or anywhere if store_guid is omitted).
    Sorted by tied-up capital (qty × avg_cost) descending.
    """
    rows = await _pool(ctx).fetch(
        """
        WITH cutoff AS (
            SELECT (SELECT max_date FROM mart.available_date_range) - ($1::int - 1) AS since
        ),
        recent_sellers AS (
            SELECT DISTINCT product_guid, store_guid
            FROM mart.sales_daily_by_store_product, cutoff
            WHERE date_local >= cutoff.since
              AND ($2::uuid IS NULL OR store_guid = $2::uuid)
        )
        SELECT s.name AS store,
               p.name AS product,
               i.quantity::float,
               pac.avg_unit_cost::float                          AS unit_cost,
               (i.quantity * pac.avg_unit_cost)::float           AS tied_up_capital,
               i.as_of
        FROM mart.inventory i
        JOIN mart.stores   s   ON s.guid = i.store_guid
        JOIN mart.products p   ON p.guid = i.product_guid
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = i.product_guid
        WHERE i.quantity > 0
          AND ($2::uuid IS NULL OR i.store_guid = $2::uuid)
          AND NOT EXISTS (
              SELECT 1 FROM recent_sellers r
              WHERE r.product_guid = i.product_guid
                AND r.store_guid   = i.store_guid
          )
        ORDER BY tied_up_capital DESC NULLS LAST
        LIMIT $3
        """,
        no_sales_since_days, store_guid, limit,
    )
    return _rows(rows)


@mcp.tool()
async def inventory_value(
    ctx: Context, store_guid: str | None = None
) -> dict[str, Any]:
    """Total inventory value: sum of (quantity × avg_unit_cost) across all stock.
    Returns rows_total, units_total, value_with_cost, units_without_cost (no cost reference).
    """
    row = await _pool(ctx).fetchrow(
        """
        SELECT
            COUNT(*)                                         AS rows_total,
            COALESCE(SUM(i.quantity), 0)::float              AS units_total,
            COALESCE(SUM(i.quantity * pac.avg_unit_cost), 0)::float AS value_with_cost,
            COALESCE(SUM(CASE WHEN pac.avg_unit_cost IS NULL THEN i.quantity ELSE 0 END), 0)::float
                                                             AS units_without_cost
        FROM mart.inventory i
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = i.product_guid
        WHERE i.quantity > 0
          AND ($1::uuid IS NULL OR i.store_guid = $1::uuid)
        """,
        store_guid,
    )
    return {k: _serialize(v) for k, v in row.items()}


# ─────────────────────────────────────────────────────────────────────────────
# Drill-down — one product / one store
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def product_card(
    ctx: Context,
    product_guid: str,
    lookback_days: int = 30,
) -> dict[str, Any]:
    """Everything about one product: name, average unit cost, current stock per store,
    sales in the last N days (qty/revenue/cost/gp/margin), and 30-day price avg.
    """
    p = _pool(ctx)
    info = await p.fetchrow(
        """
        SELECT p.name, p.guid::text,
               pac.avg_unit_cost::float,
               pac.total_qty_on_stock::float
        FROM mart.products p
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = p.guid
        WHERE p.guid = $1::uuid
        """,
        product_guid,
    )
    if info is None:
        return {"error": "product not found"}
    inventory = await p.fetch(
        """
        SELECT s.name AS store, i.quantity::float
        FROM mart.inventory i
        JOIN mart.stores s ON s.guid = i.store_guid
        WHERE i.product_guid = $1::uuid AND i.quantity > 0
        ORDER BY i.quantity DESC
        """,
        product_guid,
    )
    sales = await p.fetchrow(
        """
        SELECT COALESCE(SUM(qty),0)::float          AS qty,
               COALESCE(SUM(revenue),0)::float      AS revenue,
               COALESCE(SUM(cost),0)::float         AS cost,
               COALESCE(SUM(gross_profit),0)::float AS gross_profit,
               CASE WHEN SUM(revenue) > 0
                    THEN (SUM(gross_profit)/SUM(revenue)*100)::float ELSE 0 END AS gross_margin_pct
        FROM mart.sales_daily_by_store_product
        WHERE product_guid = $1::uuid
          AND date_local >= (SELECT max_date FROM mart.available_date_range) - ($2::int - 1)
        """,
        product_guid, lookback_days,
    )
    return {
        **{k: _serialize(v) for k, v in info.items()},
        "inventory_by_store": _rows(inventory),
        f"last_{lookback_days}d": {k: _serialize(v) for k, v in sales.items()},
    }


@mcp.tool()
async def store_card(
    ctx: Context,
    store_guid: str,
    lookback_days: int = 30,
) -> dict[str, Any]:
    """Everything about one store: name/city, revenue trend (last N days),
    top-10 products by revenue, inventory value, and a daily series.
    """
    p = _pool(ctx)
    store = await p.fetchrow(
        "SELECT guid::text, name, city, is_active FROM mart.stores WHERE guid = $1::uuid",
        store_guid,
    )
    if store is None:
        return {"error": "store not found"}
    summary = await p.fetchrow(
        """
        SELECT COALESCE(SUM(revenue),0)::float       AS revenue,
               COALESCE(SUM(cost),0)::float          AS cost,
               COALESCE(SUM(gross_profit),0)::float  AS gross_profit,
               COALESCE(SUM(receipt_count),0)        AS receipts,
               CASE WHEN SUM(receipt_count) > 0
                    THEN (SUM(revenue)/SUM(receipt_count))::float ELSE 0 END AS avg_check,
               CASE WHEN SUM(revenue) > 0
                    THEN (SUM(gross_profit)/SUM(revenue)*100)::float ELSE 0 END AS gross_margin_pct
        FROM mart.sales_daily_by_store
        WHERE store_guid = $1::uuid
          AND date_local >= (SELECT max_date FROM mart.available_date_range) - ($2::int - 1)
        """,
        store_guid, lookback_days,
    )
    top = await p.fetch(
        """
        SELECT p.name,
               SUM(d.qty)::float          AS qty,
               SUM(d.revenue)::float      AS revenue,
               SUM(d.gross_profit)::float AS gross_profit
        FROM mart.sales_daily_by_store_product d
        LEFT JOIN mart.products p ON p.guid = d.product_guid
        WHERE d.store_guid = $1::uuid
          AND d.date_local >= (SELECT max_date FROM mart.available_date_range) - ($2::int - 1)
        GROUP BY p.name
        ORDER BY revenue DESC
        LIMIT 10
        """,
        store_guid, lookback_days,
    )
    daily = await p.fetch(
        """
        SELECT date_local AS day, revenue::float, gross_profit::float
        FROM mart.sales_daily_by_store
        WHERE store_guid = $1::uuid
          AND date_local >= (SELECT max_date FROM mart.available_date_range) - ($2::int - 1)
        ORDER BY date_local
        """,
        store_guid, lookback_days,
    )
    inv_value = await p.fetchrow(
        """
        SELECT COALESCE(SUM(i.quantity * pac.avg_unit_cost),0)::float AS inventory_value
        FROM mart.inventory i
        LEFT JOIN mart.product_avg_cost pac ON pac.product_guid = i.product_guid
        WHERE i.store_guid = $1::uuid AND i.quantity > 0
        """,
        store_guid,
    )
    return {
        **{k: _serialize(v) for k, v in store.items()},
        "lookback_days": lookback_days,
        "summary": {k: _serialize(v) for k, v in summary.items()},
        "top_products": _rows(top),
        "daily": _rows(daily),
        "inventory_value": _serialize(inv_value["inventory_value"]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# ETL meta
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def etl_health(ctx: Context) -> list[dict[str, Any]]:
    """ETL freshness for every entity. Returns last_run_at, status, minutes since last run,
    and health (OK / STALE). Use when the user asks whether data is up-to-date.
    """
    rows = await _pool(ctx).fetch(
        """
        SELECT entity, last_run_at, last_run_status,
               minutes_since_last_run::float, rows_added, rows_updated, health
        FROM etl.health
        ORDER BY entity
        """
    )
    return _rows(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Escape hatch — arbitrary SELECT
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def query_sql(ctx: Context, sql: str) -> dict[str, Any]:
    """Run an arbitrary read-only SQL query against the `onec` database.

    Restrictions:
      - Must start with SELECT or WITH (CTE).
      - Executed in a READ ONLY transaction with a 15s statement_timeout.
      - Result capped at 1000 rows.

    Use this only when none of the structured tools above can answer the question —
    for ad-hoc joins, custom groupings, raw.* lookups, etc.
    Always read `schema://mart` first to know table/column names.
    """
    if not SELECT_RE.match(sql):
        raise ValueError("Only SELECT or WITH (CTE) queries are allowed.")
    pool = _pool(ctx)
    async with pool.acquire() as con:
        async with con.transaction(readonly=True):
            await con.execute(f"SET LOCAL statement_timeout = {QUERY_SQL_TIMEOUT_MS}")
            rows = await con.fetch(f"SELECT * FROM ({sql}) _q LIMIT {QUERY_SQL_MAX_ROWS}")
    return {
        "row_count": len(rows),
        "truncated": len(rows) == QUERY_SQL_MAX_ROWS,
        "rows": _rows(rows),
    }


app = mcp.streamable_http_app()

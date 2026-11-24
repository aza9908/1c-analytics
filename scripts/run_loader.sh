#!/usr/bin/env bash
# Универсальный раннер ETL loader'а из cron.
#
# Использование:
#   /opt/1c_analytics/scripts/run_loader.sh <entity>
#
# Где <entity> — имя модуля под etl.loaders: receipts, products, stores, sales, inventory.
# Логи: /opt/1c_analytics/airflow/logs/<entity>.log (ротация — на сегодня хватит, потом logrotate).

set -euo pipefail

ENTITY="${1:?usage: run_loader.sh <entity>}"
ROOT="/opt/1c_analytics"
LOG_DIR="$ROOT/airflow/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${ENTITY}.log"

cd "$ROOT"
# shellcheck disable=SC1091
set -a
source "$ROOT/.env"
set +a

exec >>"$LOG" 2>&1
echo
echo "============================================================"
echo "[$(date -Iseconds)] starting loader: $ENTITY"
echo "============================================================"
PYTHONPATH="$ROOT" "$ROOT/.venv/bin/python" -m "etl.loaders.${ENTITY}"

# После receipts — освежаем месячные mart-агрегаты (CONCURRENTLY чтобы не блокировать читателей).
# Порядок важен: by_product → by_store (т.к. by_store читает из by_product); по дням аналогично.
if [ "$ENTITY" = "receipts" ]; then
  echo "[$(date -Iseconds)] refreshing monthly/daily aggregates..."
  PGPASSWORD="$ONEC_DB_PASSWORD" psql -h "$ONEC_DB_HOST" -p "${ONEC_DB_PORT:-5432}" -U "$ONEC_DB_USER" -d "$ONEC_DB_NAME" -v ON_ERROR_STOP=1 -c "
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_monthly_by_product;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_daily_by_store_product;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_monthly_by_store;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_daily_by_store;
  "
fi

# После cost_balance — пересчитываем среднюю ССБ единицы товара.
# (analytics_keys тоже трогает product_avg_cost через JOIN, но цены не меняет — можно не рефрешить.)
if [ "$ENTITY" = "cost_balance" ]; then
  echo "[$(date -Iseconds)] refreshing product_avg_cost + dependent aggregates..."
  PGPASSWORD="$ONEC_DB_PASSWORD" psql -h "$ONEC_DB_HOST" -p "${ONEC_DB_PORT:-5432}" -U "$ONEC_DB_USER" -d "$ONEC_DB_NAME" -v ON_ERROR_STOP=1 -c "
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.product_avg_cost;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_monthly_by_product;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_daily_by_store_product;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_monthly_by_store;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mart.sales_daily_by_store;
  "
fi

echo "[$(date -Iseconds)] finished: $ENTITY"

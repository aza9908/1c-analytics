＃ Карта витрин Postgres `onec`

> Состояние на 2026-05-12. БД 333 MB. Три схемы: **`raw`** (сырые дампы из 1C OData, JSONB + плоские поля), **`mart`** (плоские денормализованные витрины для API/дашбордов), **`etl`** (метаданные ETL — watermark, журнал прогонов, health).
>
> Loader'ы: [etl/loaders/](../etl/loaders/). Миграции: [migrations/](../migrations/). Запуск через `scripts/run_loader.sh <entity>` (вызывается из cron). После некоторых loader'ов автоматически рефрешатся materialized views.

---

## 1. Что где живёт (one-line карта)

| Schema | Type   | Имя                                  | Строк | Источник                                       | Кто пишет                                |
|--------|--------|--------------------------------------|------:|------------------------------------------------|------------------------------------------|
| etl    | table  | `sync_state`                         |     7 | —                                              | все loader'ы (state.run())              |
| etl    | table  | `sync_runs`                          |    34 | —                                              | все loader'ы                             |
| etl    | view   | `health`                             |     7 | derived                                        | автогенерация из sync_state              |
| raw    | table  | `receipts`                           | 57 545 | `Document_ЧекККМ`                              | `receipts.py` (incremental)              |
| raw    | table  | `sales`                              |    58 | `Document_РеализацияТоваровУслуг`             | `sales.py` (incremental)                 |
| raw    | table  | `products`                           | 16 369 | `Catalog_Номенклатура`                         | `products.py` (full refresh)             |
| raw    | table  | `stores`                             |     9 | `Catalog_Склады`                               | `stores.py` (full refresh)               |
| raw    | table  | `inventory_snapshots`                | 40 096 | `AccumulationRegister_ТоварыНаСкладах/Balance` | `inventory.py` (append snapshot/день)    |
| raw    | table  | `analytics_keys`                     | 30 089 | `Catalog_КлючиАналитикиУчетаНоменклатуры`     | `analytics_keys.py` (full refresh)       |
| raw    | table  | `cost_balance`                       | 34 029 | `AccumulationRegister_СебестоимостьТоваров/Balance` | `cost_balance.py` (full refresh)    |
| mart   | table  | `receipts`                           | 57 545 | derived from `raw.receipts`                    | `receipts.py`                            |
| mart   | table  | `receipt_items`                      | 142 963 | derived from `raw.receipts.Товары[]`          | `receipts.py`                            |
| mart   | table  | `sales`                              |   143 | derived from `raw.sales.Товары[]`              | `sales.py`                               |
| mart   | table  | `products`                           | 16 145 | derived from `raw.products` (без IsFolder)     | `products.py`                            |
| mart   | table  | `stores`                             |     9 | seed в migration 003 + sync                    | migration + `stores.py`                  |
| mart   | table  | `inventory`                          | 20 048 | derived from `raw.inventory_snapshots`         | `inventory.py` (TRUNCATE + INSERT)       |
| mart   | table  | `analytics_keys`                     | 30 089 | derived from `raw.analytics_keys`              | `analytics_keys.py`                      |
| mart   | table  | `cost_balance`                       | 34 029 | derived from `raw.cost_balance`                | `cost_balance.py`                        |
| mart   | matview| **`product_avg_cost`**               | 15 198 | `cost_balance ⋈ analytics_keys`                | REFRESH after `cost_balance`             |
| mart   | matview| **`sales_monthly_by_store`**         |    20 | `receipts ⋈ sales_monthly_by_product`         | REFRESH after `receipts` и `cost_balance`|
| mart   | matview| **`sales_monthly_by_product`**       | 40 333 | `receipts ⋈ items ⋈ product_avg_cost`         | REFRESH after `receipts` и `cost_balance`|
| mart   | matview| **`sales_daily_by_store`**           |   485 | `receipts ⋈ sales_daily_by_store_product`     | REFRESH after `receipts` и `cost_balance`|
| mart   | matview| **`sales_daily_by_store_product`**   | 99 550 | `receipts ⋈ items ⋈ product_avg_cost`         | REFRESH after `receipts` и `cost_balance`|
| mart   | view   | `available_months`                   |     4 | `SELECT DISTINCT FROM sales_monthly_by_store`  | автомат                                  |
| mart   | view   | `available_date_range`               |     1 | `SELECT MIN/MAX FROM mart.receipts`            | автомат                                  |

---

## 2. Конвейер (как данные едут до фронта)

```
                   ┌────────────────────────────────────────────────────────────┐
1C OData  ───►     │ etl/loaders/*.py            scripts/run_loader.sh <entity> │  ◄── cron
                   │  ├─ receipts.py   :05      ├─ INSERT raw.receipts          │     ежечасно
                   │  ├─ sales.py      :15      ├─ INSERT mart.receipts         │     или сутки
                   │  ├─ products.py   03:00    ├─ INSERT mart.receipt_items    │
                   │  ├─ stores.py     03:05    ├─ ...                          │
                   │  ├─ inventory.py  03:30    └─ REFRESH MATERIALIZED VIEW    │
                   │  ├─ analytics_keys.py 03:40   (если receipts/cost_balance) │
                   │  └─ cost_balance.py   03:45                                │
                   └────────────┬───────────────────────────────────────────────┘
                                ▼
        Postgres: raw.* (JSONB)  ──── apply mappings ────►  mart.* (плоско)
                                                                │
        ┌───────────────────────────────────────────────────────┴──────────────┐
        ▼                                                                       ▼
  mart.product_avg_cost (matview)     ┌──────────────────────────────────────────┐
  средневзвешенная ССБ единицы товара │  mart.sales_monthly_by_*  (matview)      │
        │                             │  mart.sales_daily_by_*    (matview)      │
        └──── LEFT JOIN ─────────────►│  cost / gross_profit / gross_margin_pct  │
                                      └─────────────────────┬────────────────────┘
                                                            ▼
                                              FastAPI (api/routers/data.py)
                                              /data?month=YYYY-MM
                                                            ▼
                                              Next.js  /api/data?month=…  → дашборды
```

---

## 3. RAW-слой — сырые дампы из 1C OData

JSONB-payload как пришёл + плоские поля для индексов.

### `raw.receipts` (164 MB, 57 545 строк)
PK: `ref_key`. Поля: `date`, `store_guid`, `posted`, `amount`, `payload` (JSONB), `ingested_at`.
Источник: `Document_ЧекККМ`. Loader: [`receipts.py`](../etl/loaders/receipts.py). Watermark по `Date`.

### `raw.sales` (58 строк)
PK: `ref_key`. Поля: `date`, `payload`, `ingested_at`. Источник: `Document_РеализацияТоваровУслуг`.

### `raw.products` (16 369 строк)
PK: `ref_key`. Поля: `description`, `parent_key`, `is_folder`, `payload`. Источник: `Catalog_Номенклатура`.

### `raw.stores` (9 строк)
PK: `ref_key`. Поля: `description`, `payload`. Источник: `Catalog_Склады`.

### `raw.inventory_snapshots` (40 096 строк — растёт ежесуточно)
PK: `(snapshot_date, store_guid, product_guid)`. Поля: `quantity`, `cost`, `payload`. **Append-only история** остатков по дням.

### `raw.analytics_keys` (30 089 строк)
PK: `ref_key`. Поля: `product_guid`, `store_guid`, `characteristic_guid`, `series_guid`, `payload`. Источник: `Catalog_КлючиАналитикиУчетаНоменклатуры`. Маппинг «аналитика учёта → товар».

### `raw.cost_balance` (37 MB, 34 029 строк)
PK: `(analytics_guid, partition_guid)`. Поля: `quantity`, `cost_no_vat`, `cost_with_vat`, `payload`. Источник: `AccumulationRegister_СебестоимостьТоваров/Balance`. Текущая ССБ остатков по партиям.

---

## 4. MART-слой — таблицы (то, что лежит «вечно»)

### `mart.stores` (9 строк) — справочник точек
Колонки: `guid`, `name`, `city`, `color`, `is_active`. Имена/цвета засиживаются в [migration 003](../migrations/003_mart_onec.sql), loader `stores.py` **не перезатирает** их.

### `mart.products` (16 145 строк) — товары без папок
Колонки: `guid`, `name`, `category` (всегда NULL — категория через `parent_guid`-цепочку), `parent_guid`.

### `mart.receipts` (8.6 MB, 57 545 строк) — агрегат чеков
PK `ref_key`. Колонки: `date`, **`date_local`** (Asia/Almaty), **`hour_local`**, `store_guid` (FK→stores), `amount`, `item_count`. Индексы по `date_local DESC` и `(store_guid, date_local DESC)`.

### `mart.receipt_items` (19 MB, 142 963 строк) — строки чеков
PK `(receipt_ref_key, line_no)`. Колонки: `product_guid`, `quantity`, `sum`. Индекс по `product_guid`. ON DELETE CASCADE от `mart.receipts`.

### `mart.sales` (143 строки) — опт.продажи (строки)
PK `(doc_ref_key, line_no)`. Колонки: `date`, `date_local`, `store_guid`, `product_guid`, `quantity`, `price`, `sum`.

### `mart.inventory` (20 048 строк) — текущие остатки
PK `(store_guid, product_guid)`. Колонки: `quantity`, `as_of`. **TRUNCATE + INSERT** каждый прогон inventory.

### `mart.analytics_keys` (30 089 строк) — розеттский камень
PK `analytics_guid`. Колонки: `product_guid`, `store_guid`, `characteristic_guid`, `series_guid`. JOIN с любым cost-регистром.

### `mart.cost_balance` (34 029 строк) — ССБ по партиям
PK `(analytics_guid, partition_guid)`. Колонки: `quantity`, `cost_no_vat`, `cost_with_vat`. **TRUNCATE + INSERT** каждый прогон cost_balance.

---

## 5. MART-слой — materialized views (то, что фронт реально читает)

> **Refresh:** `CONCURRENTLY`, чтобы не блокировать читателей. Триггерится из [`scripts/run_loader.sh`](../scripts/run_loader.sh) — после receipts и после cost_balance.

### `mart.product_avg_cost` (15 198 строк) — средняя ССБ единицы товара
```sql
SELECT ak.product_guid,
       SUM(cb.cost_no_vat) / NULLIF(SUM(cb.quantity), 0) AS avg_unit_cost,
       SUM(cb.quantity)    AS total_qty_on_stock,
       SUM(cb.cost_no_vat) AS total_cost_no_vat
FROM mart.cost_balance cb
JOIN mart.analytics_keys ak ON ak.analytics_guid = cb.analytics_guid
WHERE cb.quantity > 0 AND ak.product_guid IS NOT NULL
GROUP BY ak.product_guid;
```
**Покрытие:** 15 198 товаров со склада → 98.6% выручки в чеках идёт с известной ССБ. Остальные 1.4% — товар продали в ноль, партии закрылись, ССБ нет.

### `mart.sales_monthly_by_product` (40 333 строки) — главная витрина дашбордов
Гранулярность: `(month_start, store_guid, product_guid)`. Колонки:
- `qty`, `revenue`, `receipt_count`, `avg_price`
- **`cost`** = `avg_unit_cost * qty`
- **`gross_profit`** = `revenue − cost`
- **`gross_margin_pct`** = `gp/revenue*100`
- **`markup_pct`** = `gp/cost*100`

### `mart.sales_daily_by_store_product` (17 MB, 99 550 строк) — daily-аналог
Гранулярность: `(date_local, store_guid, product_guid)`. Колонки: `qty, revenue, receipt_count, cost, gross_profit, gross_margin_pct`. Под date-range фильтры (7д/30д/произвольно).

### `mart.sales_monthly_by_store` (20 строк) — сводный по точкам
Per-store per-month: `revenue`, `qty`, `receipt_count`, `avg_check`, `cost`, `gross_profit`, `gross_margin_pct`. `cost`/`gp` приходит из агрегации `sales_monthly_by_product` (только покрытые товары).

### `mart.sales_daily_by_store` (485 строк) — daily-сводный
Аналогично, по дням.

### `mart.available_months` / `mart.available_date_range` — helper-vies
Для FastAPI — какие месяцы есть в данных + min/max дата.

---

## 6. ETL-слой — метаданные

### `etl.sync_state` (7 строк)
По строке на entity: `last_watermark_ts`, `last_run_at`, `last_run_status`, `last_run_id`, `rows_added`, `rows_updated`.

### `etl.sync_runs` (34 строк, растёт)
Журнал прогонов: `entity`, `started_at/finished_at`, `status`, `rows_fetched/inserted/updated`, `pages_fetched`, `watermark_before/after` (JSONB), `error`, `duration_ms`. Индексы по `(entity, started_at DESC)` и по `status WHERE status<>'success'`.

### `etl.health` (view)
SLA-вью: помечает entity как `STALE` если receipts/sales/inventory > 90 мин без апдейта, products/stores/analytics_keys/cost_balance > 26 ч.

```
 entity         | last_run_at | health
----------------+-------------+--------
 receipts       | … 48 мин    | OK
 sales          | … 38 мин    | OK
 inventory      | … 5 ч       | STALE  ← норма, сутки
 products       | … 5.5 ч     | OK
 stores         | … 5.5 ч     | OK
 analytics_keys | … 3.6 мин   | OK
 cost_balance   | … 3 мин     | OK
```

---

## 7. Cron-расписание (текущее)

| Время | Entity         | Стратегия         | Триггер рефреша                                   |
|-------|----------------|-------------------|---------------------------------------------------|
| `:05` ежечасно | receipts       | incremental      | REFRESH all sales_* (monthly/daily, by_store/product) |
| `:15` ежечасно | sales          | incremental      | —                                                 |
| `03:00` суточно | products       | full refresh    | —                                                 |
| `03:05` суточно | stores         | full refresh    | —                                                 |
| `03:30` суточно | inventory      | TRUNCATE+INSERT  | —                                                 |
| `03:40` суточно | analytics_keys | full refresh    | — (рефреш делает cost_balance)                    |
| `03:45` суточно | cost_balance   | TRUNCATE+INSERT  | REFRESH product_avg_cost + all sales_*            |

`crontab -l` показывает 7 entries. Логи: [`airflow/logs/<entity>.log`](../airflow/logs/).

---

## 8. Что читает API

[`api/routers/data.py`](../api/routers/data.py) на запрос `/data?month=YYYY-MM` или `/data?from=…&to=…`:

| Витрина                              | Используется для                                |
|--------------------------------------|--------------------------------------------------|
| `mart.sales_daily_by_store`          | Per-store totals: revenue/qty/receipt_count     |
| `mart.sales_daily_by_store_product`  | Per-product rows + cost/gp                       |
| `mart.inventory`                     | freeStock, daysSupply, surplusSum                |
| `mart.stores`                        | Имя/город/цвет точки                             |
| `mart.products`                      | Имя товара                                       |
| `mart.available_months`              | Список месяцев для пикера                         |
| `mart.available_date_range`          | Min/max даты в данных                            |

[`api/routers/live.py`](../api/routers/live.py) для realtime-дашборда:
- `mart.receipts` — последний час, текущая выручка
- `mart.receipt_items` — топ-N товаров за смену

---

## 9. Что отдаётся фронту (JSON shape)

```jsonc
{
  "period": "Апрель 2026",
  "from": "2026-04-01",
  "to": "2026-04-30",
  "totalRevenue": ...,
  "totalCost":    ...,         // ← из mart.cost_balance
  "totalProfit":  ...,         // ← revenue − cost
  "avgRentability": ...,       // ← gp/revenue*100
  "avgMarkup":      ...,       // ← gp/cost*100
  "totalSurplus":  ...,        // freeStock × unit_cost суммарно
  "stores": [{
    "store": "<имя склада>", "city": "<город>",
    "totalRevenue": ..., "totalCost": ..., "totalProfit": ...,
    "avgRentability": ..., "avgMarkup": ...,
    "lossProducts": [                       // ← top-20 в минус
      {"name": "<артикул>", "revenue": ..., "cost": ..., "loss": ...}
    ],
    "abc": {"A": {...}, "B": {...}, "C": {...}},
    "xyz": {"X":0, "Y":0, "Z":N},           // пока всегда Z
    "products": [{
      "name": "...", "soldQty": ..., "revenue": ...,
      "cost": ..., "profit": ..., "rentability": 36.5, "markup": 57.6,
      "price": ..., "freeStock": ..., "speed": ..., "daysSupply": ...,
      "surplusSum": ..., "abcClass": "A"
    }]
  }],
  "allProducts": [...]
}
```

---

## 10. Что осталось/что можно добавить

| Хотелка                                  | Что нужно                                          |
|------------------------------------------|----------------------------------------------------|
| XYZ-классификация (стабильность продаж)  | Считать coefficient of variation по неделям из `sales_daily_by_store_product` |
| `category` в `mart.products`             | Решить иерархию `parent_guid` или взять `Catalog_ВидыНоменклатуры` |
| Точный GP per-документ (опт)             | Loader `AccumulationRegister_ВыручкаИСебестоимостьПродаж` (874 движений) |
| История ССБ единицы по дням              | Snapshot `mart.product_avg_cost` в `raw.product_avg_cost_history(snapshot_date, …)` |
| Возвраты                                  | Loader `Document_ЧекККМВозврат` (26 шт) + `Document_ВозвратТоваровОтКлиента` (309) |
| Z-отчёты (точная сверка по сменам)       | Loader `Document_ОтчетОРозничныхПродажах` (517 шт)  |
| Закупки/поставщики                       | Loader `Document_ПриобретениеТоваровУслуг` (1 115) |
| История цен                              | Loader `Document_УстановкаЦенНоменклатуры` (943) или `InformationRegister_ЦеныНоменклатуры` |

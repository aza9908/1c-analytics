# 1С Аналитика — архитектура

Технический срез: **что есть, как работает, почему так**. Описывает реализованную
систему по состоянию на **2026-05-12**.

> Связанные документы:
> [STATUS.md](STATUS.md) (что сделано / в работе) ·
> [CHANGELOG.md](CHANGELOG.md) (хронология) ·
> [docs/mart-map.md](docs/mart-map.md) (per-table карта витрин) ·
> [infra/README.md](infra/README.md) (deploy playbook).

---

## TL;DR

- **Без Docker, без Airflow.** Native deploy на одной ВМ Ubuntu:
  Postgres 16 (apt) + Python venv + Node.js 20 + nginx — всё под systemd.
- **cron вместо Airflow.** 7 loader-ов запускаются ежечасно (`TZ=Asia/Almaty`),
  разнесены по минутам :05 / :15 / :20 / :25 / :30 / :40 / :50. UI с DAG-вью
  лежит в `/dashboard/data`, читает `etl.sync_state`+`etl.sync_runs` напрямую.
- **Одна БД `onec`** на три схемы: `raw` (JSONB-дампы из 1С OData), `mart`
  (плоские витрины с маржой), `etl` (watermark + журнал прогонов).
- **5 materialized views** в `mart` (с маржой / GP / cost) — рефрешатся
  CONCURRENTLY после `receipts` и `cost_balance` ETL-прогонов.
- **API:** FastAPI на 8000, 4 router-а (health/live/data/etl), gzip middleware.
- **Фронт:** Next.js 16 prod build (~376 КБ gz JS), все timestamps форсятся
  в Asia/Almaty через date-fns-tz.
- **HMAC-cookie auth** (admin/admin), редирект для страниц, 401 JSON для `/api/*`.
- **nginx на 80** — gzip всех ответов (10× compression для API).

## Стек

| Слой | Технология | Версия | Зачем |
|---|---|---|---|
| Оркестратор | cron + bash | system | Минимализм, без Airflow-overhead. UI самописный. |
| ETL | Python | 3.12 | httpx (HTTP) + tenacity (ретраи) + psycopg 3 |
| OData клиент | httpx | 0.27.2 | sync `Client`, `$skip/$top` пагинация |
| Ретраи | tenacity | 9.0.0 | exp backoff 2-32с, 5 попыток на 5xx |
| Postgres | 16-alpine | nativ apt | БД `onec`, 3 схемы, materialized views |
| DB driver (ETL) | psycopg[binary] | 3.2.3 | UPSERT + jsonb_array_elements |
| DB driver (API) | asyncpg | 0.30.0 | Async для FastAPI |
| API | FastAPI | 0.115.5 | uvicorn[standard] + GZipMiddleware |
| Фронт | Next.js | 16.2.1 | App Router, React 19, Turbopack |
| UI | shadcn/ui + tailwind 4 | — | radix-ui под капотом |
| Auth | self-rolled HMAC | — | edge-friendly через `crypto.subtle` |
| Reverse proxy | nginx | 1.24 | TLS-terminator-ready + gzip |
| Reverse proxy | (опционально) | — | Cloudflare/Vercel для production |

## Схема развёртывания

```
                 ┌─────────────────────────────────────────────────┐
                 │  Браузер (TZ может быть любой; UI форсит Almaty) │
                 └────────────────────────┬────────────────────────┘
                                          │ HTTPS / HTTP
                                          ▼
                              ┌──────────────────────┐
                              │  nginx :80           │
                              │  gzip on             │
                              └──────────┬───────────┘
                                         │ HTTP keep-alive
                                         ▼
                              ┌──────────────────────┐
                              │  Next.js :3000       │
                              │  (next start, prod)  │
                              │  Middleware: auth    │
                              │  /api/* proxy        │
                              └──────────┬───────────┘
                                         │ undici fetch (localhost)
                                         ▼
                              ┌──────────────────────┐
                              │  FastAPI :8000       │
                              │  uvicorn (1 worker)  │
                              │  asyncpg pool 1-10   │
                              └──────────┬───────────┘
                                         │ unix socket / TCP
                                         ▼
                              ┌──────────────────────┐
                              │  Postgres :5432      │
                              │  БД: onec            │
                              │  Schemas: raw/mart/etl │
                              └──────────▲───────────┘
                                         │ psycopg 3
                                         │
                              ┌──────────┴───────────┐         ┌──────────────────┐
                              │  cron → run_loader.sh │ ──────▶ │  1С OData        │
                              │  (ETL hourly)         │  HTTPS  │  odata.example.com     │
                              │  TZ=Asia/Almaty       │  basic  │  ts1/…/standard  │
                              └──────────────────────┘   auth   └──────────────────┘
```

## Конвейер данных

```
1C OData
   │
   │  receipts.py + sales.py + products.py + stores.py +
   │  inventory.py + analytics_keys.py + cost_balance.py
   ▼
raw.* (JSONB payload + плоские поля)
   │
   │  UPSERT по Ref_Key, distill в плоские колонки
   ▼
mart.* (таблицы)
   │
   │  REFRESH MATERIALIZED VIEW CONCURRENTLY
   │  после receipts (ежечасно) и cost_balance (ежечасно :50)
   ▼
mart.product_avg_cost                       (15k товаров с ССБ)
mart.sales_monthly_by_store(_product)       (для месяцев)
mart.sales_daily_by_store(_product)         (для range 7/30/90/custom)
   │
   │  FastAPI агрегирует по диапазону
   ▼
/data?from=…&to=… или /data?month=YYYY-MM   (FebReportData shape)
   │
   ▼
Next.js /api/data?* → DataProvider → дашборды
```

## Cron расписание (Asia/Almaty)

```
:05  receipts        ─ incremental (watermark по date)
                       ↳ REFRESH all sales_* materialized views
:15  sales           ─ incremental
:20  inventory       ─ full refresh ТоварыНаСкладах/Balance
:25  products        ─ full refresh Catalog_Номенклатура
:30  stores          ─ full refresh Catalog_Склады
:40  analytics_keys  ─ full refresh, 30k записей
:50  cost_balance    ─ full refresh, 34k партий
                       ↳ REFRESH all sales_* materialized views
                         (маржа пересчитывается)
```

SLA (`etl.health` view): любой entity без апдейта > 90 минут → `STALE`.

## Слои БД

### `raw.*` — сырые дампы

| Таблица | Источник | PK | JSONB-payload |
|---|---|---|---|
| `raw.receipts` | `Document_ЧекККМ` | ref_key | + плоские: date, store_guid, amount |
| `raw.sales` | `Document_РеализацияТоваровУслуг` | ref_key | + date |
| `raw.products` | `Catalog_Номенклатура` | ref_key | + description, parent_key |
| `raw.stores` | `Catalog_Склады` | ref_key | + description |
| `raw.inventory_snapshots` | `Balance()` ТоварыНаСкладах | (snap_date, store, product) | append-only по дню |
| `raw.analytics_keys` | `Catalog_КлючиАналитикиУчётаНоменклатуры` | ref_key | + product_guid, store_guid |
| `raw.cost_balance` | `Balance()` СебестоимостьТоваров | (analytics, partition) | + quantity, cost_no_vat |

### `mart.*` — таблицы

Денормализованные с FK на `mart.stores`. Главные:

- `mart.receipts` — 1 строка на чек (+date_local Asia/Almaty + hour_local).
- `mart.receipt_items` — строки чеков (CASCADE от receipts).
- `mart.inventory` — текущие остатки (TRUNCATE + INSERT каждый прогон).
- `mart.cost_balance` — текущие партии ССБ.
- `mart.analytics_keys` — Rosetta аналитика → товар.

### `mart.*` — materialized views (агрегаты)

| View | Гранулярность | Источник | Колонки |
|---|---|---|---|
| `product_avg_cost` | per product | cost_balance ⋈ analytics_keys | avg_unit_cost, total_qty_on_stock |
| `sales_monthly_by_store` | month × store | receipts | revenue, qty, receipt_count, avg_check, cost, gross_profit, gross_margin_pct |
| `sales_monthly_by_product` | month × store × product | receipts ⋈ items ⋈ product_avg_cost | + cost / GP / margin_pct |
| `sales_daily_by_store` | date × store | receipts | … |
| `sales_daily_by_store_product` | date × store × product | … | … |

Refresh — после `receipts` и `cost_balance` через `REFRESH MATERIALIZED VIEW CONCURRENTLY`
(не блокирует читателей).

### `etl.*` — метаданные

- `etl.sync_state` — текущий статус per entity (`last_run_at`, `last_run_status`, `watermark_ts`).
- `etl.sync_runs` — журнал прогонов (~∞ строк, индекс `(entity, started_at DESC)`).
- `etl.health` — SLA-вью, мечает OK / STALE / FAILED.

## Timezone

Самый болезненный кусок проекта. Цель: всё, что видит человек — в Asia/Almaty.

**Системный сервер** работает в UTC. Меняем не клок, а интерпретацию:

1. **1C OData** отдаёт `Date` как naive wall-clock в Almaty: `"2026-05-12T15:03:23"`.
2. **ETL парсит:** `(e->>'Date')::timestamp AT TIME ZONE 'Asia/Almaty'` → правильный UTC момент.
   `(e->>'Date')::timestamp::date` → дата в Almaty. `EXTRACT(HOUR)` — час в Almaty.
3. **Watermark в Python:** `datetime.replace(tzinfo=ZoneInfo("Asia/Almaty"))`.
4. **OData filter:** `_format_odata_ts()` → `astimezone(Almaty).replace(tzinfo=None)`.
5. **API ответы:** `etl.py::_iso()` конвертит в Almaty перед `.isoformat()`. Frontend
   получает `+05:00` суффикс.
6. **Frontend display:** `lib/time.ts` использует `formatInTimeZone(d, 'Asia/Almaty', …)` —
   независимо от TZ браузера показывает Almaty.
7. **Cron:** `TZ=Asia/Almaty` в crontab → `0 3 * * *` = 3 утра Almaty (а не UTC).

Был баг +5h до миграции 010 — см. [CHANGELOG.md](CHANGELOG.md).

## API контракт

| Endpoint | Что | Auth |
|---|---|---|
| `GET /health` | DB ping | open |
| `GET /available-range` | `{minDate, maxDate, months[]}` для UI пресетов | open |
| `GET /available-months` | Список месяцев (legacy) | open |
| `GET /data?month=YYYY-MM` | Агрегат за месяц | open |
| `GET /data?from=&to=` | Агрегат за произвольный период | open |
| `GET /live/dashboard` | Сегодняшние чеки real-time | open |
| `GET /etl-status` | DAG-status + последние прогоны | open |

Auth уровня FastAPI — нет (внутренний на localhost:8000). Доступ контролит Next.js middleware:

- Pages (`/dashboard/*`) — 307 на `/login?next=…`.
- API (`/api/*`) — 401 JSON `{error: "unauthorized"}`.

## Frontend архитектура

```
app/
├── layout.tsx              ← ThemeProvider + NavigationLoader + TooltipProvider
├── login/
│   ├── page.tsx            ← glassmorphism login
│   ├── login-form.tsx      ← useActionState (server action)
│   └── actions.ts          ← HMAC cookie, secure: false (HTTP)
├── api/                    ← Next.js route handlers (proxies)
│   ├── data/route.ts       ← → FastAPI /data
│   ├── live/route.ts       ← → FastAPI /live/dashboard
│   ├── etl-status/route.ts ← → FastAPI /etl-status
│   └── available-range/    ← → FastAPI /available-range
└── dashboard/
    ├── layout.tsx          ← DataProvider + DataLoaderOverlay + Sidebar + SiteHeader
    ├── page.tsx            ← /dashboard (обзор сети)
    ├── live/               ← real-time KPI
    ├── stores/             ← сравнение точек
    ├── dynamics/           ← период-к-периоду
    ├── abc-xyz/            ← ABC/XYZ матрица
    ├── profitability/      ← waterfall + гистограмма
    ├── inventory/          ← остатки/излишки/oborot
    ├── products/           ← полный список с поиском
    ├── categories/         ← по поставщикам
    ├── data/               ← DAG-вью ETL
    └── blog/               ← движок статей
```

`DataProvider` (`lib/data-context.tsx`):
- Загружает `/api/available-range` при mount.
- Хранит `range: DateRange` (дефолт — последние 30 дней).
- На смену range — `fetch('/api/data?from=…&to=…')` + `compareData` (тот же длиной период до main).

`DataLoaderOverlay` — full-screen `RouteLoader` поверх контента, когда `loading=true`.

## Auth поток

```
1. GET /                       → middleware: нет cookie → 307 /login?next=/
2. GET /login                  → glassmorphism HTML form (server action)
3. POST /login (form)          → loginAction:
                                  - credsMatch → expectedToken (HMAC)
                                  - jar.set(onec-auth, ..., secure:false)
                                  - redirect(next)
4. GET / + Cookie              → middleware: token === expected → next()
5. GET /api/data (browser fetch) + Cookie
                               → middleware: ok → proxy → FastAPI
6. GET /api/data без cookie    → middleware: 401 JSON (НЕ редирект)
```

Cookie `onec-auth`:
- httpOnly, sameSite=lax, path=/, maxAge=7d.
- `secure:false` (можно `AUTH_COOKIE_SECURE=1` если на HTTPS).
- Значение = HMAC-SHA256(`user:pass`, `AUTH_SECRET`).

## Производительность

| Запрос | Размер (gz) | Время |
|---|---:|---:|
| `/api/data?month=2026-03` (14k товаров) | 921 КБ | 1.3 с |
| `/api/data?month=2026-05` | 359 КБ | 0.5 с |
| `/api/data?from=…&to=…` 7 дней | ~250 КБ | 0.4 с |
| `/api/live` | 988 Б | 30 мс |
| `/api/etl-status` | ~2 КБ | 50 мс |
| `/dashboard/*` (HTML + 14 JS chunks) | ~380 КБ | ~1 с (cold) |

Узкие места:
- 9.5 МБ uncompressed payload для года данных — gzip убирает в 10×.
- Recharts рендер 14k товаров на клиенте — ~2 с, пагинация в таблицах помогает.

## Что НЕ Airflow

Изначально планировался Airflow (есть `airflow/` дир с DAG-ами + Dockerfile),
но мы пошли cron-путём из-за overhead. Сравнение:

|              | Airflow                              | Наш cron + UI                         |
|--------------|--------------------------------------|---------------------------------------|
| Память       | ~600 МБ scheduler + 400 МБ webserver | ~0 МБ (cron — kernel-level)           |
| UI           | http://server:8080 встроенный        | `/dashboard/data` self-rolled         |
| Расписание   | DAG-файлы Python                     | crontab текст                         |
| Retries      | airflow-native                       | tenacity внутри loader                |
| История      | airflow `runs`                       | `etl.sync_runs` (наш journal)         |
| Зависимости  | DAG-graph                            | минуты в crontab                      |

Файлы Airflow (`airflow/dags/onec_*.py`) сохранены — для гипотетического
переезда обратно (один loader → один DAG-файл, фабрика в `_dag_factory.py`).

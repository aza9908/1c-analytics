# Changelog

Хронология значимых изменений. Свежее сверху.

---

## 2026-11-24

### Новый репозиторий, документация переписана
- Проект переехал в [aza9908/1c-analytics](https://github.com/aza9908/1c-analytics),
  автор и сопровождающий: Azamat Armanuly.
- **README.md** переписан с нуля: пошаговый быстрый старт, объяснение потока
  данных, таблица переменных окружения, раздел «Частые проблемы».
- **STATUS.md** очищен от привязки к конкретному серверу.
- `.env.example` и `.env.local.example` снабжены понятными комментариями.
- Исправлена ошибка в документации: переменная отключения авторизации
  называется `BASIC_AUTH_DISABLED`, а не `AUTH_DISABLED`.
- Добавлена лицензия MIT.
- Идентификатор проекта `1c-platform` заменён на `1c-analytics` в package.json,
  docker-compose, systemd-юнитах, nginx и FastAPI.

---

## 2026-05-12

### Documentation refresh
- **README.md** переписан полностью — актуальная схема, дашборды, deploy playbook.
- **ARCHITECTURE.md** создан — технический срез.
- **STATUS.md** создан — что работает / TODO / known limitations.
- **CHANGELOG.md** этот файл.

### UX: tooltips + rentability everywhere
- `lib/metrics-glossary.ts` — 16 метрик с label/desc/formula/unit.
- `components/dashboard/metric-info.tsx` — ⓘ-тултип у заголовков таблиц.
- **Рентабельность добавлена в Recharts tooltips**: обзор, stores (3 графика),
  dynamics (2 графика).
- **Рентабельность как колонка** добавлена в abc-xyz, profitability, top-10
  prosperity.
- **MetricInfo на шапках всех таблиц** через bulk-script + ручные правки:
  обзор, stores, profitability, abc-xyz, products, inventory, categories.

### Time fix: +5h bug
- 1C OData отдаёт `Date` как naive wall-clock в Almaty, а старый SQL
  парсил `(e->>'Date')::timestamptz` с session UTC → потом `AT TIME ZONE
  'Asia/Almaty'` добавлял ещё +5 часов → `hour_local = real_hour + 5`.
  Пользователь видел «данные с 14:00» — реально с 09:00.
- **migrations/010** — one-shot фикс существующих 57.6k чеков, 143 sales
  и 2 watermark-ов. raw.* date сдвинут на -5h, mart.* пересчитан из
  raw.payload. Все materialized views рефрешнуты.
- **Loader SQL**: `(e->>'Date')::timestamp` (без `tz`) + `AT TIME ZONE
  'Asia/Almaty'` для timestamptz, naive для date_local/hour_local.

### Hourly cron for everything
- Раньше hourly только receipts/sales, остальные daily 03:00–03:45.
- Сейчас все 7 ежечасно (`:05` receipts, `:15` sales, `:20` inventory,
  `:25` products, `:30` stores, `:40` analytics_keys, `:50` cost_balance).
- **migrations/009** — `etl.health` SLA унифицирован: 90 минут для всех.

### Timezone unified
- `crontab`: `TZ=Asia/Almaty` → расписания трактуются в местном времени.
- `api/routers/etl.py::_iso()` — конвертит timestamptz в Almaty +05:00.
- `lib/time.ts` (date-fns-tz) — `formatInTimeZone(d, 'Asia/Almaty', …)`,
  принудительно показывает Almaty независимо от TZ браузера.
- `npm i date-fns-tz`.

---

## 2026-05-12 (раньше в течение дня)

### ETL status tab + live banner
- `/dashboard/data` — DAG-вью из `etl.sync_state` + `etl.sync_runs`. Click
  по строке раскрывает последние 10 прогонов. Авто-refresh 30 сек.
- `<EtlStatusBanner>` в шапке — пилюля 🟢/🟡/🔴 с количеством OK/STALE/FAILED,
  кликабельная, ведёт на `/dashboard/data`. Авто-poll 60 сек.
- `api/routers/etl.py::/etl-status` — новый endpoint.

### Scoreboard
- Убрана колонка «Наценка» (была дубликатом profit).
- Добавлены `avgCheck` (AVG) и `medianCheck` (PERCENTILE_CONT 0.5) per store.

### Alerts на обзоре переписаны
- «0 убыточных» → «Все позиции в плюсе · профит N» (зелёный).
- Dead-SKU только при >30%.
- Surplus только если есть данные.
- Worst-store алерт только при разрыве >2 п.п.

### Pagination
- `components/dashboard/table-pagination.tsx` — переиспользуемый компонент:
  `[<<][<] N/M [>][>>]` + page-size селектор 25/50/100/200.
- Подключено на /abc-xyz и /products.

### Sidebar
- «Исследования» (блог) — теперь сворачиваемая группа.
- Новая группа «Платформа · Данные · ETL» → `/dashboard/data`.

---

## 2026-05-12 (cost layer)

### Себестоимость / GP / маржа
- **2 новых loader-а:**
  - `analytics_keys.py` — 30 089 ключей из `Catalog_КлючиАналитикиУчётаНоменклатуры`.
    Аналитика учёта ↔ номенклатура (Rosetta).
  - `cost_balance.py` — 34 029 партий из `AccumulationRegister_Себестоимость
    Товаров/Balance`. ССБ единицы товара без НДС.
- **migrations/007** — `mart.analytics_keys` + `mart.cost_balance` +
  matview `mart.product_avg_cost` (средневзвешенная ССБ).
- **migrations/008** — пересоздание 4 sales_*_by_* matview с колонками
  `cost / gross_profit / gross_margin_pct / markup_pct`.
- `api/routers/data.py` — больше не хардкодит cost=0/profit=0. Считает
  per-product margin, lossProducts, surplusSum, totalCost/totalProfit на
  уровне store и сети.
- `run_loader.sh` — REFRESH после receipts И после cost_balance.

### Покрытие
- 98.6% выручки идёт через товары с известной ССБ. Маржа за апрель = 37.9%
  (network); 37–41% per точка.

---

## 2026-05-11 (initial deploy)

### Deploy native (без Docker)
- Postgres 16 (apt). БД `onec` + 3 схемы.
- Python 3.12 venv. FastAPI/asyncpg/uvicorn под systemd `onec-api`.
- Node.js 20. Next.js 16 dev → переключён на prod (`next start`) — JS
  бандл уменьшился с 7 МБ до 376 КБ (gz).
- Cron вместо Airflow (DAG-файлы оставлены).
- nginx :80 как reverse proxy + gzip (10× compression API).

### Auth admin/admin
- HMAC-cookie `onec-auth` (7 дней).
- `/login` server-action.
- Middleware: 307 редирект для pages, 401 JSON для `/api/*`.
- Cookie `secure:false` (HTTP).

### Date filter
- Замена MonthKey на DateRange (`react-day-picker` + custom presets).
- Backend: `/data?from=&to=` или legacy `/data?month=YYYY-MM`.
- 4 materialized view: monthly + daily, by_store + by_store_product.

### Light theme + Loaders
- `next-themes` + toggle Sun/Moon.
- RouteLoader (glass spinner) + NavigationLoader + DataLoaderOverlay.

### Live dashboard E2E
- `/api/live` → FastAPI `/live/dashboard` → `mart.receipts` (today only).
- Часовые корзины, top-10 товаров, byStore, prev-day comparison.

---

## 2026-05-11 (bootstrap)

### Initial repo
- Бэкенд (ETL + API) и Next.js-фронтенд сведены в один репозиторий.
- 5 базовых loader-ов: receipts, products, stores, sales, inventory.
- 6 SQL миграций: etl meta + raw + mart + monthly aggregates + daily aggregates.
- 8 дашбордов + login + sidebar.

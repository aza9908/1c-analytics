# 1C Analytics: аналитическая платформа поверх 1С

**Автор: Azamat Armanuly** ([GitHub @aza9908](https://github.com/aza9908))

Готовая связка для аналитики розничной сети, которая работает на 1С
(Управление Торговлей). Платформа забирает данные из 1С по OData, складывает
их в Postgres, считает витрины с маржой и себестоимостью и показывает всё это
в веб-дашбордах. Отдельно есть MCP-сервер, через который к данным можно
подключить LLM-агента (например, Claude) и задавать вопросы по продажам
обычным языком.

> **В репозитории только код.** Дампов, фикстур и демо-данных нет. Чтобы
> увидеть цифры в дашбордах, нужно подключить свою базу 1С. Как это сделать,
> описано в разделе [«Быстрый старт»](#быстрый-старт).

---

## Содержание

1. [Что умеет платформа](#что-умеет-платформа)
2. [Как это работает](#как-это-работает)
3. [Из чего состоит репозиторий](#из-чего-состоит-репозиторий)
4. [Быстрый старт](#быстрый-старт)
5. [Запуск в проде](#запуск-в-проде)
6. [Дашборды](#дашборды)
7. [Источники данных в 1С](#источники-данных-в-1с)
8. [Авторизация](#авторизация)
9. [Переменные окружения](#переменные-окружения)
10. [MCP-сервер для LLM-агентов](#mcp-сервер-для-llm-агентов)
11. [Блог и аналитические статьи](#блог-и-аналитические-статьи)
12. [Частые проблемы](#частые-проблемы)
13. [Лицензия](#лицензия)

---

## Что умеет платформа

- **11 дашбордов**: обзор сети, live-чеки за сегодня, сравнение магазинов,
  динамика, ABC/XYZ, прибыльность, остатки, товары, поставщики, статус ETL и блог.
- **Себестоимость и маржа** по каждому товару: данные берутся из партионного
  учёта 1С, поэтому прибыль считается честно, а не по наценке «на глаз».
- **Ежечасное обновление** данных из 1С по cron (или через Airflow, если он
  у вас уже есть).
- **Мониторинг ETL** прямо в интерфейсе: видно, какой загрузчик когда
  отработал, что упало и насколько данные свежие.
- **MCP-сервер**: LLM-агент получает доступ к витринам только на чтение и
  может отвечать на вопросы вроде «какой магазин просел по марже в прошлом месяце».

## Как это работает

```
1С (OData) ──► etl/loaders ──► Postgres ──► FastAPI (api/) ──► Next.js (app/) ──► браузер
                                 │                 ▲
                                 │                 │
                         raw.* → mart.* →     MCP-сервер
                         materialized views   (mcp_server/)
```

Поток данных по шагам:

1. **Загрузчики (`etl/loaders/`)** раз в час ходят в 1С по OData и забирают
   чеки, реализации, номенклатуру, склады, остатки и себестоимость.
2. **Схема `raw`** хранит сырые ответы 1С как JSONB, ничего не теряется.
3. **Схема `mart`** содержит плоские таблицы и materialized views, уже с
   маржой, себестоимостью и агрегатами по дням и месяцам. Именно их читают
   дашборды.
4. **Схема `etl`** ведёт журнал прогонов: watermark, время, статус, ошибки.
5. **FastAPI** отдаёт данные фронту по HTTP. Фронт в базу напрямую не ходит.
6. **Next.js** рендерит дашборды. Его route handlers (`app/api/*`) просто
   проксируют запросы в FastAPI по адресу из `API_URL`.

Если `API_URL` не задан, фронт честно отвечает `503`. Это нормально и
означает, что бэкенд ещё не поднят.

## Из чего состоит репозиторий

```
.
├── api/                      FastAPI-бэкенд: routers/{health,live,data,etl}.py
├── app/                      Next.js 16: страницы дашбордов + /api/* прокси
├── components/dashboard/     общие компоненты дашбордов (лоадеры, тултипы, пагинация)
├── components/blog/          рендерер markdown-статей + оглавление
├── content/articles/         markdown-статьи для блога (пусто, контент свой)
├── etl/                      Python ETL
│   ├── onec/client.py        OData-клиент (httpx + tenacity, пагинация $top/$skip)
│   ├── config.py             настройки из переменных окружения
│   └── loaders/              7 загрузчиков: receipts, sales, products, stores,
│                             inventory, analytics_keys, cost_balance
├── migrations/               10 SQL-файлов: схемы etl / raw / mart + materialized views
├── mcp_server/               MCP-сервер поверх витрин mart
├── scripts/                  run_loader.sh (запуск загрузчика), build_and_restart_web.sh
├── infra/                    cron, systemd-юниты, nginx-конфиг, инструкция по деплою
├── airflow/                  DAG-и как альтернатива cron
├── docs/                     mart-map.md (карта витрин), 1c-data.md (что берём из 1С)
├── ARCHITECTURE.md           технические решения и почему они такие
├── STATUS.md                 что работает, что в планах, известные ограничения
└── CHANGELOG.md              история изменений
```

## Быстрый старт

Ниже сценарий для локального запуска на одной машине (Ubuntu / Debian или
macOS с Homebrew). Понадобятся: Postgres 16, Python 3.12, Node.js 20, доступ
к OData вашей 1С.

### Шаг 1. Клонировать репозиторий

```bash
git clone https://github.com/aza9908/1c-analytics.git
cd 1c-analytics
```

### Шаг 2. Поднять Postgres и создать базу

```bash
# Ubuntu / Debian
sudo apt install -y postgresql postgresql-contrib

# Создаём пользователя, базу и три схемы
sudo -u postgres psql -c "CREATE ROLE onec WITH LOGIN PASSWORD 'придумайте_пароль';"
sudo -u postgres psql -c "CREATE DATABASE onec OWNER onec;"
sudo -u postgres psql -d onec -c "
  CREATE SCHEMA raw  AUTHORIZATION onec;
  CREATE SCHEMA mart AUTHORIZATION onec;
  CREATE SCHEMA etl  AUTHORIZATION onec;
"
```

### Шаг 3. Настроить окружение для бэкенда и ETL

```bash
cp .env.example .env
```

Откройте `.env` и заполните как минимум:

| Переменная            | Что вписать                                                        |
|-----------------------|--------------------------------------------------------------------|
| `ONEC_DB_HOST`        | `127.0.0.1` (если Postgres локальный)                              |
| `ONEC_DB_PASSWORD`    | пароль пользователя `onec` из шага 2                               |
| `ONEC_ODATA_URL`      | адрес OData вашей 1С, вида `https://host/base/odata/standard.odata` |
| `ONEC_ODATA_USER`     | логин пользователя 1С с правами на чтение                          |
| `ONEC_ODATA_PASSWORD` | его пароль                                                         |
| `ONEC_TIMEZONE`       | ваш часовой пояс, по умолчанию `Asia/Almaty`                        |

Как включить OData в 1С: в конфигураторе откройте «Администрирование →
Публикация на веб-сервере», поставьте галочку «Публиковать стандартный
интерфейс OData» и настройте состав объектов через
`УстановитьСоставСтандартногоИнтерфейсаOData`. Список сущностей, которые
нужны платформе, есть в разделе [«Источники данных в 1С»](#источники-данных-в-1с).

### Шаг 4. Установить Python-зависимости и накатить миграции

```bash
python3 -m venv .venv
.venv/bin/pip install -r airflow/requirements.txt -r api/requirements.txt

# Подхватываем переменные из .env и применяем миграции по порядку
set -a; source .env; set +a
for f in migrations/*.sql; do
  PGPASSWORD=$ONEC_DB_PASSWORD psql -h $ONEC_DB_HOST -U onec -d onec -v ON_ERROR_STOP=1 -f "$f"
done
```

### Шаг 5. Первая загрузка данных из 1С

Порядок важен: сначала справочники, потом документы, потом себестоимость.

```bash
for ent in stores products analytics_keys cost_balance receipts sales inventory; do
  PYTHONPATH=. .venv/bin/python -m etl.loaders.$ent
done
```

Загрузка чеков занимает заметное время (ориентир: около 5 минут на 60 тысяч
чеков). После загрузки `receipts` и `cost_balance` нужно обновить
materialized views:

```bash
PGPASSWORD=$ONEC_DB_PASSWORD psql -h $ONEC_DB_HOST -U onec -d onec -c "
  REFRESH MATERIALIZED VIEW mart.product_avg_cost;
  REFRESH MATERIALIZED VIEW mart.sales_monthly_by_product;
  REFRESH MATERIALIZED VIEW mart.sales_daily_by_store_product;
  REFRESH MATERIALIZED VIEW mart.sales_monthly_by_store;
  REFRESH MATERIALIZED VIEW mart.sales_daily_by_store;
"
```

Скрипт `scripts/run_loader.sh` делает это автоматически, но он рассчитан на
прод-раскладку в `/opt/1c_analytics` (путь задаётся переменной `ROOT` внутри
скрипта).

Проверить, что данные пришли:

```sql
SELECT * FROM etl.health ORDER BY entity;
SELECT count(*) FROM mart.receipts;
```

### Шаг 6. Запустить бэкенд

```bash
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Проверка: `curl http://127.0.0.1:8000/health` должен вернуть JSON со статусом.

### Шаг 7. Запустить фронт

В отдельном терминале:

```bash
cp .env.local.example .env.local   # API_URL уже указывает на localhost:8000
npm install
npm run dev
```

Откройте `http://localhost:3000`. Логин `admin`, пароль `admin`
(меняется через `BASIC_AUTH_USER` / `BASIC_AUTH_PASS`). Для разработки
авторизацию можно вообще отключить: `BASIC_AUTH_DISABLED=1` в `.env.local`.

### Шаг 8. Включить автообновление

Чтобы данные подтягивались каждый час, добавьте в cron расписание из
`infra/cron/etl.crontab` (поправив путь `ROOT` под свою машину) или
используйте Airflow DAG-и из `airflow/dags/`.

## Запуск в проде

Рекомендуемый вариант: одна ВМ на Ubuntu, всё нативно под systemd, без
Docker и без Airflow. Подробная пошаговая инструкция лежит в
[infra/README.md](infra/README.md). Кратко:

```bash
# Код живёт в /opt/1c_analytics (этот путь зашит в systemd-юниты и cron)
cp infra/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now onec-api onec-web

crontab infra/cron/etl.crontab

cp infra/nginx/onec.conf /etc/nginx/sites-available/onec
ln -sf /etc/nginx/sites-available/onec /etc/nginx/sites-enabled/onec
systemctl reload nginx
```

Перед выкладкой обязательно:

- замените `BASIC_AUTH_PASS` на нормальный пароль;
- сгенерируйте `AUTH_SECRET`: `openssl rand -hex 32`;
- при желании задайте `API_KEY`, тогда FastAPI будет принимать запросы только
  с заголовком `X-API-Key`;
- настройте HTTPS (Let's Encrypt + nginx) и включите `AUTH_COOKIE_SECURE=1`.

Альтернатива: `docker-compose.yml` поднимает Postgres, Airflow и API в
контейнерах. Фронт в compose не входит, его удобнее деплоить на Vercel или
запускать отдельно.

## Дашборды

| URL                        | Что показывает                                                        |
|----------------------------|-----------------------------------------------------------------------|
| `/dashboard`               | Обзор сети: 6 ключевых показателей, алерты, таблица магазинов, топ-10 товаров по прибыли |
| `/dashboard/live`          | Чеки за сегодня в реальном времени: по часам, по магазинам, топ товаров |
| `/dashboard/stores`        | Сравнение магазинов: выручка, прибыль, аренда, эффективность ассортимента |
| `/dashboard/dynamics`      | Динамика период к периоду                                              |
| `/dashboard/abc-xyz`       | ABC/XYZ-матрица, кривая Парето, список товаров с пагинацией            |
| `/dashboard/profitability` | Прибыль, наценка, рентабельность: waterfall, гистограмма, таблица       |
| `/dashboard/inventory`     | Остатки, излишки, дни запаса, скорость продаж                           |
| `/dashboard/products`      | Все товары: поиск, фильтры по ABC/XYZ, сортировка, пагинация           |
| `/dashboard/categories`    | Анализ по поставщикам                                                  |
| `/dashboard/data`          | Статус ETL: 7 загрузчиков, последние прогоны, свежесть данных          |
| `/dashboard/blog`          | Аналитические статьи (контент добавляете сами)                        |

## Источники данных в 1С

Платформа читает из 1С семь сущностей OData. Пользователю 1С, под которым
ходит ETL, достаточно прав на чтение этих объектов.

| Сущность OData                                       | Зачем нужна                              | Загрузчик           |
|------------------------------------------------------|------------------------------------------|---------------------|
| `Document_ЧекККМ`                                    | Розничные чеки                           | `receipts.py`       |
| `Document_РеализацияТоваровУслуг`                    | Оптовые продажи                          | `sales.py`          |
| `Catalog_Номенклатура`                               | Каталог товаров                          | `products.py`       |
| `Catalog_Склады`                                     | Магазины и склады                        | `stores.py`         |
| `AccumulationRegister_ТоварыНаСкладах/Balance`       | Текущие остатки                          | `inventory.py`      |
| `Catalog_КлючиАналитикиУчётаНоменклатуры`            | Связка «аналитика учёта → товар»         | `analytics_keys.py` |
| `AccumulationRegister_СебестоимостьТоваров/Balance`  | Себестоимость партий                     | `cost_balance.py`   |

Чеки и реализации грузятся инкрементально по дате (watermark хранится в
`etl.sync_state`), справочники и остатки обновляются целиком.

Подробности по полям и трансформациям: [docs/1c-data.md](docs/1c-data.md).
Карта витрин с описанием каждой таблицы: [docs/mart-map.md](docs/mart-map.md).

## Авторизация

Простая схема без внешних провайдеров: один логин и пароль из переменных
окружения, после входа ставится HMAC-подписанная cookie на 7 дней.

- Логин и пароль: `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` (по умолчанию `admin` / `admin`).
- Ключ подписи cookie: `AUTH_SECRET`.
- Все страницы защищены редиректом на `/login`. Маршруты `/api/*` отвечают
  `401` в JSON без редиректа, чтобы клиентские запросы не получали HTML
  вместо данных.
- Отключить для разработки: `BASIC_AUTH_DISABLED=1` в `.env.local`.

## Переменные окружения

Два файла: `.env` для бэкенда и ETL, `.env.local` для фронта. Шаблоны лежат
рядом: [.env.example](.env.example) и [.env.local.example](.env.local.example).
Настоящие файлы с секретами в git не попадают (см. `.gitignore`).

| Переменная                       | Файл          | Назначение                                        |
|----------------------------------|---------------|---------------------------------------------------|
| `ONEC_DB_HOST/PORT/NAME/USER/PASSWORD` | `.env`  | подключение к Postgres                            |
| `ONEC_ODATA_URL/USER/PASSWORD`   | `.env`        | доступ к OData 1С                                 |
| `ONEC_TIMEZONE`                  | `.env`        | часовой пояс для дат в витринах                   |
| `ALLOWED_ORIGINS`                | `.env`        | CORS для FastAPI                                  |
| `API_KEY`                        | оба           | общий секрет между Next.js и FastAPI (опционально) |
| `API_URL`                        | `.env.local`  | адрес FastAPI для серверных route handlers        |
| `NEXT_PUBLIC_API_URL`            | `.env.local`  | адрес FastAPI, доступный в браузере               |
| `BASIC_AUTH_USER/PASS`           | `.env.local`  | логин и пароль в дашборды                         |
| `AUTH_SECRET`                    | `.env.local`  | ключ для подписи cookie                           |
| `BASIC_AUTH_DISABLED`                | `.env.local`  | `1` отключает авторизацию                         |

## MCP-сервер для LLM-агентов

`mcp_server/server.py` поднимает MCP-сервер (транспорт streamable-HTTP) с
инструментами только на чтение поверх схемы `mart`. Подключив его к Claude
или другому агенту, можно спрашивать про продажи, маржу и остатки обычным
языком, а агент сам соберёт нужный SQL по витринам. В начале файла описана
модель данных, которую видит агент.

## Блог и аналитические статьи

Движок статей есть, контента нет. Чтобы добавить материал:

1. положите markdown-файл в `content/articles/<slug>.md`;
2. добавьте запись в массив `ARTICLES` в `lib/articles.ts`, где `slug`
   совпадает с именем файла.

Рендерер (`components/blog/markdown.tsx`) поддерживает callout-блоки,
оглавление, сноски и плейсхолдеры графиков вида `![chart:<id>](alt)`.
Сами компоненты графиков в репозиторий не входят: они были привязаны к
конкретным датасетам, под свои данные их нужно написать заново.

## Частые проблемы

**Дашборды пустые, в консоли `503`.** Фронт не видит бэкенд. Проверьте
`API_URL` в `.env.local` и что FastAPI отвечает на `/health`.

**Загрузчик падает с `401` от 1С.** Неверный логин или пароль OData, либо у
пользователя 1С нет прав на нужный объект. Проверьте `ONEC_ODATA_*`.

**Загрузчик падает с `404` от 1С.** Сущность не включена в состав OData.
Добавьте её через `УстановитьСоставСтандартногоИнтерфейсаOData`.

**Время в чеках сдвинуто на несколько часов.** 1С отдаёт даты без часового
пояса. Убедитесь, что `ONEC_TIMEZONE` совпадает с поясом сервера 1С, а в
crontab стоит та же `TZ`.

**Нет себестоимости и прибыли по части товаров.** Это ожидаемо: по позициям,
у которых партии уже закрылись, в `mart.product_avg_cost` данных нет. Долю
такой выручки видно в `/dashboard/data`.

**После рефреша `mart.inventory` на секунду пустые остатки.** Таблица
обновляется через `TRUNCATE + INSERT`. История лежит в `raw.inventory_snapshots`.

## Лицензия

MIT. Подробности в файле [LICENSE](LICENSE).

Платформа развивается на основе открытого кода проекта
[mkhamzanov/1c-public](https://github.com/mkhamzanov/1c-public).

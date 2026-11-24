# Статус проекта

> Что работает, что в планах, какие есть ограничения.
> Архитектура описана в [ARCHITECTURE.md](ARCHITECTURE.md), история изменений в [CHANGELOG.md](CHANGELOG.md).

## Целевая раскладка в проде

Одна ВМ на Ubuntu 24, всё нативно под systemd (без Docker). Postgres 16, Python 3.12, Node.js 20.

| Сервис        | Роль                       | Порт | Где смотреть логи           |
|---------------|----------------------------|------|-----------------------------|
| `postgresql`  | база `onec`                | 5432 | `journalctl -u postgresql`  |
| `onec-api`    | FastAPI-бэкенд             | 8000 | `/var/log/onec-api.log`     |
| `onec-web`    | Next.js (prod build)       | 3000 | `/var/log/onec-web.log`     |
| `nginx`       | reverse proxy + gzip       | 80   | `/var/log/nginx/access.log` |
| `cron`        | запуск ETL каждый час      | нет  | `airflow/logs/<entity>.log` |

## Данные и частота обновления

| Таблица или view                     | Обновление                        |
|--------------------------------------|-----------------------------------|
| `mart.receipts`, `mart.receipt_items`| каждый час (инкрементально)       |
| `mart.sales`                         | каждый час (инкрементально)       |
| `mart.products`, `mart.stores`       | каждый час (полная перезагрузка)  |
| `mart.inventory`                     | каждый час (TRUNCATE + INSERT)    |
| `mart.analytics_keys`, `mart.cost_balance` | каждый час                  |
| `mart.product_avg_cost` (matview)    | после `cost_balance`              |
| `mart.sales_monthly_*`, `mart.sales_daily_*` (matviews) | после `receipts` и `cost_balance` |
| `etl.health`                         | обычный view, всегда актуален     |

Фактические объёмы и покрытый период смотрите по своей базе:
`etl.sync_runs` и `mart.available_date_range`.

## Покрытие себестоимостью

Часть выручки всегда приходится на товары, у которых партии уже закрылись и
в `mart.product_avg_cost` нет данных. Для них `cost` и `profit` не считаются.
Долю такой выручки по своей базе видно в `/dashboard/data`.

## Состояние дашбордов

| Дашборд                    | Источник данных                         | Состояние |
|----------------------------|-----------------------------------------|-----------|
| `/dashboard` (обзор)       | `sales_monthly_by_*`, `inventory`       | работает  |
| `/dashboard/live`          | `mart.receipts` (только сегодня)        | работает  |
| `/dashboard/stores`        | `sales_*_by_store` + чеки               | работает  |
| `/dashboard/dynamics`      | сравнение периодов                      | работает, если предыдущий период есть в базе |
| `/dashboard/abc-xyz`       | `sales_*_by_product` → ABC              | работает; XYZ пока заглушка (все товары `Z`) |
| `/dashboard/profitability` | `gross_profit`, `gross_margin_pct`      | работает  |
| `/dashboard/inventory`     | `mart.inventory` + `product_avg_cost`   | работает  |
| `/dashboard/products`      | полный список с поиском и пагинацией    | работает  |
| `/dashboard/categories`    | по поставщикам                          | поле `supplier` в API пока пустое |
| `/dashboard/data`          | `etl.sync_state` + `etl.sync_runs`      | работает  |
| `/dashboard/blog`          | статьи из `content/articles/*.md`       | работает  |

## Планы

### Ближайшие
- **XYZ-классификация.** Сейчас все товары помечены `Z`. Нужно посчитать
  стабильность спроса по неделям (коэффициент вариации) и разложить на X / Y / Z.
- **Поставщики.** Добавить колонку `supplier_guid` в `mart.products`
  (через `Catalog_Номенклатура.Производитель` или аналогичное поле) и join в API.
- **HTTPS.** Let's Encrypt + nginx + `AUTH_COOKIE_SECURE=1`.

### Средние
- **Виртуализация таблиц.** Рендер 14 тысяч строк на клиенте занимает около
  2 секунд. Подключить `react-virtuoso` для больших таблиц.
- **Больше алертов.** Дрейф цен, мёртвый сток старше 30 дней, отрицательная
  маржа в подгруппах.
- **Экспорт в Excel / CSV** из любой таблицы.

### Стратегические
- **Прогноз продаж** по дневным продажам на уровне SKU.
- **Аномалии.** Z-score по дневной выручке на магазин с уведомлениями в Telegram.
- **Инфраструктура A/B-тестов** для оценки промо.

## Что не сделано осознанно

- **Airflow.** Для текущей нагрузки не оправдан: cron и собственная страница
  `/dashboard/data` закрывают задачу. DAG-и оставлены на случай миграции.
- **WebSocket для live-дашборда.** Страница опрашивает API каждые 5 минут,
  чеки в 1С и так появляются с задержкой в минуты.
- **Multi-tenant.** Пока одна сеть. Если появится вторая, добавим `tenant_id`.

## Известные ограничения

- В `.env.example` значения `change-me` и `changeme` являются заглушками, их
  нужно заменить при подключении.
- `AUTH_SECRET` по умолчанию `change-me-to-random-string`. На проде
  сгенерируйте через `openssl rand -hex 32`.
- `BASIC_AUTH_PASS=admin` на проде обязательно заменить.
- `mart.inventory` обновляется через `TRUNCATE + INSERT`, в момент рефреша
  около секунды запросы могут вернуть пустой результат. История хранится в
  `raw.inventory_snapshots` (append-only).

## Полезные команды

```bash
# Состояние ETL
psql -h 127.0.0.1 -U onec -d onec -c "SELECT * FROM etl.health ORDER BY entity;"

# Логи сервисов
tail -f /var/log/onec-api.log
tail -f /var/log/onec-web.log
tail -f airflow/logs/receipts.log
```

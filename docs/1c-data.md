＃ Данные из 1С — что забираем и как

> **Источник:** 1С Управление Торговлей, REST OData v3 (`Catalog_*`, `Document_*`, `AccumulationRegister_*`).
> **Куда кладём:** Postgres 16 (БД `onec`), схемы `raw.*` (сырой JSONB) и `mart.*` (плоские витрины).
> **Транспорт:** [etl/onec/client.py](etl/onec/client.py) — `httpx` + `tenacity`, basic auth, пагинация `$top/$skip`, `page_size=1000` по умолчанию.
> **Оркестрация:** cron на сервере (Airflow DAG’ов нет — оставлены как референс в [airflow/dags/](airflow/dags/)).
> **TZ:** OData отдаёт UTC, в `mart.*` сразу хранится `date_local`/`hour_local` в `Asia/Almaty`.

---

## 1. Расписание и время прогона (cron)

Все 7 loader-ов крутятся **ежечасно** под `TZ=Asia/Almaty`, минуты разнесены чтобы не пересекаться по нагрузке:

| Entity          | Cron        | Стратегия                |
|-----------------|-------------|--------------------------|
| receipts        | `5 * * * *` | incremental по `Date`    |
| sales           | `15 * * * *`| incremental по `Date`    |
| inventory       | `20 * * * *`| TRUNCATE + INSERT        |
| products        | `25 * * * *`| full refresh             |
| stores          | `30 * * * *`| full refresh             |
| analytics_keys  | `40 * * * *`| full refresh             |
| cost_balance    | `50 * * * *`| full refresh             |

После `receipts` и `cost_balance` автоматически рефрешатся 4 materialized views (`sales_monthly`/`daily` × `by_store`/`by_store_product`) — маржа пересчитывается каждый час.

Фактические объёмы и время прогонов по своей базе смотрите в `etl.sync_runs`
(`rows_fetched` / `duration_ms`, max по entity).

**Глубина истории:**
- `mart.receipts` / `mart.sales` — инкрементально, с `DEFAULT_START` и глубже по мере накопления.
- `mart.inventory` / `mart.products` / `mart.stores` / `mart.analytics_keys` / `mart.cost_balance` — snapshot «сейчас», истории нет.

**Default start:** в коде ([etl/loaders/receipts.py:21](../etl/loaders/receipts.py#L21), [etl/loaders/sales.py:24](../etl/loaders/sales.py#L24)) стоит `DEFAULT_START = "2024-01-01T00:00:00"`.

**Health-вью** ([migrations/009](../migrations/009_health_view_all_hourly.sql)): помечает `STALE`, если любой entity > 90 мин без апдейта.

---

## 2. Watermark и идемпотентность

- `etl.sync_state(entity)` — last_watermark_ts (макс `Date` загруженных доков).
- `etl.sync_runs` — журнал прогонов (rows_fetched / pages / duration_ms / before/after watermark / error).
- Receipts/sales: `WHERE Date ge datetime'{watermark}' and Posted eq true`, упорядочено `Date asc`. Апсёрт по `Ref_Key`, дубли невозможны.
- Inventory: каждый прогон **полный TRUNCATE + INSERT** + дневной снапшот в `raw.inventory_snapshots(snapshot_date, store_guid, product_guid)`.
- Products/Stores: full refresh, апсёрт по `Ref_Key`.

---

## 3. Сущности 1С — endpoint, ключевые поля, маппинг

### 3.1 `Document_ЧекККМ` — чеки ККМ (розница)

OData: `Document_ЧекККМ?$filter=Date ge datetime'…' and Posted eq true`.

Поля документа (top-level в payload):

| 1C поле                | Тип        | Описание                                       | Куда мапится |
|------------------------|------------|------------------------------------------------|--------------|
| `Ref_Key`              | UUID       | PK документа                                   | `raw.receipts.ref_key`, `mart.receipts.ref_key` |
| `Date`                 | datetime   | Время пробития (UTC)                           | `raw.receipts.date`; `mart.receipts.date_local`/`hour_local` (Asia/Almaty) |
| `Number`               | string     | Номер чека (например `0000-000001`)            | — (в payload) |
| `Posted`               | bool       | Проведён ли. Грузим только `true`              | `raw.receipts.posted` |
| `Статус`               | string     | `Пробит` / `Аннулирован` и т.п.                | payload only |
| `Склад_Key`            | UUID       | FK на `mart.stores.guid`                       | `raw.receipts.store_guid`, `mart.receipts.store_guid` |
| `СуммаДокумента`       | numeric    | Итог чека                                      | `raw.receipts.amount`, `mart.receipts.amount` |
| `Валюта_Key`           | UUID       | Валюта                                          | payload only |
| `Кассир_Key`           | UUID       | Кассир                                          | payload only |
| `КассаККМ_Key`         | UUID       | Касса                                           | payload only |
| `КассоваяСмена_Key`    | UUID       | Смена                                           | payload only |
| `ВидЦены_Key`          | UUID       | Тип цены                                        | payload only |
| `Партнер_Key`          | UUID       | Контрагент-партнёр                             | payload only |
| `Организация_Key`      | UUID       | Юрлицо                                          | payload only |
| `ФормаОплаты`          | enum       | `ПлатежнаяКарта`, `Наличные`, …                 | payload only |
| `НалогообложениеНДС`   | enum       | Режим НДС                                       | payload only |
| `КартаЛояльности_Key`  | UUID       | Карта лояльности                                | payload only |
| `Онлайн`               | bool       | Чек из онлайн-канала                            | payload only |
| `Архивный`             | bool       | Архивный документ                               | payload only |
| `Комментарий`          | string     | Комментарий                                     | payload only |
| `Товары[]`             | array      | Табличная часть — строки чека                   | `mart.receipt_items` (по 1 строке на товар) |
| `ОплатаПлатежнымиКартами[]` | array | Эквайринг: суммы по картам, терминалы           | payload only |
| `СкидкиНаценки[]`      | array      | Применённые скидки/наценки                      | payload only |
| `БонусныеБаллы[]`      | array      | Бонусные начисления/списания                    | payload only |
| `КодыМаркировкиИСМПТК[]` | array    | Коды маркировки (ЕГАИС/ЦРПТ)                    | payload only |
| `АкцизныеМарки[]`      | array      | Акцизные марки                                  | payload only |
| `ПодарочныеСертификаты[]` | array   | Подарочные сертификаты                          | payload only |

Поля строки `Товары[i]` (в `mart.receipt_items` маппится только часть):

| 1C поле                 | Тип     | Куда                                            |
|-------------------------|---------|-------------------------------------------------|
| `LineNumber` (ordinal-1) | int    | `mart.receipt_items.line_no`                    |
| `Номенклатура_Key`      | UUID    | `mart.receipt_items.product_guid`               |
| `Количество`            | numeric | `mart.receipt_items.quantity`                   |
| `Сумма`                 | numeric | `mart.receipt_items.sum`                        |
| `Цена`                  | numeric | payload only                                    |
| `СуммаНДС`              | numeric | payload only                                    |
| `СтавкаНДС_Key`         | UUID    | payload only                                    |
| `Штрихкод`              | string  | payload only                                    |
| `Серия_Key`             | UUID    | payload only                                    |
| `Упаковка_Key`          | UUID    | payload only                                    |
| `Характеристика_Key`    | UUID    | payload only                                    |
| `Помещение_Key`         | UUID    | payload only                                    |
| `Продавец_Key`          | UUID    | payload only                                    |
| `КоличествоУпаковок`    | numeric | payload only                                    |
| `СуммаРучнойСкидки`     | numeric | payload only                                    |
| `ПроцентРучнойСкидки`   | numeric | payload only                                    |
| `СуммаАвтоматическойСкидки` | numeric | payload only                                |
| `ПроцентАвтоматическойСкидки` | numeric | payload only                              |
| `НоменклатураЕГАИС_Key`/`НоменклатураНабора_Key`/… | UUID | payload only                  |
| `SAGI_*` (бонусы)       | numeric | payload only — расширение SAGI (бонусная программа) |

Объём и глубина истории зависят от базы: `mart.receipts` — по чеку на строку,
`mart.receipt_items` — по товару в чеке.

Loader: [etl/loaders/receipts.py](etl/loaders/receipts.py).

---

### 3.2 `Document_РеализацияТоваровУслуг` — оптовые продажи

OData: `Document_РеализацияТоваровУслуг?$filter=Date ge datetime'…' and Posted eq true`, `page_size=200` (документы тяжёлые — много вложенных таблиц).

Поля документа (топ):

| 1C поле                       | Тип       | Куда                                          |
|-------------------------------|-----------|-----------------------------------------------|
| `Ref_Key`                     | UUID      | `raw.sales.ref_key`, `mart.sales.doc_ref_key` |
| `Date`                        | datetime  | `raw.sales.date`, `mart.sales.date`/`date_local` |
| `Number`                      | string    | payload only                                  |
| `Posted` / `Статус`           | bool/enum | фильтр на загрузке                            |
| `Склад_Key` (документ)        | UUID      | fallback в `mart.sales.store_guid`            |
| `Валюта_Key` / `Курс` / `Кратность` | UUID/num | payload only                            |
| `Партнер_Key` / `Контрагент_Key` | UUID   | payload only                                  |
| `Соглашение_Key` / `Договор_Key` | UUID   | payload only                                  |
| `Сделка_Key` / `ЗаказКлиента` | UUID/UUID | payload only                                  |
| `Менеджер_Key` / `Автор_Key` / `Руководитель_Key` / `Отпустил_Key` | UUID | payload only |
| `Подразделение_Key`           | UUID      | payload only                                  |
| `Организация_Key`             | UUID      | payload only                                  |
| `БанковскийСчетОрганизации_Key` / `БанковскийСчетКонтрагента_Key` | UUID | payload only |
| `ВалютаВзаиморасчетов_Key`    | UUID      | payload only                                  |
| `СуммаДокумента` / `СуммаВзаиморасчетов` / `СуммаПредоплаты` | numeric | payload only |
| `АдресДоставки` / `СпособДоставки` / `ДатаПлатежа` / `ДатаРаспоряжения` | string/date | payload only |
| `ХозяйственнаяОперация`       | enum      | напр. `РеализацияКлиенту`                     |
| `НалогообложениеНДС`          | enum      | payload only                                  |
| `ЦенаВключаетНДС`             | bool      | payload only                                  |
| `Согласован` / `СкидкиРассчитаны` / `РеализацияПоЗаказам` | bool | payload only          |
| `Товары[]`                    | array     | `mart.sales` (одна строка = одна позиция)     |
| `ВидыЗапасов[]`               | array     | дубль строк с разрезом по виду запаса         |
| `СкидкиНаценки[]`             | array     | payload only                                  |
| `РасшифровкаПлатежа[]`        | array     | payload only                                  |
| `ДополнительныеРеквизиты[]`   | array     | payload only                                  |

Поля строки `Товары[i]`:

| 1C поле                      | Тип     | Куда                                          |
|------------------------------|---------|-----------------------------------------------|
| `LineNumber` (ordinal-1)     | int     | `mart.sales.line_no`                          |
| `Номенклатура_Key`           | UUID    | `mart.sales.product_guid`                     |
| `Склад_Key` (строка)         | UUID    | `mart.sales.store_guid` (если задан, иначе документ) |
| `Количество`                 | numeric | `mart.sales.quantity`                         |
| `Цена`                       | numeric | `mart.sales.price`                            |
| `Сумма`                      | numeric | `mart.sales.sum`                              |
| `СуммаСНДС` / `СуммаНДС`     | numeric | payload only                                  |
| `СуммаВзаиморасчетов`        | numeric | payload only                                  |
| `СтавкаНДС_Key` / `ВидЦены_Key` / `КодТНВЭД_Key` | UUID | payload only                  |
| `Упаковка_Key` / `Характеристика_Key` / `Серия_Key` | UUID | payload only                |
| `НоменклатураНабора_Key` / `ХарактеристикаНабора_Key` | UUID | payload only             |
| `АналитикаУчетаНоменклатуры_Key` | UUID | ← **ключ к себестоимости** в `AccumulationRegister_ВыручкаИСебестоимостьПродаж` |
| `АналитикаУчетаНаборов_Key`  | UUID    | payload only                                  |
| `СуммаРучнойСкидки` / `ПроцентРучнойСкидки` | numeric | payload only                   |
| `СуммаАвтоматическойСкидки` / `ПроцентАвтоматическойСкидки` | numeric | payload only     |

Текущий объём: `mart.sales` — **143** строки, `raw.sales` — **58** документов.

Loader: [etl/loaders/sales.py](etl/loaders/sales.py). **Важно:** в этом документе нет себестоимости — её надо отдельным loader’ом тянуть из `AccumulationRegister_ВыручкаИСебестоимостьПродаж` (см. §3.6).

---

### 3.3 `Catalog_Номенклатура` — товарный справочник

OData: `Catalog_Номенклатура?$select=Ref_Key,Description,Parent_Key,IsFolder&$orderby=Description`.

| 1C поле       | Тип    | Куда                                  |
|---------------|--------|---------------------------------------|
| `Ref_Key`     | UUID   | `raw.products.ref_key`, `mart.products.guid` |
| `Description` | string | `mart.products.name`                  |
| `Parent_Key`  | UUID   | `mart.products.parent_guid` (группа в иерархии) |
| `IsFolder`    | bool   | `raw.products.is_folder`; в `mart.products` грузим только `false` (только товары, не папки) |

`mart.products.category` — пока всегда `NULL` (категория в 1С хранится через `Parent_Key`-цепочку, резолва на «бизнес-категорию» не сделано).

В `raw.products` попадает весь справочник (включая папки/группы), в
`mart.products` — только товары.

Loader: [etl/loaders/products.py](etl/loaders/products.py). Полное обновление каждые сутки в 03:00.

---

### 3.4 `Catalog_Склады` — склады

OData: `Catalog_Склады?$select=Ref_Key,Description`.

| 1C поле       | Тип    | Куда                                  |
|---------------|--------|---------------------------------------|
| `Ref_Key`     | UUID   | `raw.stores.ref_key`, `mart.stores.guid` |
| `Description` | string | `raw.stores.description`, `mart.stores.name` (не перетирается при повторных прогонах, см. ниже) |

`mart.stores.city` / `mart.stores.color` — необязательные UI-поля, в 1С их нет.
Их проставляют вручную (или своим сидом); loader делает
`INSERT … ON CONFLICT DO NOTHING`, чтобы не затереть правки.

Цвет точки, если он не задан в БД, берётся на фронте из `STORE_PALETTE`
([lib/odata.ts](../lib/odata.ts)) — либо серый по умолчанию.

Loader: [etl/loaders/stores.py](etl/loaders/stores.py).

---

### 3.5 `AccumulationRegister_ТоварыНаСкладах/Balance()` — текущие остатки

OData: виртуальная таблица `/Balance()`, фильтр `ВНаличииBalance gt 0`, `page_size=2000`.

| 1C поле               | Тип     | Куда                                  |
|-----------------------|---------|---------------------------------------|
| `Склад_Key`           | UUID    | `raw.inventory_snapshots.store_guid`, `mart.inventory.store_guid` |
| `Номенклатура_Key`    | UUID    | `…product_guid`                       |
| `ВНаличииBalance`     | numeric | `…quantity` (остаток шт.)              |
| `КОтгрузкеBalance`    | numeric | payload only (резерв на отгрузку)     |
| `Характеристика_Key`  | UUID    | payload only                          |
| `Серия_Key`           | UUID    | payload only                          |
| `Помещение_Key`       | UUID    | payload only                          |
| `Назначение_Key`      | UUID    | payload only                          |

Стратегия: каждый прогон — **TRUNCATE `mart.inventory` + INSERT** (PK `(store_guid, product_guid)`), параллельно UPSERT в `raw.inventory_snapshots(snapshot_date, store_guid, product_guid)` — даёт суточную историю остатков.

Строки агрегируются по `store+product`; на уровне 1С их больше — там ещё разрез по серии/характеристике.

Loader: [etl/loaders/inventory.py](etl/loaders/inventory.py).

---

### 3.6 `AccumulationRegister_ВыручкаИСебестоимостьПродаж/Turnovers` — **НЕ подключено**

Эндпоинт известен, но loader’а нет. Это критично для GP/наценки/прибыли.

Ожидаемые поля (плоский turnovers-вид):
- `АналитикаУчетаНоменклатуры_Key` — UUID, **аналитика** (нужен резолв через `Catalog_КлючиАналитикиУчетаНоменклатуры` → `Номенклатура_Key`).
- `Период` (или `Регистратор`) — дата движения.
- `Склад_Key`, `Организация_Key` — разрезы.
- `ВыручкаTurnover` — выручка за период.
- `СебестоимостьTurnover` — себестоимость за период.
- `КоличествоTurnover` — продажи в штуках.

**Что нужно сделать**:
1. Loader `costs.py` тянет `Turnovers` инкрементально.
2. Параллельный loader `Catalog_КлючиАналитикиУчетаНоменклатуры` (поле `Номенклатура_Key` есть, маппинг прямой) → таблица-резолвер.
3. JOIN в `mart` → `mart.sales.cost`, `mart.sales.gross_profit`, и пересчёт ABC/маржинальности в `mart.sales_monthly_by_*`.

Сейчас на дашбордах `cost/profit/markup = 0`.

---

## 4. Что в Postgres лежит (mart-слой)

| Таблица                  | PK                                  | Назначение                                      |
|--------------------------|-------------------------------------|------------------------------------------------|
| `mart.stores`            | `guid`                              | Справочник точек продаж + UI цвет/город        |
| `mart.products`          | `guid`                              | Товары (без папок-групп)                       |
| `mart.receipts`          | `ref_key`                           | Розничные чеки (агрегат)                       |
| `mart.receipt_items`     | `(receipt_ref_key, line_no)`        | Строки чеков (товар × чек)                     |
| `mart.sales`             | `(doc_ref_key, line_no)`            | Оптовые продажи — строки                       |
| `mart.inventory`         | `(store_guid, product_guid)`        | Текущие остатки                                |
| `raw.inventory_snapshots` | `(snapshot_date, store_guid, product_guid)` | История остатков по дням             |
| `mart.sales_monthly_by_*` | materialized views                 | Месячные витрины для `/api/data` (рефрешатся после receipts) |

Метаданные: `etl.sync_state`, `etl.sync_runs`, view `etl.health`.

Миграции: [migrations/](migrations/) — `001_etl_meta.sql`, `002_raw_onec.sql`, `003_mart_onec.sql`, `004_mart_sales_inventory.sql`, `005_mart_monthly_aggregates.sql`, `006_mart_daily_aggregates.sql`.

---

## 5. Что ещё лежит в 1С (не подключено)

Подключены 7 сущностей (см. §3). В типовой УТ в OData торчат сотни эндпоинтов
(`Document_*`, `Catalog_*`, `AccumulationRegister_*`, `InformationRegister_*`) —
состав и объёмы зависят от конкретной базы.

Как посмотреть свои:

```bash
# список эндпоинтов
curl -u "$ONEC_ODATA_USER:$ONEC_ODATA_PASSWORD" "$ONEC_ODATA_URL/\$metadata"

# количество записей в конкретной сущности
curl -u "$ONEC_ODATA_USER:$ONEC_ODATA_PASSWORD"   "$ONEC_ODATA_URL/Document_ПриобретениеТоваровУслуг?\$top=1&\$inlinecount=allpages&\$format=json"
```

Что обычно стоит подключить следующим:

| Сущность                                        | Зачем                                       |
|-------------------------------------------------|---------------------------------------------|
| `Document_ПриобретениеТоваровУслуг`             | Закупки — вторая опора для COGS             |
| `Document_ОтчетОРозничныхПродажах`              | Z-отчёты, сверка с чеками                   |
| `Document_УстановкаЦенНоменклатуры`             | История цен, price drift                    |
| `Document_ВозвратТоваровОтКлиента`              | Корректировка выручки                       |
| `Document_ПеремещениеТоваров`                   | Логистика между точками                     |
| `AccumulationRegister_СвободныеОстатки`         | Остатки за вычетом резервов                 |
| `Catalog_Партнеры` / `Catalog_КартыЛояльности`  | Клиентская аналитика, когорты, LTV          |

> ⚠️ Партнёры, карты лояльности и бонусные балансы — это персональные данные
> клиентов. Прежде чем тянуть их в витрины, решите вопрос с хранением и
> доступом.

## 6. TL;DR

- Тащим из 1С **5 сущностей**: розничные чеки (`Document_ЧекККМ`), опт.продажи (`Document_РеализацияТоваровУслуг`), номенклатуру, склады, остатки (`AccumulationRegister_ТоварыНаСкладах/Balance`).
- Чеки и продажи — инкрементально по `Date` (watermark в `etl.sync_state`), остальное — full refresh.
- Глубина истории ограничена `DEFAULT_START` в loader-ах и тем, что реально есть в базе.
- Cron: receipts ежечасно :05, sales :15, каталоги/остатки раз в сутки в 03:00–03:30. Тяжелее всего бутстрап products и receipts; инкрементальные прогоны — секунды.
- **Доступно в 1С, но не подключено:** закупки, Z-отчёты, история цен, возвраты, перемещения (см. §5).
- **Критично:** `AccumulationRegister_ВыручкаИСебестоимостьПродаж` + `Catalog_КлючиАналитикиУчетаНоменклатуры` — без них `cost/profit/markup` на фронте нули.

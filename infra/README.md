# Деплой на сервер (нативно, без Docker)

Пошаговая инструкция для чистой ВМ на Ubuntu 22.04 / 24.04. В итоге получится:
Postgres + FastAPI + Next.js под systemd, ETL по cron, nginx снаружи.

Все пути ниже предполагают, что код лежит в `/opt/1c_analytics`. Этот путь
зашит в `systemd/*.service`, `cron/etl.crontab` и `scripts/run_loader.sh`.
Если кладёте код в другое место, поправьте его в этих файлах.

Что лежит в этой папке:

| Файл                       | Куда ставится на сервере                      |
|----------------------------|-----------------------------------------------|
| `systemd/onec-api.service` | `/etc/systemd/system/`                        |
| `systemd/onec-web.service` | `/etc/systemd/system/`                        |
| `cron/etl.crontab`         | crontab пользователя, от которого идёт ETL    |
| `nginx/onec.conf`          | `/etc/nginx/sites-available/`                 |
| `postgres-init/01-init.sql`| используется только docker-compose            |

---

## 1. Системные пакеты

```bash
apt update
apt install -y postgresql postgresql-contrib python3-venv cron nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Проверка: `psql --version`, `python3 --version` (нужен 3.12), `node --version` (нужен 20).

## 2. Код

```bash
git clone https://github.com/aza9908/1c-analytics.git /opt/1c_analytics
cd /opt/1c_analytics
```

## 3. Postgres: пользователь, база, схемы

```bash
sudo -u postgres psql -c "CREATE ROLE onec WITH LOGIN PASSWORD 'надёжный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE onec OWNER onec;"
sudo -u postgres psql -d onec -c "CREATE SCHEMA raw AUTHORIZATION onec; CREATE SCHEMA mart AUTHORIZATION onec; CREATE SCHEMA etl AUTHORIZATION onec;"
```

Проверка: `psql -h 127.0.0.1 -U onec -d onec -c '\dn'` показывает схемы `raw`, `mart`, `etl`.

## 4. Файл .env

```bash
cp .env.example .env
nano .env
```

Заполните `ONEC_DB_HOST=127.0.0.1`, `ONEC_DB_PASSWORD`, `ONEC_ODATA_URL`,
`ONEC_ODATA_USER`, `ONEC_ODATA_PASSWORD`. Остальное можно оставить.

## 5. Python-окружение

```bash
python3 -m venv .venv
.venv/bin/pip install -r airflow/requirements.txt -r api/requirements.txt
```

## 6. Миграции

```bash
set -a; source .env; set +a
for f in migrations/*.sql; do
  PGPASSWORD=$ONEC_DB_PASSWORD psql -h 127.0.0.1 -U onec -d onec -v ON_ERROR_STOP=1 -f "$f"
done
```

Проверка: `psql -h 127.0.0.1 -U onec -d onec -c '\dt mart.*'` показывает таблицы витрин.

## 7. Первая загрузка данных (один раз, вручную)

Порядок важен: справочники, затем себестоимость, затем документы.

```bash
./scripts/run_loader.sh stores
./scripts/run_loader.sh products
./scripts/run_loader.sh analytics_keys
./scripts/run_loader.sh cost_balance    # сам обновит matview себестоимости
./scripts/run_loader.sh receipts        # около 5 минут на 60 тысяч чеков; обновит агрегаты
./scripts/run_loader.sh sales
./scripts/run_loader.sh inventory
```

Логи каждого запуска: `airflow/logs/<entity>.log`.

Проверка:

```sql
SELECT * FROM etl.health ORDER BY entity;   -- все строки OK
SELECT count(*) FROM mart.receipts;          -- больше нуля
```

## 8. Фронт: сборка

```bash
cp .env.local.example .env.local
nano .env.local      # API_URL=http://127.0.0.1:8000, пароль, AUTH_SECRET
npm install
npm run build
```

Для пересборки после обновления кода есть `scripts/build_and_restart_web.sh`.

## 9. systemd: API и фронт

```bash
cp infra/systemd/onec-api.service /etc/systemd/system/
cp infra/systemd/onec-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now onec-api.service onec-web.service
systemctl status onec-api onec-web
```

Логи: `/var/log/onec-api.log`, `/var/log/onec-web.log`.

Проверка:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:3000/api/live | head -c 300
```

## 10. cron: ежечасный ETL

```bash
crontab infra/cron/etl.crontab
crontab -l        # убедиться, что расписание встало
service cron start
```

В crontab стоит `TZ=Asia/Almaty`. Если ваша 1С живёт в другом поясе,
поменяйте и здесь, и `ONEC_TIMEZONE` в `.env`.

## 11. nginx

```bash
cp infra/nginx/onec.conf /etc/nginx/sites-available/onec
ln -sf /etc/nginx/sites-available/onec /etc/nginx/sites-enabled/onec
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

После этого дашборды доступны по `http://<ip-сервера>/dashboard`.

## 12. HTTPS (рекомендуется)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш.домен
```

Затем в `.env.local` добавьте `AUTH_COOKIE_SECURE=1` и перезапустите фронт:
`systemctl restart onec-web`.

---

## Обновление кода на сервере

```bash
cd /opt/1c_analytics
git pull
.venv/bin/pip install -r airflow/requirements.txt -r api/requirements.txt
for f in migrations/*.sql; do ...; done     # только если появились новые миграции
systemctl restart onec-api
./scripts/build_and_restart_web.sh
```

## Если что-то пошло не так

| Симптом                                  | Что проверить                                              |
|------------------------------------------|------------------------------------------------------------|
| `onec-api` не стартует                   | `journalctl -u onec-api -n 50`; чаще всего неверный `.env` |
| Дашборды отдают 503                      | `API_URL` в `.env.local`; жив ли `onec-api`                |
| В `etl.health` статус FAILED             | `tail -n 100 airflow/logs/<entity>.log`                    |
| Загрузчик получает 401 / 404 от 1С       | логин, пароль и состав OData в 1С                          |
| Время в чеках сдвинуто                   | `TZ` в crontab и `ONEC_TIMEZONE` в `.env`                  |

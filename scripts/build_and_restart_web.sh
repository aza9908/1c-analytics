#!/usr/bin/env bash
# Production build + systemd restart фронта. После `git pull` + `npm install`
# запустить этот скрипт.
set -euo pipefail
cd /opt/1c_analytics
echo "[$(date -Iseconds)] npm run build..."
npm run build
echo "[$(date -Iseconds)] systemctl restart onec-web..."
systemctl restart onec-web.service
echo "[$(date -Iseconds)] done; web is $(systemctl is-active onec-web.service)"

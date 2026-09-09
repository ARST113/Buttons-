#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$APP_ROOT" != "/opt/food-order" ]]; then
  echo "Клонируй репозиторий в /opt/food-order и запусти: sudo /opt/food-order/server/install.sh" >&2
  exit 1
fi

if ! id foodorder >/dev/null 2>&1; then
  useradd --system --home /opt/food-order --shell /usr/sbin/nologin foodorder
fi

mkdir -p /opt/food-order/server/data
chown -R foodorder:foodorder /opt/food-order/server/data
install -m 0644 /opt/food-order/server/food-order.service /etc/systemd/system/food-order.service
systemctl daemon-reload
systemctl enable --now food-order.service
sleep 1
systemctl --no-pager --full status food-order.service || true

echo
echo "Проверка API:"
curl -fsS http://127.0.0.1:8765/health && echo

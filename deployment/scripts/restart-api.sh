#!/usr/bin/env bash
# Free port 2034 and restart readerapi — run as vidhyavibe-reader from repo root.
set -euo pipefail

PORT=2034
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Stopping readerapi ==="
pm2 stop readerapi 2>/dev/null || true

echo ""
echo "=== Processes on port $PORT ==="
if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  ss -tlnp | grep ":$PORT " || true
  echo "Killing listeners on $PORT..."
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 1
fi

if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  echo "FAIL: port $PORT still in use. As root run: ss -tlnp | grep $PORT"
  exit 1
fi
echo "Port $PORT is free."

echo ""
echo "=== Starting readerapi ==="
if pm2 describe readerapi >/dev/null 2>&1; then
  pm2 restart readerapi --update-env
else
  pm2 start "$ROOT/deployment/ecosystem.config.cjs" --only readerapi
fi

sleep 2
echo ""
echo "=== Health check ==="
curl -sf "http://127.0.0.1:${PORT}/api/health" && echo ""
echo ""
pm2 status readerapi

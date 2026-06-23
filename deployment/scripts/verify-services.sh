#!/usr/bin/env bash
# Quick smoke test after PM2 start — run from repo root.
set -euo pipefail

echo "=== PM2 ==="
pm2 status

echo ""
echo "=== Ports ==="
ss -tlnp 2>/dev/null | grep -E ':1034|:2034|:3034' || true

echo ""
echo "=== API health (2034) ==="
curl -sf http://127.0.0.1:2034/api/health || { echo "FAIL: API not reachable on 2034"; exit 1; }
echo ""

echo "=== API login route (expect 401, not 404) ==="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:2034/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}')
echo "POST /api/auth/login => HTTP $code"
if [ "$code" = "404" ]; then
  echo "FAIL: API login route missing — rebuild API: pnpm --filter services-api build && pm2 restart readerapi"
  exit 1
fi

echo ""
echo "=== Admin API proxy (expect 401, not 404) ==="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3034/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}')
echo "POST readeradmin:3034/api/auth/login => HTTP $code"
if [ "$code" = "404" ]; then
  echo "FAIL: admin not proxying /api — rebuild admin with INTERNAL_API_URL and restart readeradmin"
  exit 1
fi

echo ""
echo "OK — all services responding."

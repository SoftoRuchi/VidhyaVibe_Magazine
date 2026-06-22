#!/usr/bin/env bash
# Diagnose ChunkLoadError / 400 on /_next/static/chunks/*.js
# Run on server as vidhyavibe-reader:
#   cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
#   bash deployment/scripts/diagnose-static.sh
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "========== ADMIN (port 3034) =========="
ADMIN_DIR="$ROOT/apps/admin"
ADMIN_PORT=3034

if [[ -d "$ADMIN_DIR/.next/static/chunks" ]]; then
  ADMIN_CHUNKS=$(find "$ADMIN_DIR/.next/static/chunks" -name '*.js' 2>/dev/null | wc -l)
  echo "chunk .js files on disk: $ADMIN_CHUNKS"
  ls "$ADMIN_DIR/.next/static/chunks"/7257-*.js 2>/dev/null || echo "MISSING: 7257-*.js (browser error chunk)"
  ls "$ADMIN_DIR/.next/static/chunks"/webpack-*.js 2>/dev/null | head -1
else
  echo "ERROR: $ADMIN_DIR/.next/static/chunks does not exist — build never succeeded"
fi

echo ""
echo "PM2 readeradmin:"
pm2 show readeradmin 2>/dev/null | grep -E 'cwd|script path|exec mode|status' || echo "(pm2 not available)"

echo ""
echo "Local HTTP (admin login):"
curl -sI "http://127.0.0.1:${ADMIN_PORT}/admin/login" 2>/dev/null | head -3 || echo "Cannot reach port $ADMIN_PORT"

echo ""
echo "Local HTTP (sample chunk — replace name if missing):"
CHUNK=$(ls "$ADMIN_DIR/.next/static/chunks"/7257-*.js 2>/dev/null | head -1)
if [[ -n "$CHUNK" ]]; then
  CHUNK_URL="/_next/static/chunks/$(basename "$CHUNK")"
  curl -sI "http://127.0.0.1:${ADMIN_PORT}${CHUNK_URL}" 2>/dev/null | head -5
else
  CHUNK=$(ls "$ADMIN_DIR/.next/static/chunks"/webpack-*.js 2>/dev/null | head -1)
  if [[ -n "$CHUNK" ]]; then
    CHUNK_URL="/_next/static/chunks/$(basename "$CHUNK")"
    curl -sI "http://127.0.0.1:${ADMIN_PORT}${CHUNK_URL}" 2>/dev/null | head -5
  else
    echo "No chunk file to test"
  fi
fi

echo ""
echo "node_modules owner (should be vidhyavibe-reader):"
ls -ld "$ROOT/node_modules" 2>/dev/null || echo "node_modules missing"

echo ""
echo "Windows artifacts in node_modules (should be EMPTY):"
find "$ROOT/node_modules" -name '*.CMD' -o -name 'query_engine-windows.dll.node' 2>/dev/null | head -3
WIN_COUNT=$(find "$ROOT/node_modules" \( -name '*.CMD' -o -name 'query_engine-windows.dll.node' \) 2>/dev/null | wc -l)
if [[ "$WIN_COUNT" -gt 0 ]]; then
  echo ">>> FOUND $WIN_COUNT Windows files — delete node_modules as ROOT and run pnpm install on Linux"
fi

echo ""
echo "========== WEB / reader (port 1034) =========="
WEB_DIR="$ROOT/apps/web"
WEB_PORT=1034
if [[ -d "$WEB_DIR/.next/static/chunks" ]]; then
  WEB_CHUNKS=$(find "$WEB_DIR/.next/static/chunks" -name '*.js' 2>/dev/null | wc -l)
  echo "chunk .js files on disk: $WEB_CHUNKS"
else
  echo "ERROR: $WEB_DIR/.next/static/chunks missing — run: pnpm --filter apps-web build"
fi
curl -sI "http://127.0.0.1:${WEB_PORT}/login" 2>/dev/null | head -3 || echo "Cannot reach port $WEB_PORT"

echo "Failing chunk files on disk:"
ls -la "$ADMIN_DIR/.next/static/chunks/650-"*.js 2>/dev/null || echo "MISSING: chunks/650-*.js"
ls -la "$ADMIN_DIR/.next/static/chunks/app/admin/login/page-"*.js 2>/dev/null || echo "MISSING: app/admin/login/page-*.js"

echo ""
echo "========== PUBLIC vs LOCAL (admin chunk) =========="
SAMPLE_CHUNK="650-f5096496761832e2.js"
if [[ -f "$ADMIN_DIR/.next/static/chunks/$SAMPLE_CHUNK" ]]; then
  echo "File on disk: OK ($SAMPLE_CHUNK)"
else
  SAMPLE_CHUNK=$(basename "$(ls "$ADMIN_DIR/.next/static/chunks"/*.js 2>/dev/null | head -1)")
  echo "Using sample chunk: $SAMPLE_CHUNK"
fi
if [[ -n "$SAMPLE_CHUNK" ]]; then
  echo "Local  : $(curl -sI "http://127.0.0.1:${ADMIN_PORT}/_next/static/chunks/${SAMPLE_CHUNK}" 2>/dev/null | head -1)"
  echo "Public : $(curl -sI "https://readeradmin.vidhyavibe.in/_next/static/chunks/${SAMPLE_CHUNK}" 2>/dev/null | head -1)"
  echo ""
  echo "If Local=200 and Public=400 => CloudPanel/Nginx misconfigured for readeradmin (see DEPLOY-MANUAL.md)"
fi

echo ""
echo "========== INTERPRETATION =========="
echo "- chunk count 0 or MISSING 7257-*  =>  pnpm --filter apps-admin build failed; fix permissions first"
echo "- localhost chunk returns 200, public URL 400  =>  Nginx/CDN/WAF issue"
echo "- localhost chunk returns 400/404  =>  rebuild: rm -rf apps/admin/.next && pnpm --filter apps-admin build"
echo "- Windows .CMD files in node_modules  =>  root: rm -rf node_modules; then pnpm install as vidhyavibe-reader"

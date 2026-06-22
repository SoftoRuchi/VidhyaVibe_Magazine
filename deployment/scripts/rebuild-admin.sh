#!/usr/bin/env bash
# Rebuild and restart admin app on production server.
# Usage (as vidhyavibe-reader):
#   cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
#   bash deployment/scripts/rebuild-admin.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/package.json" ]]; then
  echo "ERROR: package.json not found in $ROOT"
  echo "Run: cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine"
  exit 1
fi

echo "==> pnpm install (root)"
pnpm install || {
  echo ""
  echo "If you see EACCES/EPERM, run as root:"
  echo "  chown -R vidhyavibe-reader:vidhyavibe-reader $ROOT"
  exit 1
}

echo "==> remove old admin .next"
rm -rf apps/admin/.next

echo "==> build admin"
pnpm --filter apps-admin build

echo "==> chunk count"
find apps/admin/.next/static/chunks -name '*.js' 2>/dev/null | wc -l

echo "==> restart PM2 readeradmin"
pm2 restart readeradmin --update-env

echo "==> done. Test: curl -sI http://127.0.0.1:3034/admin/login | head -3"

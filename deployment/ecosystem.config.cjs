/**
 * PM2 config — run from repo root:
 *   pm2 delete reader readeradmin readerapi 2>/dev/null || true
 *   pnpm --filter @magazine/config build
 *   pnpm --filter @magazine/db build
 *   pnpm --filter services-api build
 *   INTERNAL_API_URL=http://127.0.0.1:2034 pnpm --filter apps-admin build
 *
 * Split deploy (API on readerapi.vidhyavibe.in, admin on readeradmin.*):
 *   NEXT_PUBLIC_API_BASE_URL=https://readerapi.vidhyavibe.in pnpm --filter apps-admin build
 *   pm2 start deployment/ecosystem.config.cjs
 *   pm2 save
 *   bash deployment/scripts/verify-services.sh
 */
const path = require('path');

const root = path.join(__dirname, '..');

function nextBin(appDir) {
  return path.join(root, 'apps', appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
}

module.exports = {
  apps: [
    {
      name: 'reader',
      cwd: path.join(root, 'apps/web'),
      script: nextBin('web'),
      args: 'start -p 1034',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'readeradmin',
      cwd: path.join(root, 'apps/admin'),
      script: nextBin('admin'),
      args: 'start -p 3034',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        INTERNAL_API_URL: 'http://127.0.0.1:2034',
      },
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'readerapi',
      cwd: path.join(root, 'services/api'),
      script: path.join(root, 'services/api/dist/index.js'),
      interpreter: 'node',
      // Must match nginx proxy_pass (readerapi.vidhyavibe.in → 127.0.0.1:2034).
      // CloudPanel .env often sets PORT=4001 — PM2 env here overrides that.
      env: { NODE_ENV: 'production', PORT: '2034' },
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

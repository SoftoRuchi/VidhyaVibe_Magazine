/**
 * PM2 config — run from repo root:
 *   pm2 delete reader readeradmin 2>/dev/null; pm2 start deployment/ecosystem.config.cjs; pm2 save
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
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

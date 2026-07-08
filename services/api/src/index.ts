import './dotenv-loader';

// Prevent process exit on unhandled errors so we can log and keep running
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  console.error('[api] uncaughtException:', err);
  if (err.code === 'EADDRINUSE' || err.code === 'EACCES') process.exit(1);
});
process.on('unhandledRejection', (reason, _promise) => {
  console.error('[api] unhandledRejection:', reason);
});

import { createLogger, getEnv } from '@magazine/config';
import cookieParser from 'cookie-parser';
import express from 'express';

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { auditMiddleware } from './middleware/audit';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import { registerAdapters } from './providers';
import adminAgeGroupsRoutes from './routes/admin/age-groups';
import adminCouponsRoutes from './routes/admin/coupons';
import adminDashboardRoutes from './routes/admin/dashboard';
import adminDispatchesRoutes from './routes/admin/dispatches';
import adminMagazineRoutes from './routes/admin/magazine';
import adminMagazineListRoutes from './routes/admin/magazine-list';
import adminPaymentsRoutes from './routes/admin/payments';
import adminPlansRoutes from './routes/admin/plans';
import adminPostsRoutes from './routes/admin/posts';
import adminPresignRoutes from './routes/admin/presign';
import adminReadersRoutes from './routes/admin/readers';
import adminSalesRoutes from './routes/admin/sales';
import adminSubscriptionsRoutes from './routes/admin/subscriptions';
import adminUsersRoutes from './routes/admin/users';
import ageGroupsRoutes from './routes/age-groups';
import assetsRoutes from './routes/assets';
import authRoutes from './routes/auth';
import editionsRoutes from './routes/editions';
import interactionsRoutes from './routes/interactions';
import libraryRoutes from './routes/library';
import magazinesRoutes from './routes/magazines';
import paymentsRoutes from './routes/payments';
import postsRoutes from './routes/posts';
import readerProgressRoutes from './routes/readerProgress';
import readersRoutes from './routes/readers';
import salesRoutes from './routes/sales';
import subscriptionsRoutes from './routes/subscriptions';

const logger = createLogger('api');
const env = getEnv();

const app = express();
// Minimal routes first so a browser/curl check always gets a response even if
// later middleware (rate limit, DB audit, etc.) misbehaves on some setups.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});
app.get('/', (_req, res) => {
  res.type('application/json');
  res.json({
    message: 'VidhyaVibe API (use the web app on port 3000, or call /api/* from the frontend)',
    health: '/api/health',
  });
});

// Trust proxy so express-rate-limit can correctly identify clients via X-Forwarded-For
app.set('trust proxy', 1);
app.use(corsMiddleware);
// Security headers (allow cross-origin fetches from readeradmin / reader)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(cookieParser());

// Global rate limiter (reader loads PDF + pages can exceed 100 req/15min)
app.use(
  rateLimit({
    windowMs: Number(env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(env.RATE_LIMIT_MAX || 1000),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Audit logging (after rate limiting)
app.use(auditMiddleware);

// Public routes (no auth required)
app.use('/api/magazines', magazinesRoutes);
app.use('/api/age-groups', ageGroupsRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/posts', postsRoutes);

// auth routes
app.use('/api/auth', authRoutes);
app.use('/api/readers', readersRoutes);
app.use('/api/admin/magazines', adminMagazineRoutes);
app.use('/api/admin/magazines', adminMagazineListRoutes);
app.use('/api/admin/magazines', adminPresignRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/admin/coupons', adminCouponsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin/payments', adminPaymentsRoutes);
app.use('/api/editions', editionsRoutes);
app.use('/api/reader-progress', readerProgressRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/admin/dispatches', adminDispatchesRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);
app.use('/api/admin/readers', adminReadersRoutes);
app.use('/api/admin/plans', adminPlansRoutes);
app.use('/api/admin/age-groups', adminAgeGroupsRoutes);
app.use('/api/admin/sales', adminSalesRoutes);
app.use('/api/admin/posts', adminPostsRoutes);
app.use('/api/assets', assetsRoutes);

// Register provider adapters (storage, cache, db) based on env
registerAdapters(env, { logger });

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// Central error handler
app.use(errorHandler(logger));

const port = Number(env.PORT || 2034);
// Listen on all interfaces so both 127.0.0.1 and localhost (IPv4/IPv6) behave consistently on Windows.
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`API listening on ${port} (0.0.0.0)`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  logger.error(
    { err, port },
    'Failed to bind API port — stop the other process on this port, then restart',
  );
  process.exit(1);
});

// Optional dispatch scheduler worker
if (process.env.RUN_DISPATCH_WORKER === 'true') {
  const { assignEditionsToSchedules } = require('./services/dispatchScheduler');
  const intervalMs = Number(process.env.DISPATCH_WORKER_INTERVAL_MS || 10 * 60 * 1000);
  logger.info({ intervalMs }, 'Starting dispatch scheduler worker');
  setInterval(async () => {
    try {
      const r = await assignEditionsToSchedules();
      logger.info({ result: r }, 'Dispatch scheduler run complete');
    } catch (e: any) {
      logger.error({ err: e }, 'Dispatch scheduler run failed');
    }
  }, intervalMs);
}

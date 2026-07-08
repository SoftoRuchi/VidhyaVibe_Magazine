import type { Request, Response, NextFunction } from 'express';
import { query } from '../db';

function shouldSkipAudit(req: Request): boolean {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (path === '/' || path === '/api/health') return true;
  if (req.method === 'GET' && path.startsWith('/api/assets/serve')) return true;
  if (req.method === 'GET' && /^\/api\/editions\/\d+\/(pages|sample|pdf)/.test(path)) return true;
  if (req.method === 'GET' && path.startsWith('/api/magazines')) return true;
  return false;
}

export async function auditMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (shouldSkipAudit(req)) {
    next();
    return;
  }

  try {
    const userId = (req as { user?: { id?: number } }).user?.id || null;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const body =
      req.method === 'GET' || req.method === 'HEAD' ? null : JSON.stringify(req.body || {});
    const ip = req.ip;
    const ua = req.headers['user-agent'] || '';
    void query(
      'INSERT INTO audit_logs (user_id, method, path, body, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [userId, method, path, body, ip, ua],
    ).catch(() => {
      /* table may not exist */
    });
  } catch {
    /* audit must not block requests */
  } finally {
    next();
  }
}

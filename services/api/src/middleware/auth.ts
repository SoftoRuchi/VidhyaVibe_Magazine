import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { rowIsAdmin } from '../auth/userFlags';
import { getPool } from '../db';

export interface AuthRequest extends Request {
  user?: { id: number; email?: string; isAdmin?: boolean };
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth) {
    const parts = auth.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
      return parts[1];
    }
  }
  const alt = req.headers['x-access-token'];
  if (typeof alt === 'string' && alt.trim()) return alt.trim();
  return null;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: 'missing_authorization' });

  let userId: number;
  try {
    const payload = verifyAccessToken(token);
    userId = Number(payload?.sub);
    if (!userId) return res.status(401).json({ error: 'invalid_token_payload' });
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name;
    if (name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired' });
    }
    if (name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid_token' });
    }
    console.error('[requireAuth] jwt verify failed:', e);
    return res.status(401).json({ error: 'invalid_token' });
  }

  let conn: Awaited<ReturnType<ReturnType<typeof getPool>['getConnection']>> | undefined;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    const [rows]: any = await conn.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'user_not_found' });
    req.user = { id: u.id, email: u.email, isAdmin: rowIsAdmin(u) };
    next();
  } catch (e: unknown) {
    console.error('[requireAuth] database error:', e);
    return res.status(500).json({ error: 'auth_db_error' });
  } finally {
    conn?.release();
  }
}

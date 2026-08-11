import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { rowIsAdmin } from '../auth/userFlags';
import { getPool } from '../db';
import type { AuthRequest } from './auth';

/** Attach user if a valid token is present; never fail the request. */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    let token: string | null = null;
    if (auth) {
      const parts = auth.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
        token = parts[1];
      }
    }
    if (!token) {
      const alt = req.headers['x-access-token'];
      if (typeof alt === 'string' && alt.trim()) token = alt.trim();
    }
    if (!token) return next();

    const payload = verifyAccessToken(token);
    const userId = Number(payload?.sub);
    if (!userId) return next();

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [rows]: any = await conn.query(
        'SELECT id, email, isAdmin FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const u = rows[0];
      if (u) {
        req.user = { id: u.id, email: u.email, isAdmin: rowIsAdmin(u) };
      }
    } finally {
      conn.release();
    }
  } catch {
    // ignore — optional
  }
  next();
}

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { rowIsAdmin } from '../auth/userFlags';
import { getPool } from '../db';

export interface AuthRequest extends Request {
  user?: { id: number; email?: string; isAdmin?: boolean };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization' });
    const parts = auth.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization format' });
    const token = parts[1];
    const payload = verifyAccessToken(token) as any;
    const userId = Number(payload?.sub);
    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    // Fetch fresh user info from DB (server-side role verification)
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [rows]: any = await conn.query(
        'SELECT id, email, isAdmin, is_admin FROM users WHERE id = ? LIMIT 1',
        [userId],
      );
      const u = rows[0];
      if (!u) return res.status(401).json({ error: 'user_not_found' });
      req.user = { id: u.id, email: u.email, isAdmin: rowIsAdmin(u) };
      next();
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

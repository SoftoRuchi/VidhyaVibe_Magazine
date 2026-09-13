import type { Response, NextFunction } from 'express';
import { getPool } from '../db';
import type { AuthRequest } from './auth';

/** True when the account has any active magazine subscription. */
export async function hasActiveSubscription(userId: number): Promise<boolean> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT id FROM user_subscriptions
       WHERE userId = ? AND status = 'ACTIVE' AND (endsAt IS NULL OR endsAt > NOW())
       LIMIT 1`,
      [userId],
    );
    return !!rows?.[0];
  } finally {
    conn.release();
  }
}

/** Learn activities are included with an active magazine subscription. */
export async function requireLearnSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = Number(req.user?.id);
  if (!userId) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (req.user?.isAdmin) return next();

  try {
    const ok = await hasActiveSubscription(userId);
    if (ok) return next();
    return res.status(403).json({
      error: 'subscription_required',
      message: 'Subscribe to a magazine to unlock learning activities',
    });
  } catch (e) {
    console.error('[requireLearnSubscription]', e);
    return res.status(500).json({ error: 'subscription_check_failed' });
  }
}

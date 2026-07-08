import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { rowIsAdmin } from '../auth/userFlags';
import { query } from '../db';
import { BoundedTTLCache } from '../utils/boundedCache';

const ACCESS_TTL_MS = 5 * 60 * 1000;
const accessCache = new BoundedTTLCache<boolean>(
  Number(process.env.EDITION_ACCESS_CACHE_SIZE || 5000),
);

function cacheGet(userId: number, editionId: number): boolean | null {
  return accessCache.get(`${userId}:${editionId}`);
}

function cacheSet(userId: number, editionId: number, ok: boolean) {
  accessCache.set(`${userId}:${editionId}`, ok, ACCESS_TTL_MS);
}

export async function requireEditionAccess(req: Request, res: Response, next: NextFunction) {
  const editionId = Number(req.params.editionId);
  if (!editionId) return res.status(400).json({ error: 'edition_id_required' });

  const auth = req.headers.authorization || (req.query?.token ? `Bearer ${req.query.token}` : null);
  if (!auth) return res.status(401).json({ error: 'authentication_required' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer')
    return res.status(401).json({ error: 'invalid_authorization' });

  let userId: number;
  try {
    const payload = verifyAccessToken(parts[1]) as { sub?: number | string };
    userId = Number(payload?.sub);
  } catch {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
  if (!userId) return res.status(401).json({ error: 'invalid_token' });

  const cached = cacheGet(userId, editionId);
  if (cached === true) return next();
  if (cached === false) {
    return res
      .status(403)
      .json({ error: 'access_denied', message: 'Subscribe or purchase to read this edition' });
  }

  try {
    const [rows]: any = await query(
      `SELECT e.magazineId, u.isAdmin,
        EXISTS(
          SELECT 1 FROM edition_purchases ep
          WHERE ep.userId = ? AND ep.editionId = ?
        ) AS hasPurchase,
        EXISTS(
          SELECT 1 FROM user_subscriptions us
          WHERE us.userId = ? AND us.magazineId = e.magazineId
            AND us.status = 'ACTIVE' AND (us.endsAt IS NULL OR us.endsAt > NOW())
        ) AS hasSubscription
       FROM magazine_editions e
       LEFT JOIN users u ON u.id = ?
       WHERE e.id = ?
       LIMIT 1`,
      [userId, editionId, userId, userId, editionId],
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'edition_not_found' });

    const allowed =
      rowIsAdmin(row) || Number(row.hasPurchase) === 1 || Number(row.hasSubscription) === 1;

    cacheSet(userId, editionId, allowed);
    if (allowed) return next();

    return res
      .status(403)
      .json({ error: 'access_denied', message: 'Subscribe or purchase to read this edition' });
  } catch (e) {
    console.error('[requireEditionAccess]', e);
    return res.status(500).json({ error: 'access_check_failed' });
  }
}

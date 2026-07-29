import { Router } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { getPool } from '../db';
import { ensureCouponVisibilitySchema } from '../services/coupons';

const router = Router();

function optionalUserId(req: any): number | null {
  try {
    const auth = req.headers?.authorization;
    let token: string | null = null;
    if (auth) {
      const parts = String(auth).split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
        token = parts[1];
      }
    }
    if (!token) {
      const alt = req.headers?.['x-access-token'];
      if (typeof alt === 'string' && alt.trim()) token = alt.trim();
    }
    if (!token) return null;
    const payload = verifyAccessToken(token);
    const id = Number(payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Public list of active coupons for the subscribe UI.
 * Optional filters: magazineId, planId — returns global coupons plus matching scoped ones.
 * Visibility:
 *  - showToUsers=0 → never listed
 *  - restrictToUsers=1 → only listed for assigned logged-in users
 */
router.get('/available', async (req, res) => {
  const magazineId =
    req.query.magazineId != null && req.query.magazineId !== ''
      ? Number(req.query.magazineId)
      : null;
  const planId =
    req.query.planId != null && req.query.planId !== '' ? Number(req.query.planId) : null;
  const userId = optionalUserId(req);

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await ensureCouponVisibilitySchema();

    const params: any[] = [];
    let scopeSql = '';

    if (magazineId && Number.isFinite(magazineId) && planId && Number.isFinite(planId)) {
      scopeSql = `AND (c.magazineId IS NULL OR c.magazineId = ?)
                  AND (c.planId IS NULL OR c.planId = ?)`;
      params.push(magazineId, planId);
    } else if (magazineId && Number.isFinite(magazineId)) {
      scopeSql = 'AND (c.magazineId IS NULL OR c.magazineId = ?)';
      params.push(magazineId);
    } else if (planId && Number.isFinite(planId)) {
      scopeSql = 'AND (c.planId IS NULL OR c.planId = ?)';
      params.push(planId);
    }

    let visibilitySql = 'AND c.showToUsers = 1';
    if (userId) {
      visibilitySql += ` AND (
        c.restrictToUsers = 0
        OR EXISTS (
          SELECT 1 FROM coupon_user_assignments a
          WHERE a.couponId = c.id AND a.userId = ?
        )
      )`;
      params.push(userId);
    } else {
      visibilitySql += ' AND c.restrictToUsers = 0';
    }

    const [rows]: any = await conn.query(
      `SELECT
         c.id,
         c.code,
         c.description,
         c.discountPct,
         c.discountCents,
         c.expiresAt,
         c.maxUses,
         c.planId,
         c.magazineId,
         (SELECT COUNT(*) FROM coupon_usages u WHERE u.couponId = c.id) AS useCount
       FROM coupons c
       WHERE c.active = 1
         AND (c.expiresAt IS NULL OR c.expiresAt > NOW())
         ${visibilitySql}
         ${scopeSql}
       ORDER BY c.createdAt DESC
       LIMIT 50`,
      params,
    );

    const available = (rows || [])
      .filter((c: any) => {
        if (c.maxUses == null) return true;
        return Number(c.useCount || 0) < Number(c.maxUses);
      })
      .map((c: any) => ({
        id: Number(c.id),
        code: c.code,
        description: c.description || null,
        discountPct: c.discountPct != null ? Number(c.discountPct) : null,
        discountFixed: c.discountCents != null ? Number(c.discountCents) : null,
        expiresAt: c.expiresAt || null,
        label:
          c.discountPct != null
            ? `${c.code} — ${c.discountPct}% off`
            : c.discountCents != null
              ? `${c.code} — ₹${c.discountCents} off`
              : c.code,
      }));

    res.json(available);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_available_failed', details: e.message });
  } finally {
    conn.release();
  }
});

export default router;

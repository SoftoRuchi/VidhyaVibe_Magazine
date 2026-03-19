import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with user, magazine, plan info.
 * Query: status, magazineId
 */
router.get('/', async (req, res) => {
  const { status, magazineId } = req.query;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    let query = `
      SELECT us.id, us.userId, us.readerId, us.magazineId, us.planId, us.status, us.startsAt, us.endsAt, us.price, us.currency, us.createdAt,
             u.email as userEmail, u.name as userName,
             m.title as magazineTitle, m.slug as magazineSlug,
             sp.name as planName, sp.slug as planSlug
      FROM user_subscriptions us
      LEFT JOIN users u ON u.id = us.userId
      LEFT JOIN magazines m ON m.id = us.magazineId
      LEFT JOIN subscription_plans sp ON sp.id = us.planId
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && typeof status === 'string') {
      query += ' AND us.status = ?';
      params.push(status);
    }
    if (magazineId) {
      query += ' AND us.magazineId = ?';
      params.push(Number(magazineId));
    }

    query += ' ORDER BY us.createdAt DESC';

    const [rows]: any = await conn.query(query, params);
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_subscriptions_failed' });
  } finally {
    conn.release();
  }
});

export default router;

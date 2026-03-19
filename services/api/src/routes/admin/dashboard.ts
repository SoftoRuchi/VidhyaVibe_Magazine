import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
// TEMPORARILY DISABLED FOR DEVELOPMENT - TODO: Re-enable auth
// router.use(requireAuth);
// router.use(requireAdmin);

// Combined summary for dashboard
router.get('/summary', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [[userCount]]: any = await conn.query('SELECT COUNT(*) as count FROM users');
    const [[magCount]]: any = await conn.query('SELECT COUNT(*) as count FROM magazines');
    const [[subCount]]: any = await conn.query('SELECT COUNT(*) as count FROM user_subscriptions');
    const [[readerCount]]: any = await conn.query('SELECT COUNT(*) as count FROM readers');
    const [revRows]: any = await conn.query(
      `SELECT SUM(amountCents) as total_cents FROM payments WHERE status = 'SUCCESS'`,
    );
    const [[pendingSubProofs]]: any = await conn
      .query(
        'SELECT COUNT(*) as count FROM order_proofs p JOIN orders o ON p.order_id = o.id WHERE p.verified = 0',
      )
      .catch(() => [[{ count: 0 }]]);
    const [[pendingEdProofs]]: any = await conn
      .query('SELECT COUNT(*) as count FROM edition_order_proofs WHERE verified = 0')
      .catch(() => [[{ count: 0 }]]);

    res.json({
      totalUsers: userCount?.count || 0,
      totalMagazines: magCount?.count || 0,
      totalSubscriptions: subCount?.count || 0,
      totalReaders: readerCount?.count || 0,
      totalRevenueCents: revRows[0]?.total_cents || 0,
      pendingProofs: (pendingSubProofs?.count || 0) + (pendingEdProofs?.count || 0),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'summary_failed' });
  } finally {
    conn.release();
  }
});

// Subscription tracking: list active subscriptions and counts by plan/status
router.get('/subscriptions/summary', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [[totalRows]]: any = await conn.query('SELECT COUNT(*) as total FROM user_subscriptions');
    const [byStatus]: any = await conn.query(
      'SELECT status, COUNT(*) as cnt FROM user_subscriptions GROUP BY status',
    );
    const [byPlan]: any = await conn.query(
      'SELECT sp.id, sp.name, COUNT(us.id) as cnt FROM subscription_plans sp LEFT JOIN user_subscriptions us ON us.planId = sp.id GROUP BY sp.id, sp.name',
    );
    res.json({ total: totalRows.total || 0, byStatus, byPlan });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'subscriptions_summary_failed' });
  } finally {
    conn.release();
  }
});

// Reader + school analytics: counts by school city and class
router.get('/readers/analytics', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [byCity]: any = await conn.query(
      'SELECT schoolCity, COUNT(*) as cnt FROM readers WHERE schoolCity IS NOT NULL GROUP BY schoolCity ORDER BY cnt DESC LIMIT 50',
    );
    const [bySchool]: any = await conn.query(
      'SELECT schoolName, COUNT(*) as cnt FROM readers WHERE schoolName IS NOT NULL GROUP BY schoolName ORDER BY cnt DESC LIMIT 50',
    );
    const [byClass]: any = await conn.query(
      'SELECT className, COUNT(*) as cnt FROM readers WHERE className IS NOT NULL GROUP BY className ORDER BY cnt DESC',
    );
    res.json({ byCity, bySchool, byClass });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'readers_analytics_failed' });
  } finally {
    conn.release();
  }
});

// Dispatch calendar: return schedules between dates
router.get('/dispatch/calendar', async (req, res) => {
  const { start, end } = req.query;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const rowsSql = await conn.query(
      'SELECT ds.id, ds.scheduledAt, ds.status, ds.editionId, ds.subscriptionId, us.userId, us.magazineId FROM dispatch_schedules ds JOIN user_subscriptions us ON ds.subscriptionId = us.id WHERE ds.scheduledAt BETWEEN ? AND ? ORDER BY ds.scheduledAt ASC',
      [start || '1970-01-01', end || '2099-12-31'],
    );
    const rows: any = rowsSql[0];
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'dispatch_calendar_failed' });
  } finally {
    conn.release();
  }
});

// Payment verification queue: reuse payments pending list
router.get('/payments/pending', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // Tables orders and order_proofs do not exist in schema.prisma
    // const [rows]: any = await conn.query('SELECT o.*, p.final_amount FROM orders o LEFT JOIN order_proofs p ON p.order_id = o.id WHERE o.status = ? ORDER BY o.created_at DESC', ['PENDING']);
    res.json([]);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'payments_pending_failed' });
  } finally {
    conn.release();
  }
});

// Coupon analytics: usage and redemptions
router.get('/coupons/analytics', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [byCoupon]: any = await conn.query(
      'SELECT c.id, c.code, c.discountPct, c.discountCents, COUNT(u.id) as uses FROM coupons c LEFT JOIN coupon_usages u ON u.couponId = c.id GROUP BY c.id, c.code, c.discountPct, c.discountCents ORDER BY uses DESC',
    );
    res.json({ byCoupon });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'coupons_analytics_failed' });
  } finally {
    conn.release();
  }
});

// Revenue dashboard: sum of payments by day (paid)
router.get('/revenue', async (req, res) => {
  const { start, end } = req.query;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT DATE(createdAt) as date, SUM(amountCents) as total_cents FROM payments WHERE status = 'SUCCESS' AND createdAt BETWEEN ? AND ? GROUP BY DATE(createdAt) ORDER BY DATE(createdAt) ASC`,
      [start || '1970-01-01', end || '2099-12-31'],
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'revenue_failed' });
  } finally {
    conn.release();
  }
});

export default router;

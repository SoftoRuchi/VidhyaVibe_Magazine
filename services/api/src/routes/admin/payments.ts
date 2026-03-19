import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import { verifyProof, verifyEditionProof } from '../../services/payments';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/payments/orders
 * Combined view: subscription orders (orders) + edition orders (edition_orders)
 */
router.get('/orders', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [subOrders]: any = await conn
      .query(
        `
      SELECT po.id, po.user_id as userId, po.plan_id as planId, po.magazine_id as magazineId, po.months, po.amount as amount, po.final_amount as finalAmount, po.currency, po.status, po.rp_order_id as rpOrderId, po.created_at as createdAt,
             u.email as userEmail, u.name as userName,
             m.title as magazineTitle,
             sp.name as planName
      FROM orders po
      LEFT JOIN users u ON u.id = po.user_id
      LEFT JOIN magazines m ON m.id = po.magazine_id
      LEFT JOIN subscription_plans sp ON sp.id = po.plan_id
      ORDER BY po.created_at DESC
    `,
      )
      .catch(() => [[]]);

    const [edOrders]: any = await conn.query(`
      SELECT eo.id, eo.user_id as userId, eo.edition_id as editionId, eo.amount_cents as amountCents, eo.currency, eo.status, eo.created_at as createdAt,
             u.email as userEmail, u.name as userName,
             m.title as magazineTitle, me.volume, me.issueNumber
      FROM edition_orders eo
      LEFT JOIN users u ON u.id = eo.user_id
      LEFT JOIN magazine_editions me ON me.id = eo.edition_id
      LEFT JOIN magazines m ON m.id = me.magazineId
      ORDER BY eo.created_at DESC
    `);

    res.json({
      subscriptionOrders: subOrders || [],
      editionOrders: edOrders || [],
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_orders_failed' });
  } finally {
    conn.release();
  }
});

router.get('/orders/pending', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC',
      ['PENDING'],
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.get('/proofs/pending', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT p.*, o.final_amount FROM order_proofs p JOIN orders o ON p.order_id = o.id WHERE p.verified = 0 ORDER BY p.created_at DESC',
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.post('/proofs/:id/verify', async (req, res) => {
  const proofId = Number(req.params.id);
  const adminId = Number((req as any).user?.id);
  try {
    const result = await verifyProof(proofId, adminId);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'verify_failed', message: e.message });
  }
});

router.get('/edition-orders/pending', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT * FROM edition_orders WHERE status = ? ORDER BY created_at DESC',
      ['PENDING'],
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.get('/edition-proofs/pending', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT p.*, o.amount_cents, o.edition_id FROM edition_order_proofs p JOIN edition_orders o ON p.order_id = o.id WHERE p.verified = 0 ORDER BY p.created_at DESC',
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.post('/edition-proofs/:id/verify', async (req, res) => {
  const proofId = Number(req.params.id);
  const adminId = Number((req as any).user?.id);
  try {
    const result = await verifyEditionProof(proofId, adminId);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'verify_failed', message: e.message });
  }
});

export default router;

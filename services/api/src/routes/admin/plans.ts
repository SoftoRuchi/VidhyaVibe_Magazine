import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT id, name, minMonths as month, active FROM subscription_plans ORDER BY createdAt DESC',
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_plans_failed' });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT id, name, minMonths as month, active FROM subscription_plans WHERE id = ? LIMIT 1',
      [id],
    );
    const plan = rows[0];
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    res.json(plan);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'get_plan_failed' });
  } finally {
    conn.release();
  }
});

router.post('/', async (req, res) => {
  const { name, month, active } = req.body;
  if (!name || month == null) return res.status(400).json({ error: 'name and month required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const monthNum = Number(month);
    if (!Number.isFinite(monthNum) || monthNum < 1) {
      return res.status(400).json({ error: 'invalid_month' });
    }
    const slug = `${String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const [r]: any = await conn.query(
      `INSERT INTO subscription_plans (name, slug, description, price, currency, minMonths, maxMonths, deliveryMode, autoDispatch, dispatchFrequencyDays, active, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [name, slug, null, 0, 'INR', monthNum, monthNum, 'BOTH', 1, null, active !== false ? 1 : 0],
    );
    res.status(201).json({ id: r.insertId });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'slug_already_exists' });
    res.status(500).json({ error: 'create_plan_failed' });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, month, active } = req.body;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query(
      'SELECT id FROM subscription_plans WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing[0]) return res.status(404).json({ error: 'plan_not_found' });

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (month !== undefined) {
      const monthNum = Number(month);
      if (!Number.isFinite(monthNum) || monthNum < 1) {
        return res.status(400).json({ error: 'invalid_month' });
      }
      updates.push('minMonths = ?');
      updates.push('maxMonths = ?');
      values.push(monthNum, monthNum);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active ? 1 : 0);
    }

    if (updates.length === 0) return res.json({ id });

    values.push(id);
    await conn.query(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ id });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'slug_already_exists' });
    res.status(500).json({ error: 'update_plan_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query(
      'SELECT id FROM subscription_plans WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing[0]) return res.status(404).json({ error: 'plan_not_found' });

    await conn.query('DELETE FROM subscription_plans WHERE id = ? LIMIT 1', [id]);
    res.json({ id, deleted: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_plan_failed' });
  } finally {
    conn.release();
  }
});

export default router;

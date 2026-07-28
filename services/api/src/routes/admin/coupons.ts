import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import { normalizeCouponCode } from '../../services/coupons';
import { toMysqlDateTime } from '../../utils/mysqlDateTime';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/** Always return expiresAt as a plain wall-clock string (never a JS Date → ISO). */
const COUPON_SELECT = `
  c.id, c.code, c.description, c.discountPct, c.discountCents,
  DATE_FORMAT(c.expiresAt, '%Y-%m-%d %H:%i:%s') AS expiresAt,
  c.maxUses, c.perUserLimit, c.active, c.planId, c.magazineId, c.createdAt,
  (SELECT COUNT(*) FROM coupon_usages u WHERE u.couponId = c.id) AS useCount
`;

function buildCouponFields(body: any) {
  const normalized = normalizeCouponCode(body.code);
  if (!normalized) {
    const err: any = new Error('code_required');
    err.status = 400;
    throw err;
  }

  let expiresAtMysql: string | null = null;
  try {
    expiresAtMysql = toMysqlDateTime(body.expiresAt);
  } catch {
    const err: any = new Error('invalid_expiresAt');
    err.status = 400;
    throw err;
  }

  return {
    code: normalized,
    description: body.description || null,
    discountPct:
      body.discountPct != null && body.discountPct !== '' ? Number(body.discountPct) : null,
    discountCents:
      body.discountCents != null && body.discountCents !== '' ? Number(body.discountCents) : null,
    expiresAt: expiresAtMysql,
    maxUses: body.maxUses != null && body.maxUses !== '' ? Number(body.maxUses) : null,
    perUserLimit:
      body.perUserLimit != null && body.perUserLimit !== '' ? Number(body.perUserLimit) : null,
    active: body.active ? 1 : 0,
    planId: body.planId != null && body.planId !== '' ? Number(body.planId) : null,
    magazineId: body.magazineId != null && body.magazineId !== '' ? Number(body.magazineId) : null,
  };
}

router.get('/list', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT ${COUPON_SELECT}
       FROM coupons c
       ORDER BY c.createdAt DESC`,
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.get('/usages', async (req, res) => {
  const couponId = req.query.couponId != null ? Number(req.query.couponId) : null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    let where = '';
    if (couponId && Number.isFinite(couponId)) {
      where = 'WHERE u.couponId = ?';
      params.push(couponId);
    }
    const [rows]: any = await conn.query(
      `SELECT
         u.id,
         u.couponId,
         u.userId,
         u.subscriptionId,
         DATE_FORMAT(u.usedAt, '%Y-%m-%d %H:%i:%s') AS usedAt,
         c.code AS couponCode,
         c.discountPct,
         c.discountCents,
         usr.name AS userName,
         usr.email AS userEmail,
         usr.phone AS userPhone,
         s.magazineId,
         s.planId,
         s.price AS subscriptionPrice,
         s.currency AS subscriptionCurrency,
         m.title AS magazineTitle
       FROM coupon_usages u
       JOIN coupons c ON c.id = u.couponId
       LEFT JOIN users usr ON usr.id = u.userId
       LEFT JOIN user_subscriptions s ON s.id = u.subscriptionId
       LEFT JOIN magazines m ON m.id = s.magazineId
       ${where}
       ORDER BY u.usedAt DESC
       LIMIT 500`,
      params,
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'usages_failed', details: e.message });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT ${COUPON_SELECT}
       FROM coupons c
       WHERE c.id = ?
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'get_failed', details: e.message });
  } finally {
    conn.release();
  }
});

router.post('/', async (req, res) => {
  let fields: ReturnType<typeof buildCouponFields>;
  try {
    fields = buildCouponFields(req.body);
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      `INSERT INTO coupons
        (code, description, discountPct, discountCents, expiresAt, maxUses, perUserLimit, active, planId, magazineId, createdAt)
       VALUES (?, ?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), ?, ?, ?, ?, ?, NOW())`,
      [
        fields.code,
        fields.description,
        fields.discountPct,
        fields.discountCents,
        fields.expiresAt,
        fields.maxUses,
        fields.perUserLimit,
        fields.active,
        fields.planId,
        fields.magazineId,
      ],
    );
    res.status(201).json({ id: r.insertId, code: fields.code, expiresAt: fields.expiresAt });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'code_exists', details: 'Coupon code already exists' });
    }
    res.status(500).json({ error: 'create_failed', details: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

  let fields: ReturnType<typeof buildCouponFields>;
  try {
    fields = buildCouponFields(req.body);
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query('SELECT id FROM coupons WHERE id = ? LIMIT 1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'not_found' });

    await conn.query(
      `UPDATE coupons
       SET code = ?, description = ?, discountPct = ?, discountCents = ?,
           expiresAt = STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'),
           maxUses = ?, perUserLimit = ?, active = ?, planId = ?, magazineId = ?
       WHERE id = ?`,
      [
        fields.code,
        fields.description,
        fields.discountPct,
        fields.discountCents,
        fields.expiresAt,
        fields.maxUses,
        fields.perUserLimit,
        fields.active,
        fields.planId,
        fields.magazineId,
        id,
      ],
    );
    res.json({ id, code: fields.code, expiresAt: fields.expiresAt });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'code_exists', details: 'Coupon code already exists' });
    }
    res.status(500).json({ error: 'update_failed', details: e.message });
  } finally {
    conn.release();
  }
});

export default router;

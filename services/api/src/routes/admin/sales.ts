import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const SELECT_FIELDS = `
  id, type, badge, title, subtitle, highlight, detail, color, border_color AS borderColor,
  cta_label AS ctaLabel, cta_href AS ctaHref, plan_id AS planId, magazine_id AS magazineId,
  sort_order AS sortOrder, active, starts_at AS startsAt, expires_at AS expiresAt,
  created_at AS createdAt, updated_at AS updatedAt
`;

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    type: row.type,
    badge: row.badge ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    highlight: row.highlight ?? null,
    detail: row.detail ?? null,
    color: row.color ?? null,
    borderColor: row.borderColor ?? null,
    ctaLabel: row.ctaLabel ?? null,
    ctaHref: row.ctaHref ?? null,
    planId: row.planId != null ? Number(row.planId) : null,
    magazineId: row.magazineId != null ? Number(row.magazineId) : null,
    sortOrder: Number(row.sortOrder ?? 0),
    active: !!row.active,
    startsAt: row.startsAt ?? null,
    expiresAt: row.expiresAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get('/list', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT ${SELECT_FIELDS} FROM sale_offers ORDER BY sort_order ASC, id ASC`,
    );
    res.json((rows || []).map(mapRow));
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
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
      `SELECT ${SELECT_FIELDS} FROM sale_offers WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(mapRow(row));
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'get_failed' });
  } finally {
    conn.release();
  }
});

router.post('/', async (req, res) => {
  const {
    type = 'DEAL',
    badge,
    title,
    subtitle,
    highlight,
    detail,
    color,
    borderColor,
    ctaLabel,
    ctaHref,
    planId,
    magazineId,
    sortOrder = 0,
    active = true,
    startsAt,
    expiresAt,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      `INSERT INTO sale_offers
        (type, badge, title, subtitle, highlight, detail, color, border_color, cta_label, cta_href,
         plan_id, magazine_id, sort_order, active, starts_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        type,
        badge || null,
        title,
        subtitle || null,
        highlight || null,
        detail || null,
        color || null,
        borderColor || null,
        ctaLabel || null,
        ctaHref || null,
        planId || null,
        magazineId || null,
        Number(sortOrder) || 0,
        active ? 1 : 0,
        startsAt || null,
        expiresAt || null,
      ],
    );
    res.status(201).json({ id: r.insertId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_failed', message: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const {
    type,
    badge,
    title,
    subtitle,
    highlight,
    detail,
    color,
    borderColor,
    ctaLabel,
    ctaHref,
    planId,
    magazineId,
    sortOrder,
    active,
    startsAt,
    expiresAt,
  } = req.body;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query('SELECT id FROM sale_offers WHERE id = ? LIMIT 1', [
      id,
    ]);
    if (!existing?.[0]) return res.status(404).json({ error: 'not_found' });

    await conn.query(
      `UPDATE sale_offers SET
        type = COALESCE(?, type),
        badge = ?,
        title = COALESCE(?, title),
        subtitle = ?,
        highlight = ?,
        detail = ?,
        color = ?,
        border_color = ?,
        cta_label = ?,
        cta_href = ?,
        plan_id = ?,
        magazine_id = ?,
        sort_order = COALESCE(?, sort_order),
        active = COALESCE(?, active),
        starts_at = ?,
        expires_at = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        type ?? null,
        badge ?? null,
        title ?? null,
        subtitle ?? null,
        highlight ?? null,
        detail ?? null,
        color ?? null,
        borderColor ?? null,
        ctaLabel ?? null,
        ctaHref ?? null,
        planId ?? null,
        magazineId ?? null,
        sortOrder != null ? Number(sortOrder) : null,
        active != null ? (active ? 1 : 0) : null,
        startsAt ?? null,
        expiresAt ?? null,
        id,
      ],
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed', message: e.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query('DELETE FROM sale_offers WHERE id = ? LIMIT 1', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  } finally {
    conn.release();
  }
});

export default router;

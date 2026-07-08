import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT id, name, slug, minAge, maxAge, color, sortOrder, active, createdAt
       FROM age_groups
       ORDER BY sortOrder ASC, minAge ASC, id ASC`,
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_age_groups_failed' });
  } finally {
    conn.release();
  }
});

router.post('/', async (req, res) => {
  const { name, slug, minAge, maxAge, color, sortOrder, active } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });

  const finalSlug = slug ? slugify(String(slug)) : slugify(String(name));
  if (!finalSlug) return res.status(400).json({ error: 'invalid_slug' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      `INSERT INTO age_groups (name, slug, minAge, maxAge, color, sortOrder, active, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        String(name).trim(),
        finalSlug,
        minAge != null && minAge !== '' ? Number(minAge) : null,
        maxAge != null && maxAge !== '' ? Number(maxAge) : null,
        color || '#4ECDC4',
        Number(sortOrder ?? 0),
        active !== false ? 1 : 0,
      ],
    );
    res.status(201).json({ id: r.insertId, slug: finalSlug });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    res.status(500).json({ error: 'create_age_group_failed' });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, minAge, maxAge, color, sortOrder, active } = req.body;
  if (!name) return res.status(400).json({ error: 'name_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query(
      'SELECT id, slug FROM age_groups WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing[0]) return res.status(404).json({ error: 'not_found' });

    const finalSlug = slug ? slugify(String(slug)) : existing[0].slug;
    await conn.query(
      `UPDATE age_groups
       SET name = ?, slug = ?, minAge = ?, maxAge = ?, color = ?, sortOrder = ?, active = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        finalSlug,
        minAge != null && minAge !== '' ? Number(minAge) : null,
        maxAge != null && maxAge !== '' ? Number(maxAge) : null,
        color || '#4ECDC4',
        Number(sortOrder ?? 0),
        active !== false ? 1 : 0,
        id,
      ],
    );

    // Keep magazines.category in sync when slug changes
    if (finalSlug !== existing[0].slug) {
      await conn.query('UPDATE magazines SET category = ? WHERE age_group_id = ?', [finalSlug, id]);
    }

    res.json({ ok: true, slug: finalSlug });
  } catch (e: any) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    res.status(500).json({ error: 'update_age_group_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [used]: any = await conn.query(
      'SELECT COUNT(*) AS cnt FROM magazines WHERE age_group_id = ?',
      [id],
    );
    if (Number(used[0]?.cnt) > 0) {
      return res.status(400).json({
        error: 'age_group_in_use',
        message: 'Cannot delete: magazines are assigned to this age group.',
      });
    }
    const [r]: any = await conn.query('DELETE FROM age_groups WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_age_group_failed' });
  } finally {
    conn.release();
  }
});

export default router;

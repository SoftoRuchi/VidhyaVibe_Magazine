import { Router } from 'express';
import { getPool } from '../db';

const router = Router();

// Public endpoint to list all active magazines with optional category filtering
router.get('/', async (req, res) => {
  const { category } = req.query;
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    let query = `SELECT m.id, m.title, m.slug, m.publisher, m.description, m.category, m.active, m.coverKey, m.createdAt,
        (SELECT me.id FROM magazine_editions me
         WHERE me.magazineId = m.id
           AND me.publishedAt IS NOT NULL
           AND me.publishedAt <= NOW()
           AND me.sampleKey IS NOT NULL
         ORDER BY me.publishedAt DESC, me.id DESC
         LIMIT 1) AS sampleEditionId
       FROM magazines m WHERE m.active = 1`;
    const params: any[] = [];

    if (category) {
      query += ' AND m.category = ?';
      params.push(category);
    }

    query += ' ORDER BY m.createdAt DESC';

    const [rows]: any = await conn.query(query, params);
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed', details: e.message });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// Public endpoint to list editions for a magazine (by id or slug)
router.get('/:identifier/editions', async (req, res) => {
  const identifier = req.params.identifier;
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    const isNumeric = /^\d+$/.test(identifier);
    const [magRows]: any = await conn.query(
      isNumeric
        ? 'SELECT id FROM magazines WHERE id = ? AND active = 1 LIMIT 1'
        : 'SELECT id FROM magazines WHERE slug = ? AND active = 1 LIMIT 1',
      [identifier],
    );
    const mag = magRows[0];
    if (!mag) return res.status(404).json({ error: 'magazine_not_found' });

    const [rows]: any = await conn.query(
      `SELECT id, magazineId, volume, issueNumber, sku, description, publishedAt, pages, coverKey, sampleKey, createdAt
             FROM magazine_editions
             WHERE magazineId = ? AND publishedAt IS NOT NULL AND publishedAt <= NOW()
             ORDER BY publishedAt DESC`,
      [mag.id],
    );
    const baseUrl = process.env.API_BASE_URL || '';
    const assetPath = (key: string) =>
      baseUrl
        ? `${baseUrl}/api/assets/serve?key=${encodeURIComponent(key)}`
        : `/api/assets/serve?key=${encodeURIComponent(key)}`;
    const editions = rows.map((ed: any) => ({
      ...ed,
      coverUrl: ed.coverKey ? assetPath(ed.coverKey) : null,
      hasSample: !!ed.sampleKey,
      sampleUrl: ed.sampleKey ? `/api/editions/${ed.id}/sample` : null,
    }));
    res.json(editions);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_editions_failed' });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// Public endpoint to get a single magazine by slug or ID
router.get('/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    // Try to parse as ID first, otherwise treat as slug
    const isNumeric = /^\d+$/.test(identifier);
    const query = isNumeric
      ? 'SELECT id, title, slug, publisher, description, category, active, coverKey FROM magazines WHERE id = ? LIMIT 1'
      : 'SELECT id, title, slug, publisher, description, category, active, coverKey FROM magazines WHERE slug = ? LIMIT 1';

    const [rows]: any = await conn.query(query, [identifier]);
    const magazine = rows[0];

    if (!magazine) {
      return res.status(404).json({ error: 'magazine_not_found' });
    }

    res.json(magazine);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'get_failed' });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

export default router;

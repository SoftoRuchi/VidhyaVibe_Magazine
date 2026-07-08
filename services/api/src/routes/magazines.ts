import { Router } from 'express';
import { getCached, setCached } from '../catalogCache';
import { query } from '../db';

const router = Router();

const MAGAZINES_BASE_SQL = `SELECT m.id, m.title, m.slug, m.publisher, m.description, m.category, m.active, m.coverKey, m.createdAt,
  m.age_group_id AS ageGroupId,
  ag.name AS ageGroupName, ag.slug AS ageGroupSlug, ag.color AS ageGroupColor,
  latest.id AS sampleEditionId
FROM magazines m
LEFT JOIN age_groups ag ON ag.id = m.age_group_id
LEFT JOIN (
  SELECT me.magazineId, me.id,
    ROW_NUMBER() OVER (PARTITION BY me.magazineId ORDER BY me.publishedAt DESC, me.id DESC) AS rn
  FROM magazine_editions me
  WHERE me.publishedAt IS NOT NULL AND me.publishedAt <= NOW() AND me.sampleKey IS NOT NULL
) latest ON latest.magazineId = m.id AND latest.rn = 1
WHERE m.active = 1`;

// Public endpoint to list all active magazines with optional category filtering
router.get('/', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const cacheKey = `magazines:list:${category || 'all'}`;

  try {
    const cached = await getCached<unknown[]>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let sql = `${MAGAZINES_BASE_SQL}`;
    const params: unknown[] = [];
    if (category) {
      sql += ' AND (m.category = ? OR ag.slug = ?)';
      params.push(category, category);
    }
    sql += ' ORDER BY m.createdAt DESC';

    const [rows] = await query(sql, params);
    await setCached(cacheKey, rows, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(rows);
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'list_failed';
    res.status(500).json({ error: 'list_failed', details: message });
  }
});

// Public endpoint to list editions for a magazine (by id or slug)
router.get('/:identifier/editions', async (req, res) => {
  const identifier = req.params.identifier;
  const cacheKey = `magazines:editions:${identifier}`;

  try {
    const cached = await getCached<unknown[]>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const isNumeric = /^\d+$/.test(identifier);
    const [magRows]: any = await query(
      isNumeric
        ? 'SELECT id FROM magazines WHERE id = ? AND active = 1 LIMIT 1'
        : 'SELECT id FROM magazines WHERE slug = ? AND active = 1 LIMIT 1',
      [identifier],
    );
    const mag = magRows[0];
    if (!mag) return res.status(404).json({ error: 'magazine_not_found' });

    const [rows]: any = await query(
      `SELECT id, magazineId, volume, issueNumber, sku, description, publishedAt, pages, coverKey, sampleKey, createdAt
       FROM magazine_editions
       WHERE magazineId = ? AND publishedAt IS NOT NULL AND publishedAt <= NOW()
       ORDER BY publishedAt DESC`,
      [mag.id],
    );
    const assetPath = (key: string) => `/api/assets/serve?key=${encodeURIComponent(key)}`;
    const editions = rows.map((ed: Record<string, unknown>) => ({
      ...ed,
      coverUrl: ed.coverKey ? assetPath(String(ed.coverKey)) : null,
      hasSample: !!ed.sampleKey,
      sampleUrl: ed.sampleKey ? `/api/editions/${ed.id}/sample` : null,
    }));
    await setCached(cacheKey, editions, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(editions);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'list_editions_failed' });
  }
});

// Public endpoint to get a single magazine by slug or ID
router.get('/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  const cacheKey = `magazines:one:${identifier}`;

  try {
    const cached = await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const isNumeric = /^\d+$/.test(identifier);
    const sql = isNumeric
      ? 'SELECT id, title, slug, publisher, description, category, active, coverKey FROM magazines WHERE id = ? LIMIT 1'
      : 'SELECT id, title, slug, publisher, description, category, active, coverKey FROM magazines WHERE slug = ? LIMIT 1';

    const [rows]: any = await query(sql, [identifier]);
    const magazine = rows[0];
    if (!magazine) return res.status(404).json({ error: 'magazine_not_found' });

    await setCached(cacheKey, magazine, 120);
    res.setHeader('X-Cache', 'MISS');
    res.json(magazine);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'get_failed' });
  }
});

export default router;

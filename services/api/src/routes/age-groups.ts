import { Router } from 'express';
import { getCached, setCached } from '../catalogCache';
import { query } from '../db';

const router = Router();

router.get('/', async (_req, res) => {
  const cacheKey = 'age-groups:active';
  try {
    const cached = await getCached<unknown[]>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const [rows] = await query(
      `SELECT id, name, slug, minAge, maxAge, color, sortOrder
       FROM age_groups
       WHERE active = 1
       ORDER BY sortOrder ASC, minAge ASC, id ASC`,
    );
    await setCached(cacheKey, rows, 300);
    res.setHeader('X-Cache', 'MISS');
    res.json(rows);
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'list_failed';
    res.status(500).json({ error: 'list_age_groups_failed', details: message });
  }
});

export default router;

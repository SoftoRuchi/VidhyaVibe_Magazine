import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import { getStorageAdapter } from '../../providers/storage';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get('/list', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT id, title, slug, coverKey, createdAt FROM magazines ORDER BY createdAt DESC',
    );
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.post('/', upload.single('cover'), async (req, res) => {
  const { title, slug, publisher, description, category } = req.body;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    let coverKey: string | null = null;
    if (req.file) {
      const storage = getStorageAdapter();
      const ext = (req.file.originalname || 'jpg').split('.').pop() || 'jpg';
      const key = `magazines/${slug}/cover-${uuidv4()}.${ext}`;
      const uploaded = await storage.upload(key, req.file.buffer, req.file.mimetype);
      coverKey = uploaded.key;
    }

    const [r]: any = await conn.query(
      'INSERT INTO magazines (title, slug, publisher, description, category, coverKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [title, slug, publisher || null, description || null, category || null, coverKey],
    );
    res.status(201).json({ id: r.insertId, coverKey });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  } finally {
    conn.release();
  }
});

// GET /api/admin/magazines/:id/editions - list editions with file URLs for admin
router.get('/:id/editions', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [magRows]: any = await conn.query(
      'SELECT id, coverKey FROM magazines WHERE id = ? LIMIT 1',
      [id],
    );
    if (!magRows[0]) return res.status(404).json({ error: 'magazine_not_found' });
    const magCoverKey = magRows[0].coverKey;

    const [rows]: any = await conn.query(
      'SELECT id, magazineId, volume, issueNumber, sku, description, publishedAt, pages, coverKey, fileKey, sampleKey, createdAt FROM magazine_editions WHERE magazineId = ? ORDER BY createdAt DESC',
      [id],
    );
    // Relative URLs only — admin/web clients use their own origin + /api proxy (avoid localhost from API_BASE_URL).
    const assetPath = (key: string) => `/api/assets/serve?key=${encodeURIComponent(key)}`;
    const editions = rows.map((ed: any) => ({
      ...ed,
      fileUrl: ed.fileKey ? assetPath(ed.fileKey) : null,
      sampleUrl: ed.sampleKey ? assetPath(ed.sampleKey) : null,
      coverUrl: ed.coverKey || magCoverKey ? assetPath(ed.coverKey || magCoverKey) : null,
    }));
    res.json(editions);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_editions_failed' });
  } finally {
    conn.release();
  }
});

// GET /api/admin/magazines/:id/plans - list plans with magazine-specific pricing per delivery mode
router.get('/:id/plans', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [magRows]: any = await conn.query('SELECT id FROM magazines WHERE id = ? LIMIT 1', [id]);
    if (!magRows[0]) return res.status(404).json({ error: 'magazine_not_found' });
    const [rows]: any = await conn.query(
      `SELECT sp.id as planId, sp.name, sp.slug, sp.price as defaultPrice, sp.currency as defaultCurrency
       FROM subscription_plans sp WHERE sp.active = 1`,
    );
    const [mpRows]: any = await conn.query(
      `SELECT plan_id, delivery_mode, price, currency, active
       FROM magazine_plans WHERE magazine_id = ?`,
      [id],
    );
    const mpMap: Record<string, { price: number; currency: string }> = {};
    for (const mp of mpRows) {
      mpMap[`${mp.plan_id}:${mp.delivery_mode}`] = {
        price: mp.price,
        currency: mp.currency || 'INR',
      };
    }
    const defC = (r: any) => r.defaultCurrency || 'INR';
    res.json(
      rows.map((r: any) => ({
        planId: r.planId,
        name: r.name,
        slug: r.slug,
        defaultPrice: r.defaultPrice,
        defaultCurrency: defC(r),
        prices: {
          ELECTRONIC: {
            price: mpMap[`${r.planId}:ELECTRONIC`]?.price ?? r.defaultPrice,
            currency: mpMap[`${r.planId}:ELECTRONIC`]?.currency ?? defC(r),
            hasOverride: !!mpMap[`${r.planId}:ELECTRONIC`],
          },
          PHYSICAL: {
            price: mpMap[`${r.planId}:PHYSICAL`]?.price ?? r.defaultPrice,
            currency: mpMap[`${r.planId}:PHYSICAL`]?.currency ?? defC(r),
            hasOverride: !!mpMap[`${r.planId}:PHYSICAL`],
          },
          BOTH: {
            price: mpMap[`${r.planId}:BOTH`]?.price ?? r.defaultPrice,
            currency: mpMap[`${r.planId}:BOTH`]?.currency ?? defC(r),
            hasOverride: !!mpMap[`${r.planId}:BOTH`],
          },
        },
        price: mpMap[`${r.planId}:BOTH`]?.price ?? r.defaultPrice,
        currency: mpMap[`${r.planId}:BOTH`]?.currency ?? defC(r),
        hasOverride: !!mpMap[`${r.planId}:BOTH`],
      })),
    );
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_plans_failed' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/magazines/:id/plans - set pricing for this magazine (per delivery mode)
router.put('/:id/plans', async (req, res) => {
  const id = Number(req.params.id);
  const { planPrices } = req.body; // [{ planId, deliveryMode, price, currency? }]
  if (!Array.isArray(planPrices))
    return res.status(400).json({ error: 'planPrices_array_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [magRows]: any = await conn.query('SELECT id FROM magazines WHERE id = ? LIMIT 1', [id]);
    if (!magRows[0]) return res.status(404).json({ error: 'magazine_not_found' });
    for (const item of planPrices) {
      const { planId, deliveryMode, price, priceCents, currency } = item;
      const p = price != null ? price : priceCents;
      if (!planId || p == null) continue;
      const mode = ['ELECTRONIC', 'PHYSICAL', 'BOTH'].includes(deliveryMode)
        ? deliveryMode
        : 'BOTH';
      await conn.query(
        `INSERT INTO magazine_plans (magazine_id, plan_id, delivery_mode, price, currency, active) VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE price = VALUES(price), currency = VALUES(currency), active = 1`,
        [id, planId, mode, Number(p), currency || 'INR'],
      );
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_plans_failed' });
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
      'SELECT id, title, slug, publisher, description, category, coverKey FROM magazines WHERE id = ? LIMIT 1',
      [id],
    );
    const mag = rows[0];
    if (!mag) return res.status(404).json({ error: 'not_found' });
    res.json(mag);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'get_failed' });
  } finally {
    conn.release();
  }
});

router.put('/:id', upload.single('cover'), async (req, res) => {
  const id = Number(req.params.id);
  const { title, slug, publisher, description, category } = req.body;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // Check if exists
    const [existing]: any = await conn.query('SELECT coverKey FROM magazines WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'not_found' });

    let coverKey = existing[0].coverKey;
    if (req.file) {
      const storage = getStorageAdapter();
      const ext = (req.file.originalname || 'jpg').split('.').pop() || 'jpg';
      const key = `magazines/${slug}/cover-${uuidv4()}.${ext}`;
      const uploaded = await storage.upload(key, req.file.buffer, req.file.mimetype);
      coverKey = uploaded.key;
    }

    await conn.query(
      'UPDATE magazines SET title = ?, slug = ?, publisher = ?, description = ?, category = ?, coverKey = ? WHERE id = ?',
      [title, slug, publisher || null, description || null, category || null, coverKey, id],
    );
    res.json({ id, coverKey });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  } finally {
    conn.release();
  }
});

export default router;

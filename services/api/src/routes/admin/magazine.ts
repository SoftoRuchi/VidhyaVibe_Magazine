import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { invalidateMagazineCatalog } from '../../catalogCache';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import type { AuthRequest } from '../../middleware/auth';
import { requireAuth } from '../../middleware/auth';
import { memoryUpload } from '../../middleware/upload';
import { getStorageAdapter } from '../../providers/storage';
import { createAdminEdition, updateAdminEdition } from '../../services/adminEditions';

const upload = memoryUpload;
const router = Router();

// simple admin guard - require auth + admin role
router.use(requireAuth);
router.use(requireAdmin);

// Replace / upload sample PDF for an existing edition (admin)
router.post(
  '/:magazineId/editions/:editionId/sample',
  upload.single('samplePdf'),
  async (req: AuthRequest, res) => {
    const magazineId = Number(req.params.magazineId);
    const editionId = Number(req.params.editionId);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'sample_pdf_required' });
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [mRows]: any = await conn.query('SELECT slug FROM magazines WHERE id = ? LIMIT 1', [
        magazineId,
      ]);
      if (!mRows[0]) return res.status(404).json({ error: 'magazine_not_found' });
      const [eRows]: any = await conn.query(
        'SELECT id FROM magazine_editions WHERE id = ? AND magazineId = ? LIMIT 1',
        [editionId, magazineId],
      );
      if (!eRows[0]) return res.status(404).json({ error: 'edition_not_found' });

      const storage = getStorageAdapter();
      const mag = mRows[0];
      const sampleKeyPath = `magazines/${mag.slug}/editions/${uuidv4()}-sample.pdf`;
      const uploaded = await storage.upload(sampleKeyPath, file.buffer as Buffer, file.mimetype);

      await conn.query(
        'UPDATE magazine_editions SET sampleKey = ? WHERE id = ? AND magazineId = ?',
        [uploaded.key, editionId, magazineId],
      );
      res.json({ ok: true, sampleKey: uploaded.key });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'sample_upload_failed', details: e.message });
    } finally {
      conn.release();
    }
  },
);

const editionUpload = upload.fields([
  { name: 'editionPdf', maxCount: 1 },
  { name: 'samplePdf', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

// Update edition metadata and optionally replace PDFs / cover (admin)
router.put('/:magazineId/editions/:editionId', editionUpload, updateAdminEdition);

// Upload new edition with metadata
router.post('/:magazineId/editions', editionUpload, createAdminEdition);

// Attach video to a page number (upload file or provide URL)
router.post('/:editionId/videos', upload.single('videoFile'), async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const editionId = Number(req.params.editionId);
  const { pageNumber, url } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!pageNumber) return res.status(400).json({ error: 'pageNumber_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const storage = getStorageAdapter();
    let finalUrl = url || null;
    if (req.file) {
      const key = `editions/${editionId}/videos/${uuidv4()}-${req.file.originalname}`;
      const uploaded = await storage.upload(key, req.file.buffer, req.file.mimetype);
      finalUrl = uploaded.url;
    }
    if (!finalUrl) return res.status(400).json({ error: 'video_file_or_url_required' });
    const [r]: any = await conn.query(
      'INSERT INTO edition_videos (editionId, pageNumber, url, public, createdAt) VALUES (?, ?, ?, ?, NOW())',
      [editionId, Number(pageNumber), finalUrl, 1],
    );
    res.status(201).json({ id: r.insertId, url: finalUrl });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'attach_video_failed' });
  } finally {
    conn.release();
  }
});

// Publish control: set publishedAt or unset
router.post('/editions/:id/publish', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const id = Number(req.params.id);
  const { publish } = req.body; // true/false
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT magazineId FROM magazine_editions WHERE id = ? LIMIT 1',
      [id],
    );
    const edition = rows[0];
    if (!edition) return res.status(404).json({ error: 'edition_not_found' });

    const [magRows]: any = await conn.query('SELECT slug FROM magazines WHERE id = ? LIMIT 1', [
      edition.magazineId,
    ]);
    const mag = magRows[0];

    if (publish) {
      await conn.query('UPDATE magazine_editions SET publishedAt = NOW() WHERE id = ?', [id]);
    } else {
      await conn.query('UPDATE magazine_editions SET publishedAt = NULL WHERE id = ?', [id]);
    }
    if (mag) {
      await invalidateMagazineCatalog(edition.magazineId, mag.slug);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'publish_failed' });
  } finally {
    conn.release();
  }
});

export default router;

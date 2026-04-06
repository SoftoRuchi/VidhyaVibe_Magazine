import type { Request, Response } from 'express';
import { Router } from 'express';
import { getPool } from '../db';
import { requireEditionAccess } from '../middleware/editionAccess';
import { getStorageAdapter } from '../providers/storage';

const router = Router();

// Get edition info (public)
router.get('/:editionId/info', async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT me.id, me.magazineId, me.volume, me.issueNumber, me.description, me.publishedAt, me.pages, me.coverKey, me.sampleKey, m.title as magazineTitle, m.coverKey as magazineCoverKey
       FROM magazine_editions me
       JOIN magazines m ON m.id = me.magazineId
       WHERE me.id = ? AND me.publishedAt IS NOT NULL LIMIT 1`,
      [editionId],
    );
    const ed = rows[0];
    if (!ed) return res.status(404).json({ error: 'edition_not_found' });
    res.json({
      ...ed,
      hasSample: !!ed.sampleKey,
      sampleUrl: ed.sampleKey ? `/api/editions/${editionId}/sample` : null,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  } finally {
    conn.release();
  }
});

// Reader metadata for sample (PUBLIC) — same shape as /pages but points at sample PDF for flipbook
router.get('/:editionId/sample/pages', async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT sampleKey FROM magazine_editions WHERE id = ? AND publishedAt IS NOT NULL LIMIT 1',
      [editionId],
    );
    const ed = rows[0];
    if (!ed) return res.status(404).json({ error: 'edition_not_found' });
    if (!ed.sampleKey) return res.status(404).json({ error: 'no_sample_available' });
    res.json({
      pages: 1,
      list: [],
      pdfUrl: `/api/editions/${editionId}/sample`,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

// Stream sample PDF for an edition (PUBLIC - no auth required)
router.get('/:editionId/sample', async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT sampleKey FROM magazine_editions WHERE id = ? AND publishedAt IS NOT NULL LIMIT 1',
      [editionId],
    );
    const ed = rows[0];
    conn.release();
    if (!ed) return res.status(404).json({ error: 'edition_not_found' });
    if (!ed.sampleKey) return res.status(404).json({ error: 'no_sample_available' });

    const storage = getStorageAdapter();
    if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });
    const data: any = await storage.get(ed.sampleKey);
    if (!data) return res.status(404).json({ error: 'sample_not_found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="sample.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (Buffer.isBuffer(data)) return res.send(data);
    data.on('error', (err: any) => {
      console.error(err);
      res.status(500).end();
    });
    data.pipe(res);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed', message: e.message });
  }
});

// List pages for an edition (requires access)
router.get('/:editionId/pages', requireEditionAccess, async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT pages, fileKey FROM magazine_editions WHERE id = ? LIMIT 1',
      [editionId],
    );
    const ed = rows[0];
    if (!ed) return res.status(404).json({ error: 'edition_not_found' });
    const pages = Number(ed.pages) || 1;
    // build page list
    const list = [];
    for (let i = 1; i <= pages; i++) {
      list.push({ pageNumber: i, url: `/api/editions/${editionId}/pages/${i}` });
    }
    // Include pdfUrl when fileKey exists - page images may not exist (PDF stored but not extracted to JPGs)
    const pdfUrl = ed.fileKey ? `/api/editions/${editionId}/pdf` : null;
    res.json({ pages, list, pdfUrl });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

// Stream PDF for an edition (requires access) - fallback when page images don't exist
router.get('/:editionId/pdf', requireEditionAccess, async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT fileKey FROM magazine_editions WHERE id = ? LIMIT 1',
      [editionId],
    );
    const ed = rows[0];
    conn.release();
    if (!ed || !ed.fileKey) return res.status(404).json({ error: 'pdf_not_found' });

    const storage = getStorageAdapter();
    if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });
    const data: any = await storage.get(ed.fileKey);
    if (!data) return res.status(404).json({ error: 'pdf_not_found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="edition.pdf"');
    if (Buffer.isBuffer(data)) {
      return res.send(data);
    }
    data.on('error', (err: any) => {
      console.error(err);
      res.status(500).end();
    });
    data.pipe(res);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed', message: e.message });
  }
});

// Proxy page image (requires access)
router.get(
  '/:editionId/pages/:pageNumber',
  requireEditionAccess,
  async (req: Request, res: Response) => {
    const editionId = Number(req.params.editionId);
    const pageNumber = Number(req.params.pageNumber);
    const low = req.query.lowBandwidth === '1' || req.query.lowBandwidth === 'true';
    try {
      const storage = getStorageAdapter();
      // Build key convention: editions/{editionId}/pages/{pageNumber}.jpg
      // low bandwidth: editions/{editionId}/pages/low/{pageNumber}.jpg
      const key = low
        ? `editions/${editionId}/pages/low/${pageNumber}.jpg`
        : `editions/${editionId}/pages/${pageNumber}.jpg`;
      // storage.get may return Buffer or stream
      if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });
      const data: any = await storage.get(key);
      if (!data) return res.status(404).json({ error: 'page_not_found' });
      // handle Buffer
      if (Buffer.isBuffer(data)) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(data);
      }
      // assume stream
      data.on('error', (err: any) => {
        console.error(err);
        res.status(500).end();
      });
      res.setHeader('Content-Type', 'image/jpeg');
      data.pipe(res);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'fetch_failed', message: e.message });
    }
  },
);

// list videos for an edition optionally filtered by page (requires access)
router.get('/:editionId/videos', requireEditionAccess, async (req: Request, res: Response) => {
  const editionId = Number(req.params.editionId);
  const page = req.query.page ? Number(req.query.page) : null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const params: any[] = [editionId];
    let sql =
      'SELECT id, pageNumber, url, public, createdAt FROM edition_videos WHERE editionId = ?';
    if (page) {
      sql += ' AND page_number = ?';
      params.push(page);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows]: any = await conn.query(sql, params);
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_videos_failed' });
  } finally {
    conn.release();
  }
});

export default router;

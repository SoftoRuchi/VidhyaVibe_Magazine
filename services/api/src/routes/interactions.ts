import { Router } from 'express';
import { getPool } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/** GET /api/interactions/bookmarks?editionId=&readerId= */
router.get('/bookmarks', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const editionId = req.query.editionId != null ? Number(req.query.editionId) : null;
  const readerId = req.query.readerId != null ? Number(req.query.readerId) : null;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (editionId != null && !Number.isFinite(editionId)) {
    return res.status(400).json({ error: 'invalid_editionId' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const where = ['r.userId = ?'];
    const params: any[] = [userId];
    if (readerId) {
      where.push('b.readerId = ?');
      params.push(readerId);
    }
    if (editionId) {
      where.push('b.editionId = ?');
      params.push(editionId);
    }
    const [rows]: any = await conn.query(
      `SELECT b.id, b.readerId, b.editionId, b.pageNumber, b.createdAt
       FROM bookmarks b
       JOIN readers r ON r.id = b.readerId
       WHERE ${where.join(' AND ')}
       ORDER BY b.createdAt DESC, b.id DESC`,
      params,
    );
    res.json({
      items: (rows || []).map((r: any) => ({
        id: Number(r.id),
        readerId: Number(r.readerId),
        editionId: Number(r.editionId),
        pageNumber: r.pageNumber != null ? Number(r.pageNumber) : null,
        createdAt: r.createdAt,
      })),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_bookmarks_failed' });
  } finally {
    conn.release();
  }
});

// Bookmarks
router.post('/bookmarks', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { readerId, editionId, pageNumber } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!readerId || !editionId)
    return res.status(400).json({ error: 'readerId_and_editionId_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // ensure reader belongs to user
    const [rRows]: any = await conn.query(
      'SELECT id FROM readers WHERE id = ? AND userId = ? LIMIT 1',
      [readerId, userId],
    );
    if (!rRows[0]) return res.status(403).json({ error: 'forbidden' });
    const page = pageNumber != null ? Number(pageNumber) : null;
    if (page != null && Number.isFinite(page)) {
      const [existing]: any = await conn.query(
        'SELECT id FROM bookmarks WHERE readerId = ? AND editionId = ? AND pageNumber = ? LIMIT 1',
        [readerId, editionId, page],
      );
      if (existing[0]) {
        return res.json({ id: Number(existing[0].id), existing: true });
      }
    }
    const [ins]: any = await conn.query(
      'INSERT INTO bookmarks (readerId, editionId, pageNumber, createdAt) VALUES (?, ?, ?, NOW())',
      [readerId, editionId, page],
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_bookmark_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/bookmarks/:id', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // ensure bookmark belongs to user's reader
    const [rows]: any = await conn.query(
      'SELECT b.id FROM bookmarks b JOIN readers r ON b.readerId = r.id WHERE b.id = ? AND r.userId = ? LIMIT 1',
      [id, userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    await conn.query('DELETE FROM bookmarks WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_bookmark_failed' });
  } finally {
    conn.release();
  }
});

// Highlights
router.post('/highlights', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { readerId, editionId, pageNumber, text, color } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!readerId || !editionId || !text)
    return res.status(400).json({ error: 'readerId_editionId_text_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rRows]: any = await conn.query(
      'SELECT id FROM readers WHERE id = ? AND userId = ? LIMIT 1',
      [readerId, userId],
    );
    if (!rRows[0]) return res.status(403).json({ error: 'forbidden' });
    const [ins]: any = await conn.query(
      'INSERT INTO highlights (readerId, editionId, pageNumber, text, color, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [readerId, editionId, pageNumber || null, text, color || null],
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_highlight_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/highlights/:id', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT h.id FROM highlights h JOIN readers r ON h.readerId = r.id WHERE h.id = ? AND r.userId = ? LIMIT 1',
      [id, userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    await conn.query('DELETE FROM highlights WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_highlight_failed' });
  } finally {
    conn.release();
  }
});

// Notes
router.post('/notes', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { readerId, editionId, pageNumber, content } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!readerId || !editionId || !content)
    return res.status(400).json({ error: 'readerId_editionId_content_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rRows]: any = await conn.query(
      'SELECT id FROM readers WHERE id = ? AND userId = ? LIMIT 1',
      [readerId, userId],
    );
    if (!rRows[0]) return res.status(403).json({ error: 'forbidden' });
    const [ins]: any = await conn.query(
      'INSERT INTO notes (readerId, editionId, pageNumber, content, createdAt) VALUES (?, ?, ?, ?, NOW())',
      [readerId, editionId, pageNumber || null, content],
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_note_failed' });
  } finally {
    conn.release();
  }
});

router.put('/notes/:id', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const id = Number(req.params.id);
  const { content } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!content) return res.status(400).json({ error: 'content_required' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT n.id FROM notes n JOIN readers r ON n.readerId = r.id WHERE n.id = ? AND r.userId = ? LIMIT 1',
      [id, userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    await conn.query('UPDATE notes SET content = ?, createdAt = NOW() WHERE id = ?', [content, id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_note_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/notes/:id', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT n.id FROM notes n JOIN readers r ON n.readerId = r.id WHERE n.id = ? AND r.userId = ? LIMIT 1',
      [id, userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    await conn.query('DELETE FROM notes WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_note_failed' });
  } finally {
    conn.release();
  }
});

export default router;

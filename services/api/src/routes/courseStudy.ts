import { Router } from 'express';
import { query } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { flashcardsFromChapterHtml } from '../utils/courseFlashcards';
import { asDoc, flashcardsFromDoc } from '../utils/textbookContent';

const router = Router();

function n(v: unknown): number {
  return Number(v);
}

async function chapterExists(id: number): Promise<boolean> {
  const [rows]: any = await query('SELECT id FROM course_chapters WHERE id = ? LIMIT 1', [id]);
  return !!rows?.[0];
}

function markType(v: unknown): 'important' | 'doubt' | 'revise' {
  const s = String(v || '').toLowerCase();
  if (s === 'doubt' || s === 'revise') return s;
  return 'important';
}

function mapBookmark(r: any) {
  return {
    id: n(r.id),
    chapterId: n(r.chapterId),
    pageNumber: n(r.pageNumber),
    markType: markType(r.markType),
    createdAt: r.createdAt,
  };
}

function mapNote(r: any) {
  return {
    id: n(r.id),
    chapterId: n(r.chapterId),
    pageNumber: r.pageNumber != null ? n(r.pageNumber) : null,
    content: r.content,
    quote: r.quote ? String(r.quote) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapHighlight(r: any) {
  return {
    id: n(r.id),
    chapterId: n(r.chapterId),
    pageNumber: r.pageNumber != null ? n(r.pageNumber) : null,
    text: r.text,
    color: r.color || '#FFE66D',
    createdAt: r.createdAt,
  };
}

/** GET /api/courses/chapters/:id/study */
router.get('/chapters/:id/study', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  if (!chapterId) return res.status(400).json({ error: 'invalid_id' });
  try {
    if (!(await chapterExists(chapterId))) return res.status(404).json({ error: 'not_found' });
    const [bookmarks]: any = await query(
      `SELECT id, chapter_id AS chapterId, page_number AS pageNumber, mark_type AS markType, created_at AS createdAt
       FROM course_bookmarks WHERE user_id = ? AND chapter_id = ? ORDER BY page_number ASC`,
      [userId, chapterId],
    );
    const [notes]: any = await query(
      `SELECT id, chapter_id AS chapterId, page_number AS pageNumber, content, quote,
              created_at AS createdAt, updated_at AS updatedAt
       FROM course_notes WHERE user_id = ? AND chapter_id = ? ORDER BY updated_at DESC`,
      [userId, chapterId],
    );
    const [highlights]: any = await query(
      `SELECT id, chapter_id AS chapterId, page_number AS pageNumber, text, color, created_at AS createdAt
       FROM course_highlights WHERE user_id = ? AND chapter_id = ? ORDER BY created_at DESC`,
      [userId, chapterId],
    );
    res.json({
      bookmarks: (bookmarks || []).map(mapBookmark),
      notes: (notes || []).map(mapNote),
      highlights: (highlights || []).map(mapHighlight),
    });
  } catch (e: any) {
    console.error('[courses] study list failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** POST /api/courses/chapters/:id/bookmarks { pageNumber, markType } */
router.post('/chapters/:id/bookmarks', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  const pageNumber = n(req.body?.pageNumber);
  const type = markType(req.body?.markType);
  if (!chapterId || !pageNumber) return res.status(400).json({ error: 'pageNumber_required' });
  try {
    if (!(await chapterExists(chapterId))) return res.status(404).json({ error: 'not_found' });
    await query(
      `INSERT INTO course_bookmarks (user_id, chapter_id, page_number, mark_type, created_at)
       VALUES (?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE mark_type = VALUES(mark_type)`,
      [userId, chapterId, pageNumber, type],
    );
    const [rows]: any = await query(
      `SELECT id, chapter_id AS chapterId, page_number AS pageNumber, mark_type AS markType, created_at AS createdAt
       FROM course_bookmarks WHERE user_id = ? AND chapter_id = ? AND page_number = ? LIMIT 1`,
      [userId, chapterId, pageNumber],
    );
    res.status(201).json(mapBookmark(rows[0]));
  } catch (e: any) {
    console.error('[courses] bookmark failed', e);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.delete('/bookmarks/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const userId = n(req.user?.id);
  try {
    const [rows]: any = await query('DELETE FROM course_bookmarks WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    if (!rows?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** POST /api/courses/chapters/:id/notes { pageNumber, content, quote } */
router.post('/chapters/:id/notes', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  const content = String(req.body?.content || '').trim();
  const quote =
    String(req.body?.quote || '')
      .trim()
      .slice(0, 1000) || null;
  const pageNumber = req.body?.pageNumber != null ? n(req.body.pageNumber) : null;
  if (!chapterId || !content) return res.status(400).json({ error: 'content_required' });
  try {
    if (!(await chapterExists(chapterId))) return res.status(404).json({ error: 'not_found' });
    const [ins]: any = await query(
      `INSERT INTO course_notes (user_id, chapter_id, page_number, content, quote, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [userId, chapterId, pageNumber, content, quote],
    );
    res.status(201).json({
      id: n(ins.insertId),
      chapterId,
      pageNumber,
      content,
      quote,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.put('/notes/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const userId = n(req.user?.id);
  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'content_required' });
  try {
    const [rows]: any = await query(
      'UPDATE course_notes SET content = ?, updated_at = NOW(3) WHERE id = ? AND user_id = ?',
      [content, id, userId],
    );
    if (!rows?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

router.delete('/notes/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const userId = n(req.user?.id);
  try {
    const [rows]: any = await query('DELETE FROM course_notes WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    if (!rows?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** POST /api/courses/chapters/:id/highlights { pageNumber, text, color } */
router.post('/chapters/:id/highlights', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  const text = String(req.body?.text || '').trim();
  const color = String(req.body?.color || '#FFE66D').slice(0, 32);
  const pageNumber = req.body?.pageNumber != null ? n(req.body.pageNumber) : null;
  if (!chapterId || text.length < 2) return res.status(400).json({ error: 'text_required' });
  try {
    if (!(await chapterExists(chapterId))) return res.status(404).json({ error: 'not_found' });
    const [ins]: any = await query(
      `INSERT INTO course_highlights (user_id, chapter_id, page_number, text, color, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))`,
      [userId, chapterId, pageNumber, text.slice(0, 1000), color],
    );
    res.status(201).json({
      id: n(ins.insertId),
      chapterId,
      pageNumber,
      text: text.slice(0, 1000),
      color,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.delete('/highlights/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const userId = n(req.user?.id);
  try {
    const [rows]: any = await query('DELETE FROM course_highlights WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    if (!rows?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

function mapFlashcard(r: any, userId: number) {
  const owner = r.userId != null ? n(r.userId) : null;
  return {
    id: n(r.id),
    chapterId: n(r.chapterId),
    front: String(r.front || ''),
    back: String(r.back || ''),
    pageNumber: r.pageNumber != null ? n(r.pageNumber) : null,
    owned: owner === userId,
    createdAt: r.createdAt,
  };
}

/** GET /api/courses/chapters/:id/flashcards */
router.get('/chapters/:id/flashcards', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  if (!chapterId) return res.status(400).json({ error: 'invalid_id' });
  try {
    const [chapterRows]: any = await query(
      'SELECT id, title, content, content_json AS contentJson FROM course_chapters WHERE id = ? LIMIT 1',
      [chapterId],
    );
    if (!chapterRows?.[0]) return res.status(404).json({ error: 'not_found' });
    const row = chapterRows[0];
    const doc = asDoc(row.contentJson, {
      id: String(chapterId),
      title: row.title || 'Chapter',
      html: row.content || '',
    });
    const authored = flashcardsFromDoc(doc);
    const fromChapter = (
      authored.length ? authored : flashcardsFromChapterHtml(String(row.content || ''))
    ).map((card, i) => ({
      id: -(i + 1),
      chapterId,
      front: card.front,
      back: card.back,
      pageNumber: null,
      owned: false,
      source: 'chapter',
    }));
    const [rows]: any = await query(
      `SELECT id, chapter_id AS chapterId, user_id AS userId, front, back,
              page_number AS pageNumber, created_at AS createdAt
       FROM course_flashcards
       WHERE chapter_id = ? AND user_id = ?
       ORDER BY id DESC`,
      [chapterId, userId],
    );
    const mine = (rows || []).map((r: any) => ({ ...mapFlashcard(r, userId), source: 'mine' }));
    const seen = new Set(fromChapter.map((c) => c.front.toLowerCase()));
    const extra = mine.filter((c: { front: string }) => {
      const key = String(c.front || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json([...fromChapter, ...extra]);
  } catch (e: any) {
    console.error('[courses] flashcards list failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** POST /api/courses/chapters/:id/flashcards { front, back, pageNumber } */
router.post('/chapters/:id/flashcards', requireAuth, async (req: AuthRequest, res) => {
  const chapterId = n(req.params.id);
  const userId = n(req.user?.id);
  const front = String(req.body?.front || '')
    .trim()
    .slice(0, 500);
  const back = String(req.body?.back || '')
    .trim()
    .slice(0, 2000);
  const pageNumber = req.body?.pageNumber != null ? n(req.body.pageNumber) : null;
  if (!chapterId || front.length < 1 || back.length < 1) {
    return res.status(400).json({ error: 'front_and_back_required' });
  }
  try {
    if (!(await chapterExists(chapterId))) return res.status(404).json({ error: 'not_found' });
    const [ins]: any = await query(
      `INSERT INTO course_flashcards (chapter_id, user_id, front, back, page_number, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW(3), NOW(3))`,
      [chapterId, userId, front, back, pageNumber],
    );
    res.status(201).json({
      id: n(ins.insertId),
      chapterId,
      front,
      back,
      pageNumber,
      owned: true,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.delete('/flashcards/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const userId = n(req.user?.id);
  try {
    const [rows]: any = await query('DELETE FROM course_flashcards WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    if (!rows?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default router;

import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool, query } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import { memoryUpload } from '../../middleware/upload';
import { getStorageAdapter } from '../../providers/storage';
import {
  ensureBookAccessTables,
  parseBookPrice,
  parseDiscountPct,
} from '../../services/bookAccess';
import { publicFileUrlForKey } from '../../utils/courseAssets';
import { compareChapters, extractChapterNumber } from '../../utils/courseChapters';
import { slugify } from '../../utils/slugify';
import { asDoc, htmlToJson, jsonToHtml } from '../../utils/textbookContent';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const upload = memoryUpload;
const subjectUpload = runUpload(
  upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'frontCover', maxCount: 1 },
    { name: 'backCover', maxCount: 1 },
    { name: 'bookPdf', maxCount: 1 },
  ]),
);
const subjectCoverUpload = runUpload(
  upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'frontCover', maxCount: 1 },
    { name: 'backCover', maxCount: 1 },
  ]),
);
const imageUpload = runUpload(upload.single('image'));

function runUpload(mw: (req: AuthRequest, res: Response, cb: (err?: unknown) => void) => void) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    mw(req, res, (err?: unknown) => {
      if (!err) return next();
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message || 'Upload failed';
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'file_too_large',
          message: 'Image is too large (max 50 MB). Try a smaller JPG or PNG.',
        });
      }
      console.error('[courses upload]', err);
      return res.status(400).json({ error: 'upload_rejected', message });
    });
  };
}

function n(v: unknown): number {
  return Number(v);
}

function hasNumeric(v: unknown): boolean {
  if (v == null || v === '') return false;
  const num = Number(v);
  return Number.isFinite(num);
}

async function nextChapterSortOrder(subjectId: number): Promise<number> {
  const [rows]: any = await query(
    'SELECT COALESCE(MAX(sort_order), 0) + 10 AS nextSort FROM course_chapters WHERE subject_id = ?',
    [subjectId],
  );
  const next = n(rows?.[0]?.nextSort);
  return Number.isFinite(next) && next > 0 ? next : 10;
}

export async function resequenceSubjectChapters(subjectId: number): Promise<void> {
  if (!subjectId) return;
  const [rows]: any = await query(
    'SELECT id, title, sort_order AS sortOrder FROM course_chapters WHERE subject_id = ?',
    [subjectId],
  );
  if (!rows || rows.length === 0) return;
  const sorted = [...rows].sort(compareChapters);
  for (let i = 0; i < sorted.length; i++) {
    const expectedSort = (i + 1) * 10;
    if (Number(sorted[i].sortOrder) !== expectedSort) {
      await query('UPDATE course_chapters SET sort_order = ? WHERE id = ?', [
        expectedSort,
        sorted[i].id,
      ]);
    }
  }
}

function jsonCol(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

async function uniqueSubjectSlug(conn: any, semesterId: number, base: string): Promise<string> {
  const root = slugify(base) || 'book';
  for (let i = 0; i < 80; i += 1) {
    const trySlug = i === 0 ? root : `${root}-${i + 1}`;
    const [rows]: any = await conn.query(
      'SELECT id FROM course_subjects WHERE semester_id = ? AND slug = ? LIMIT 1',
      [semesterId, trySlug],
    );
    if (!rows?.[0]) return trySlug;
  }
  return `${root}-${Date.now()}`;
}

function chapterDoc(row: {
  id: unknown;
  title?: string;
  content?: string;
  contentJson?: unknown;
  content_json?: unknown;
}) {
  return asDoc(row.contentJson ?? row.content_json, {
    id: String(n(row.id)),
    title: row.title || 'Chapter',
    html: row.content || '',
  });
}

/** POST /api/admin/courses/images — upload a figure for chapter HTML */
router.post('/images', imageUpload, async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file?.buffer) return res.status(400).json({ error: 'image_required' });
  const mime = String(file.mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) return res.status(400).json({ error: 'not_an_image' });
  if (mime.includes('heic') || mime.includes('heif')) {
    return res
      .status(400)
      .json({ error: 'unsupported_image', message: 'Please upload a JPG, PNG, or WebP image.' });
  }
  const head = file.buffer.subarray(0, 16).toString('ascii');
  if (head.includes('ftypheic') || head.includes('ftypheif') || head.includes('ftypmif1')) {
    return res
      .status(400)
      .json({ error: 'unsupported_image', message: 'Please upload a JPG, PNG, or WebP image.' });
  }
  const ext = mime.includes('png')
    ? 'png'
    : mime.includes('webp')
      ? 'webp'
      : mime.includes('gif')
        ? 'gif'
        : 'jpg';
  const key = `courses/figures/${uuidv4()}.${ext}`;
  try {
    const storage = getStorageAdapter();
    const up = await storage.upload(key, file.buffer as Buffer, file.mimetype);
    const url = publicFileUrlForKey(up.key);
    res.status(201).json({ key: up.key, url });
  } catch (e: any) {
    console.error('[courses/images]', e);
    const code = String(e?.code || e?.name || '');
    const message =
      code === 'EACCES' || code === 'EPERM'
        ? 'Server cannot save the picture (storage folder is not writable).'
        : e?.message || 'Upload failed';
    res.status(500).json({ error: 'upload_failed', message, details: code || undefined });
  }
});

function filesOf(req: AuthRequest, field: string): Express.Multer.File[] {
  const bag = req.files as Record<string, Express.Multer.File[]> | undefined;
  return bag?.[field] || [];
}

async function uploadSubjectImage(
  courseSlug: string,
  slug: string,
  kind: 'cover' | 'back',
  file: Express.Multer.File,
) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) {
    const err: any = new Error('not_an_image');
    err.code = 'not_an_image';
    throw err;
  }
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const key = `courses/${courseSlug}/${slug}/${kind}-${uuidv4()}.${ext}`;
  const storage = getStorageAdapter();
  const up = await storage.upload(key, file.buffer as Buffer, file.mimetype);
  return up.key;
}

function coverUrls(coverKey?: string | null, backCoverKey?: string | null) {
  return {
    coverKey: coverKey || null,
    backCoverKey: backCoverKey || null,
    frontCoverUrl: coverKey ? publicFileUrlForKey(coverKey) : null,
    backCoverUrl: backCoverKey ? publicFileUrlForKey(backCoverKey) : null,
  };
}

/** GET /api/admin/courses */
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await query(
      `SELECT c.id, c.name, c.slug, c.university, c.description, c.cover_key AS coverKey,
              c.sort_order AS sortOrder, c.status, c.published_at AS publishedAt,
              (SELECT COUNT(*) FROM course_semesters sem WHERE sem.course_id = c.id) AS semesterCount
       FROM courses c
       ORDER BY c.sort_order ASC, c.id ASC`,
    );
    res.json(
      (rows || []).map((r: any) => ({
        ...r,
        id: n(r.id),
        sortOrder: n(r.sortOrder),
        semesterCount: n(r.semesterCount),
      })),
    );
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  }
});

/** GET /api/admin/courses/book-catalog — books and destination semesters for copy */
router.get('/book-catalog', async (_req, res) => {
  try {
    await ensureBookAccessTables();
    const [courses]: any = await query(
      `SELECT id, name FROM courses ORDER BY sort_order ASC, name ASC`,
    );
    const [semesters]: any = await query(
      `SELECT id, course_id AS courseId, number, title
       FROM course_semesters ORDER BY number ASC, id ASC`,
    );
    const [books]: any = await query(
      `SELECT s.id AS subjectId, s.name, s.slug, s.semester_id AS semesterId,
              sem.course_id AS courseId, sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.name AS courseName,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       ORDER BY c.sort_order ASC, c.name ASC, sem.number ASC, s.sort_order ASC, s.name ASC`,
    );
    res.json({
      courses: (courses || []).map((c: any) => ({
        id: n(c.id),
        name: c.name,
        semesters: (semesters || [])
          .filter((s: any) => n(s.courseId) === n(c.id))
          .map((s: any) => ({
            id: n(s.id),
            number: n(s.number),
            title: s.title || `Semester ${s.number}`,
          })),
      })),
      books: (books || []).map((b: any) => ({
        subjectId: n(b.subjectId),
        name: b.name,
        slug: b.slug,
        semesterId: n(b.semesterId),
        courseId: n(b.courseId),
        courseName: b.courseName,
        semesterNumber: n(b.semesterNumber),
        semesterTitle: b.semesterTitle || `Semester ${b.semesterNumber}`,
        chapterCount: n(b.chapterCount),
      })),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'catalog_failed' });
  }
});

/** GET /api/admin/courses/books — all books/subjects across courses with full metadata */
router.get('/books', async (_req, res) => {
  try {
    await ensureBookAccessTables();
    const [books]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.back_cover_key AS backCoverKey, s.file_key AS fileKey,
              s.pages, s.price, s.physical_price AS physicalPrice, s.both_price AS bothPrice,
              s.book_bank_price AS bookBankPrice, s.library_price AS libraryPrice,
              s.discount_pct AS discountPct, s.isbn, s.sort_order AS sortOrder,
              s.status, s.published_at AS publishedAt, s.created_at AS createdAt, s.updated_at AS updatedAt,
              sem.id AS semesterId, sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.id AS courseId, c.name AS courseName, c.slug AS courseSlug, c.university,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       ORDER BY c.sort_order ASC, c.name ASC, sem.number ASC, s.sort_order ASC, s.name ASC`,
    );
    res.json(
      (books || []).map((b: any) => ({
        id: n(b.id),
        name: b.name,
        slug: b.slug,
        description: b.description || null,
        syllabusCode: b.syllabusCode || null,
        pages: b.pages != null ? n(b.pages) : null,
        price: b.price != null ? Number(b.price) : null,
        physicalPrice: b.physicalPrice != null ? Number(b.physicalPrice) : null,
        bothPrice: b.bothPrice != null ? Number(b.bothPrice) : null,
        bookBankPrice: b.bookBankPrice != null ? Number(b.bookBankPrice) : null,
        libraryPrice: b.libraryPrice != null ? Number(b.libraryPrice) : null,
        discountPct: b.discountPct != null ? Number(b.discountPct) : null,
        isbn: b.isbn || null,
        sortOrder: n(b.sortOrder),
        status: b.status || 'DRAFT',
        publishedAt: b.publishedAt || null,
        createdAt: b.createdAt || null,
        updatedAt: b.updatedAt || null,
        hasBookPdf: !!b.fileKey,
        courseId: n(b.courseId),
        courseName: b.courseName,
        courseSlug: b.courseSlug,
        university: b.university || null,
        semesterId: n(b.semesterId),
        semesterNumber: n(b.semesterNumber),
        semesterTitle: b.semesterTitle || `Semester ${b.semesterNumber}`,
        chapterCount: n(b.chapterCount),
        ...coverUrls(b.coverKey, b.backCoverKey),
      })),
    );
  } catch (e: any) {
    console.error('[courses/books]', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/admin/courses/subjects/:id — subject details and chapter list for admin */
router.get('/subjects/:id', async (req, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.back_cover_key AS backCoverKey, s.file_key AS fileKey,
              s.pages, s.price, s.physical_price AS physicalPrice, s.both_price AS bothPrice,
              s.book_bank_price AS bookBankPrice, s.library_price AS libraryPrice,
              s.discount_pct AS discountPct, s.isbn, s.sort_order AS sortOrder,
              s.status, s.published_at AS publishedAt,
              sem.id AS semesterId, sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.id AS courseId, c.name AS courseName, c.slug AS courseSlug, c.university
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ?
       LIMIT 1`,
      [id],
    );
    const s = rows?.[0];
    if (!s) return res.status(404).json({ error: 'not_found' });

    const [chapters]: any = await query(
      `SELECT ch.id, ch.title, ch.slug, ch.sort_order AS sortOrder, ch.start_page AS startPage,
              ch.end_page AS endPage,
              (SELECT COUNT(*) FROM course_chapter_activities a WHERE a.chapter_id = ch.id) AS activityCount,
              (SELECT COUNT(*) FROM course_flashcards f WHERE f.chapter_id = ch.id AND f.user_id IS NULL) AS flashcardCount
       FROM course_chapters ch
       WHERE ch.subject_id = ?
       ORDER BY ch.sort_order ASC, ch.id ASC`,
      [id],
    );

    res.json({
      id: n(s.id),
      name: s.name,
      slug: s.slug,
      description: s.description || null,
      syllabusCode: s.syllabusCode || null,
      pages: s.pages != null ? n(s.pages) : null,
      price: s.price != null ? Number(s.price) : null,
      physicalPrice: s.physicalPrice != null ? Number(s.physicalPrice) : null,
      bothPrice: s.bothPrice != null ? Number(s.bothPrice) : null,
      bookBankPrice: s.bookBankPrice != null ? Number(s.bookBankPrice) : null,
      libraryPrice: s.libraryPrice != null ? Number(s.libraryPrice) : null,
      discountPct: s.discountPct != null ? Number(s.discountPct) : null,
      isbn: s.isbn || null,
      sortOrder: n(s.sortOrder),
      status: s.status || 'DRAFT',
      publishedAt: s.publishedAt || null,
      hasBookPdf: !!s.fileKey,
      course: {
        id: n(s.courseId),
        name: s.courseName,
        slug: s.courseSlug,
        university: s.university || null,
      },
      semester: {
        id: n(s.semesterId),
        number: n(s.semesterNumber),
        title: s.semesterTitle || `Semester ${s.semesterNumber}`,
      },
      ...coverUrls(s.coverKey, s.backCoverKey),
      chapters: (chapters || []).sort(compareChapters).map((ch: any) => ({
        id: n(ch.id),
        title: ch.title,
        slug: ch.slug,
        sortOrder: n(ch.sortOrder),
        startPage: ch.startPage != null ? n(ch.startPage) : null,
        endPage: ch.endPage != null ? n(ch.endPage) : null,
        activityCount: n(ch.activityCount),
        flashcardCount: n(ch.flashcardCount),
      })),
    });
  } catch (e: any) {
    console.error('[courses/subjects/:id]', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** POST /api/admin/courses */
router.post('/', async (req, res) => {
  const { name, slug, university, description, sortOrder, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const finalSlug = slug ? slugify(String(slug)) : slugify(String(name));
  if (!finalSlug) return res.status(400).json({ error: 'invalid_slug' });
  const published = String(status || '').toUpperCase() === 'PUBLISHED';
  try {
    const [r]: any = await query(
      `INSERT INTO courses (name, slug, university, description, sort_order, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ${published ? 'NOW(3)' : 'NULL'}, NOW(3), NOW(3))`,
      [
        String(name).trim(),
        finalSlug,
        university || null,
        description || null,
        n(sortOrder ?? 0),
        published ? 'PUBLISHED' : 'DRAFT',
      ],
    );
    res.status(201).json({ id: n(r.insertId), slug: finalSlug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  }
});

/** GET /api/admin/courses/:id */
router.get('/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT id, name, slug, university, description, cover_key AS coverKey,
              sort_order AS sortOrder, status, published_at AS publishedAt
       FROM courses WHERE id = ? LIMIT 1`,
      [id],
    );
    const c = rows?.[0];
    if (!c) return res.status(404).json({ error: 'not_found' });

    const [sems]: any = await query(
      `SELECT id, number, title, sort_order AS sortOrder FROM course_semesters
       WHERE course_id = ? ORDER BY number ASC`,
      [id],
    );

    const semesters = [];
    for (const sem of sems || []) {
      const [subjects]: any = await query(
        `SELECT id, name, slug, description, syllabus_code AS syllabusCode, cover_key AS coverKey,
                back_cover_key AS backCoverKey, file_key AS fileKey, pages, price,
                physical_price AS physicalPrice, both_price AS bothPrice, isbn,
                book_bank_price AS bookBankPrice, library_price AS libraryPrice,
                discount_pct AS discountPct,
                sort_order AS sortOrder, status, published_at AS publishedAt
         FROM course_subjects WHERE semester_id = ? ORDER BY sort_order ASC, id ASC`,
        [sem.id],
      );
      const subjectList = [];
      for (const s of subjects || []) {
        const [chapters]: any = await query(
          `SELECT ch.id, ch.title, ch.slug, ch.sort_order AS sortOrder, ch.start_page AS startPage,
                  ch.end_page AS endPage, ch.content,
                  (SELECT COUNT(*) FROM course_chapter_activities a WHERE a.chapter_id = ch.id) AS activityCount,
                  (SELECT COUNT(*) FROM course_flashcards f WHERE f.chapter_id = ch.id AND f.user_id IS NULL) AS flashcardCount
           FROM course_chapters ch WHERE ch.subject_id = ? ORDER BY ch.sort_order ASC, ch.id ASC`,
          [s.id],
        );
        subjectList.push({
          ...s,
          id: n(s.id),
          sortOrder: n(s.sortOrder),
          pages: s.pages != null ? n(s.pages) : null,
          price: s.price != null ? Number(s.price) : null,
          physicalPrice: s.physicalPrice != null ? Number(s.physicalPrice) : null,
          bothPrice: s.bothPrice != null ? Number(s.bothPrice) : null,
          isbn: s.isbn || null,
          bookBankPrice: s.bookBankPrice != null ? Number(s.bookBankPrice) : null,
          libraryPrice: s.libraryPrice != null ? Number(s.libraryPrice) : null,
          discountPct: s.discountPct != null ? Number(s.discountPct) : null,
          hasBookPdf: !!s.fileKey,
          ...coverUrls(s.coverKey, s.backCoverKey),
          chapters: (chapters || []).sort(compareChapters).map((ch: any) => ({
            id: n(ch.id),
            title: ch.title,
            slug: ch.slug,
            sortOrder: n(ch.sortOrder),
            startPage: ch.startPage != null ? n(ch.startPage) : null,
            endPage: ch.endPage != null ? n(ch.endPage) : null,
            content: ch.content,
            activityCount: n(ch.activityCount),
            flashcardCount: n(ch.flashcardCount),
          })),
        });
      }
      semesters.push({
        id: n(sem.id),
        number: n(sem.number),
        title: sem.title,
        sortOrder: n(sem.sortOrder),
        subjects: subjectList,
      });
    }

    res.json({
      id: n(c.id),
      name: c.name,
      slug: c.slug,
      university: c.university,
      description: c.description,
      coverKey: c.coverKey,
      sortOrder: n(c.sortOrder),
      status: c.status,
      publishedAt: c.publishedAt,
      semesters,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** PUT /api/admin/courses/:id */
router.put('/:id', async (req, res) => {
  const id = n(req.params.id);
  const { name, slug, university, description, sortOrder, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const published = String(status || '').toUpperCase() === 'PUBLISHED';
  try {
    const [existing]: any = await query('SELECT id, slug FROM courses WHERE id = ? LIMIT 1', [id]);
    if (!existing?.[0]) return res.status(404).json({ error: 'not_found' });
    const finalSlug = slug ? slugify(String(slug)) : existing[0].slug;
    await query(
      `UPDATE courses SET name = ?, slug = ?, university = ?, description = ?, sort_order = ?,
              status = ?, published_at = CASE
                WHEN ? = 1 AND published_at IS NULL THEN NOW(3)
                WHEN ? = 0 THEN NULL
                ELSE published_at END,
              updated_at = NOW(3)
       WHERE id = ?`,
      [
        String(name).trim(),
        finalSlug,
        university || null,
        description || null,
        n(sortOrder ?? 0),
        published ? 'PUBLISHED' : 'DRAFT',
        published ? 1 : 0,
        published ? 1 : 0,
        id,
      ],
    );
    res.json({ ok: true, slug: finalSlug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

/** DELETE /api/admin/courses/:id */
router.delete('/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [r]: any = await query('DELETE FROM courses WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** POST /api/admin/courses/:id/semesters */
router.post('/:id/semesters', async (req, res) => {
  const courseId = n(req.params.id);
  const number = n(req.body?.number);
  const title = String(req.body?.title || `Semester ${number}`).trim();
  if (!number) return res.status(400).json({ error: 'number_required' });
  try {
    const [r]: any = await query(
      `INSERT INTO course_semesters (course_id, number, title, sort_order, created_at)
       VALUES (?, ?, ?, ?, NOW(3))`,
      [courseId, number, title, number * 10],
    );
    res.status(201).json({ id: n(r.insertId) });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'semester_exists' });
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  }
});

/** PUT /api/admin/courses/semesters/:id */
router.put('/semesters/:id', async (req, res) => {
  const id = n(req.params.id);
  const number = n(req.body?.number);
  const title = String(req.body?.title || '').trim();
  if (!number || !title) return res.status(400).json({ error: 'number_and_title_required' });
  try {
    const [r]: any = await query(
      `UPDATE course_semesters SET number = ?, title = ?, sort_order = ? WHERE id = ?`,
      [number, title, number * 10, id],
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'semester_exists' });
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

/** DELETE /api/admin/courses/semesters/:id */
router.delete('/semesters/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [r]: any = await query('DELETE FROM course_semesters WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** POST /api/admin/courses/semesters/:id/subjects */
router.post('/semesters/:id/subjects', subjectUpload, async (req: AuthRequest, res) => {
  const semesterId = n(req.params.id);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  const slug = req.body?.slug ? slugify(String(req.body.slug)) : slugify(name);
  const published = String(req.body?.status || '').toUpperCase() === 'PUBLISHED';
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await ensureBookAccessTables();
    const [sem]: any = await conn.query(
      `SELECT sem.id, c.slug AS courseSlug FROM course_semesters sem
       JOIN courses c ON c.id = sem.course_id WHERE sem.id = ? LIMIT 1`,
      [semesterId],
    );
    if (!sem?.[0]) return res.status(404).json({ error: 'semester_not_found' });

    let coverKey: string | null = null;
    let backCoverKey: string | null = null;
    let fileKey: string | null = null;
    const storage = getStorageAdapter();
    const cover = filesOf(req, 'frontCover')[0] || filesOf(req, 'cover')[0];
    const backCover = filesOf(req, 'backCover')[0];
    const pdf = filesOf(req, 'bookPdf')[0];
    if (cover) coverKey = await uploadSubjectImage(sem[0].courseSlug, slug, 'cover', cover);
    if (backCover)
      backCoverKey = await uploadSubjectImage(sem[0].courseSlug, slug, 'back', backCover);
    if (pdf) {
      const key = `courses/${sem[0].courseSlug}/${slug}/${uuidv4()}.pdf`;
      const up = await storage.upload(key, pdf.buffer as Buffer, pdf.mimetype || 'application/pdf');
      fileKey = up.key;
    }

    const [r]: any = await conn.query(
      `INSERT INTO course_subjects
        (semester_id, name, slug, description, syllabus_code, cover_key, back_cover_key, file_key, pages, price, physical_price, both_price, isbn, book_bank_price, library_price, discount_pct, sort_order, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${published ? 'NOW(3)' : 'NULL'}, NOW(3), NOW(3))`,
      [
        semesterId,
        name,
        slug,
        req.body?.description || null,
        req.body?.syllabusCode || null,
        coverKey,
        backCoverKey,
        fileKey,
        req.body?.pages ? n(req.body.pages) : null,
        parseBookPrice(req.body?.price),
        parseBookPrice(req.body?.physicalPrice),
        parseBookPrice(req.body?.bothPrice),
        String(req.body?.isbn || '').trim() || null,
        parseBookPrice(req.body?.bookBankPrice),
        parseBookPrice(req.body?.libraryPrice),
        parseDiscountPct(req.body?.discountPct),
        n(req.body?.sortOrder ?? 0),
        published ? 'PUBLISHED' : 'DRAFT',
      ],
    );
    res.status(201).json({ id: n(r.insertId), slug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'create_failed', details: e.message });
  } finally {
    conn.release();
  }
});

/** PUT /api/admin/courses/subjects/:id */
router.put('/subjects/:id', subjectUpload, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  const published = String(req.body?.status || '').toUpperCase() === 'PUBLISHED';
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await ensureBookAccessTables();
    const [rows]: any = await conn.query(
      `SELECT s.id, s.slug, c.slug AS courseSlug
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? LIMIT 1`,
      [id],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    const slug = req.body?.slug ? slugify(String(req.body.slug)) : rows[0].slug;

    let coverKey: string | undefined;
    let backCoverKey: string | undefined;
    let fileKey: string | undefined;
    const storage = getStorageAdapter();
    const cover = filesOf(req, 'frontCover')[0] || filesOf(req, 'cover')[0];
    const backCover = filesOf(req, 'backCover')[0];
    const pdf = filesOf(req, 'bookPdf')[0];
    if (cover) coverKey = await uploadSubjectImage(rows[0].courseSlug, slug, 'cover', cover);
    if (backCover)
      backCoverKey = await uploadSubjectImage(rows[0].courseSlug, slug, 'back', backCover);
    if (pdf) {
      const key = `courses/${rows[0].courseSlug}/${slug}/${uuidv4()}.pdf`;
      const up = await storage.upload(key, pdf.buffer as Buffer, pdf.mimetype || 'application/pdf');
      fileKey = up.key;
    }

    await conn.query(
      `UPDATE course_subjects SET
         name = ?, slug = ?, description = ?, syllabus_code = ?, pages = ?, price = ?,
         physical_price = ?, both_price = ?, isbn = ?,
         book_bank_price = ?, library_price = ?, discount_pct = ?, sort_order = ?,
         status = ?,
         published_at = CASE
           WHEN ? = 1 AND published_at IS NULL THEN NOW(3)
           WHEN ? = 0 THEN NULL
           ELSE published_at END,
         cover_key = COALESCE(?, cover_key),
         back_cover_key = COALESCE(?, back_cover_key),
         file_key = COALESCE(?, file_key),
         updated_at = NOW(3)
       WHERE id = ?`,
      [
        name,
        slug,
        req.body?.description || null,
        req.body?.syllabusCode || null,
        req.body?.pages ? n(req.body.pages) : null,
        parseBookPrice(req.body?.price),
        parseBookPrice(req.body?.physicalPrice),
        parseBookPrice(req.body?.bothPrice),
        String(req.body?.isbn || '')
          .trim()
          .slice(0, 32) || null,
        parseBookPrice(req.body?.bookBankPrice),
        parseBookPrice(req.body?.libraryPrice),
        parseDiscountPct(req.body?.discountPct),
        n(req.body?.sortOrder ?? 0),
        published ? 'PUBLISHED' : 'DRAFT',
        published ? 1 : 0,
        published ? 1 : 0,
        coverKey ?? null,
        backCoverKey ?? null,
        fileKey ?? null,
        id,
      ],
    );
    res.json({ ok: true, slug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'update_failed', details: e.message });
  } finally {
    conn.release();
  }
});

/** POST /api/admin/courses/subjects/:id/covers — replace front and/or back cover */
router.post('/subjects/:id/covers', subjectCoverUpload, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const cover = filesOf(req, 'frontCover')[0] || filesOf(req, 'cover')[0];
  const backCover = filesOf(req, 'backCover')[0];
  if (!cover && !backCover) return res.status(400).json({ error: 'image_required' });
  try {
    const [rows]: any = await query(
      `SELECT s.id, s.slug, c.slug AS courseSlug
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? LIMIT 1`,
      [id],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    let coverKey: string | null = null;
    let backCoverKey: string | null = null;
    if (cover)
      coverKey = await uploadSubjectImage(rows[0].courseSlug, rows[0].slug, 'cover', cover);
    if (backCover)
      backCoverKey = await uploadSubjectImage(rows[0].courseSlug, rows[0].slug, 'back', backCover);
    await query(
      `UPDATE course_subjects SET
         cover_key = COALESCE(?, cover_key),
         back_cover_key = COALESCE(?, back_cover_key),
         updated_at = NOW(3)
       WHERE id = ?`,
      [coverKey, backCoverKey, id],
    );
    const [next]: any = await query(
      `SELECT cover_key AS coverKey, back_cover_key AS backCoverKey FROM course_subjects WHERE id = ? LIMIT 1`,
      [id],
    );
    res.json({ ok: true, ...coverUrls(next?.[0]?.coverKey, next?.[0]?.backCoverKey) });
  } catch (e: any) {
    console.error('[subjects/covers]', e);
    const code = String(e?.code || e?.name || '');
    const message =
      code === 'EACCES' || code === 'EPERM'
        ? 'Server cannot save the picture (storage folder is not writable).'
        : e?.message || 'Cover upload failed';
    res.status(500).json({ error: 'upload_failed', message, details: code || undefined });
  }
});

/** POST /api/admin/courses/subjects/:id/copy — duplicate a book into another semester/course */
router.post('/subjects/:id/copy', async (req, res) => {
  const sourceId = n(req.params.id);
  if (!sourceId) return res.status(400).json({ error: 'subject_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await ensureBookAccessTables();
    await conn.beginTransaction();

    const [srcRows]: any = await conn.query(
      `SELECT s.id, s.semester_id AS semesterId, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.back_cover_key AS backCoverKey, s.file_key AS fileKey,
              s.pages, s.price, s.physical_price AS physicalPrice, s.both_price AS bothPrice, s.isbn,
              s.book_bank_price AS bookBankPrice, s.library_price AS libraryPrice,
              s.discount_pct AS discountPct, s.status, s.published_at AS publishedAt
       FROM course_subjects s WHERE s.id = ? LIMIT 1`,
      [sourceId],
    );
    const src = srcRows?.[0];
    if (!src) {
      await conn.rollback();
      return res.status(404).json({ error: 'not_found' });
    }

    let targetSemesterId = n(req.body?.targetSemesterId);
    let createdSemester = false;
    const targetCourseId = n(req.body?.targetCourseId);
    const typedNumber = n(req.body?.semesterNumber);
    const wantsTypedSemester =
      Boolean(req.body?.createSemester) ||
      Boolean(req.body?.semesterTitle) ||
      (Number.isFinite(typedNumber) && typedNumber > 0);

    if (targetCourseId) {
      const [courseRows]: any = await conn.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [
        targetCourseId,
      ]);
      if (!courseRows?.[0]) {
        await conn.rollback();
        return res.status(404).json({ error: 'course_not_found' });
      }
    }

    if (!targetSemesterId && targetCourseId && wantsTypedSemester) {
      const number = typedNumber > 0 ? typedNumber : 1;
      const title = String(req.body?.semesterTitle || `Semester ${number}`).trim();
      const [byNumber]: any = await conn.query(
        'SELECT id FROM course_semesters WHERE course_id = ? AND number = ? LIMIT 1',
        [targetCourseId, number],
      );
      if (byNumber?.[0]) {
        targetSemesterId = n(byNumber[0].id);
      } else {
        const [semIns]: any = await conn.query(
          `INSERT INTO course_semesters (course_id, number, title, sort_order, created_at)
           VALUES (?, ?, ?, ?, NOW(3))`,
          [targetCourseId, number, title, number * 10],
        );
        targetSemesterId = n(semIns.insertId);
        createdSemester = true;
      }
    }

    if (!targetSemesterId && targetCourseId) {
      const [existingSems]: any = await conn.query(
        'SELECT id FROM course_semesters WHERE course_id = ? ORDER BY number ASC, id ASC',
        [targetCourseId],
      );
      if (existingSems?.[0] && n(existingSems[0].id) !== n(src.semesterId)) {
        targetSemesterId = n(existingSems[0].id);
      } else if (!existingSems?.length) {
        const number = typedNumber > 0 ? typedNumber : 1;
        const title = String(req.body?.semesterTitle || `Semester ${number}`).trim();
        const [semIns]: any = await conn.query(
          `INSERT INTO course_semesters (course_id, number, title, sort_order, created_at)
           VALUES (?, ?, ?, ?, NOW(3))`,
          [targetCourseId, number, title, number * 10],
        );
        targetSemesterId = n(semIns.insertId);
        createdSemester = true;
      }
    }

    if (!targetSemesterId) {
      await conn.rollback();
      return res.status(400).json({ error: 'target_semester_required' });
    }

    const [dstRows]: any = await conn.query(
      `SELECT id, course_id AS courseId FROM course_semesters WHERE id = ? LIMIT 1`,
      [targetSemesterId],
    );
    const dst = dstRows?.[0];
    if (!dst) {
      await conn.rollback();
      return res.status(404).json({ error: 'semester_not_found' });
    }
    if (n(dst.id) === n(src.semesterId)) {
      await conn.rollback();
      return res.status(400).json({
        error: 'same_semester',
        message: 'Pick a different semester or course. This book is already there.',
      });
    }

    const name = String(req.body?.name || src.name || '').trim() || src.name;
    const slug = await uniqueSubjectSlug(
      conn,
      targetSemesterId,
      req.body?.slug ? String(req.body.slug) : name,
    );
    const [sortRows]: any = await conn.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 10 AS nextSort FROM course_subjects WHERE semester_id = ?',
      [targetSemesterId],
    );
    const sortOrder = n(sortRows?.[0]?.nextSort) || 10;
    const published = String(src.status || '').toUpperCase() === 'PUBLISHED';

    const [ins]: any = await conn.query(
      `INSERT INTO course_subjects
        (semester_id, name, slug, description, syllabus_code, cover_key, back_cover_key, file_key, pages, price,
         physical_price, both_price, isbn, book_bank_price, library_price, discount_pct, sort_order, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${published ? 'NOW(3)' : 'NULL'}, NOW(3), NOW(3))`,
      [
        targetSemesterId,
        name,
        slug,
        src.description || null,
        src.syllabusCode || null,
        src.coverKey || null,
        src.backCoverKey || null,
        src.fileKey || null,
        src.pages != null ? n(src.pages) : null,
        src.price != null ? src.price : null,
        src.physicalPrice != null ? src.physicalPrice : null,
        src.bothPrice != null ? src.bothPrice : null,
        src.isbn || null,
        src.bookBankPrice != null ? src.bookBankPrice : null,
        src.libraryPrice != null ? src.libraryPrice : null,
        src.discountPct != null ? src.discountPct : null,
        sortOrder,
        published ? 'PUBLISHED' : 'DRAFT',
      ],
    );
    const newSubjectId = n(ins.insertId);

    const [chapters]: any = await conn.query(
      `SELECT id, title, slug, sort_order AS sortOrder, start_page AS startPage, end_page AS endPage,
              content, content_json AS contentJson, content_format AS contentFormat
       FROM course_chapters WHERE subject_id = ? ORDER BY sort_order ASC, id ASC`,
      [sourceId],
    );

    for (const ch of chapters || []) {
      const [chIns]: any = await conn.query(
        `INSERT INTO course_chapters
          (subject_id, title, slug, sort_order, start_page, end_page, content, content_json, content_format, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          newSubjectId,
          ch.title,
          ch.slug,
          n(ch.sortOrder),
          ch.startPage != null ? n(ch.startPage) : null,
          ch.endPage != null ? n(ch.endPage) : null,
          ch.content || null,
          jsonCol(ch.contentJson),
          ch.contentFormat || 'html',
        ],
      );
      const newChapterId = n(chIns.insertId);
      await conn.query(
        `INSERT INTO course_chapter_activities (chapter_id, activity_id, page_number, placement, sort_order, created_at)
         SELECT ?, activity_id, page_number, placement, sort_order, NOW(3)
         FROM course_chapter_activities WHERE chapter_id = ?`,
        [newChapterId, n(ch.id)],
      );
      await conn.query(
        `INSERT INTO course_flashcards (chapter_id, user_id, front, back, page_number, sort_order, created_at, updated_at)
         SELECT ?, NULL, front, back, page_number, sort_order, NOW(3), NOW(3)
         FROM course_flashcards WHERE chapter_id = ? AND user_id IS NULL`,
        [newChapterId, n(ch.id)],
      );
    }

    await conn.commit();
    res.status(201).json({
      id: newSubjectId,
      slug,
      courseId: n(dst.courseId),
      semesterId: targetSemesterId,
      chapterCount: (chapters || []).length,
      createdSemester,
    });
  } catch (e: any) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'copy_failed', details: e.message });
  } finally {
    conn.release();
  }
});

/** DELETE /api/admin/courses/subjects/:id */
router.delete('/subjects/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [r]: any = await query('DELETE FROM course_subjects WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** POST /api/admin/courses/subjects/:id/chapters */
router.post('/subjects/:id/chapters', async (req, res) => {
  const subjectId = n(req.params.id);
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title_required' });
  const slug = req.body?.slug ? slugify(String(req.body.slug)) : slugify(title);
  try {
    const [r]: any = await query(
      `INSERT INTO course_chapters
        (subject_id, title, slug, sort_order, start_page, end_page, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        subjectId,
        title,
        slug,
        hasNumeric(req.body?.sortOrder)
          ? n(req.body.sortOrder)
          : await nextChapterSortOrder(subjectId),
        req.body?.startPage ? n(req.body.startPage) : null,
        req.body?.endPage ? n(req.body.endPage) : null,
        req.body?.content || null,
      ],
    );
    // Keep chapters arranged in natural order starting from Chapter 1
    await resequenceSubjectChapters(subjectId);
    res.status(201).json({ id: n(r.insertId), slug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  }
});

/** GET /api/admin/courses/chapters/:id */
router.get('/chapters/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [rows]: any = await query(
      `SELECT ch.id, ch.title, ch.slug, ch.sort_order AS sortOrder, ch.start_page AS startPage,
              ch.end_page AS endPage, ch.content, ch.content_json AS contentJson, ch.content_format AS contentFormat,
              s.id AS subjectId, s.name AS subjectName, s.cover_key AS coverKey, s.back_cover_key AS backCoverKey,
              sem.id AS semesterId, sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.id AS courseId, c.name AS courseName
       FROM course_chapters ch
       JOIN course_subjects s ON s.id = ch.subject_id
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE ch.id = ?
       LIMIT 1`,
      [id],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    const r = rows[0];
    res.json({
      id: n(r.id),
      title: r.title,
      slug: r.slug,
      sortOrder: n(r.sortOrder),
      startPage: r.startPage != null ? n(r.startPage) : null,
      endPage: r.endPage != null ? n(r.endPage) : null,
      content: r.content,
      contentFormat: r.contentFormat || 'html',
      contentJson: chapterDoc(r),
      subjectId: n(r.subjectId),
      subjectName: r.subjectName,
      semesterId: n(r.semesterId),
      semesterNumber: n(r.semesterNumber),
      semesterTitle: r.semesterTitle,
      courseId: n(r.courseId),
      courseName: r.courseName,
      ...coverUrls(r.coverKey, r.backCoverKey),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** PUT /api/admin/courses/chapters/:id */
router.put('/chapters/:id', async (req, res) => {
  const id = n(req.params.id);
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title_required' });
  try {
    const [existing]: any = await query(
      'SELECT id, subject_id AS subjectId, slug, title, content, content_json AS contentJson, sort_order AS sortOrder FROM course_chapters WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing?.[0]) return res.status(404).json({ error: 'not_found' });
    const subjectId = n(existing[0].subjectId);
    const slug = req.body?.slug ? slugify(String(req.body.slug)) : existing[0].slug;
    const sortOrder = hasNumeric(req.body?.sortOrder)
      ? n(req.body.sortOrder)
      : n(existing[0].sortOrder);
    const doc = req.body?.contentJson
      ? asDoc(req.body.contentJson, { id: String(id), title, html: existing[0].content || '' })
      : req.body?.content != null
        ? htmlToJson(String(req.body.content), { id: String(id), title })
        : chapterDoc({ ...existing[0], id, title });
    doc.chapter.id = String(id);
    doc.chapter.title = title;
    const html = jsonToHtml(doc);
    await query(
      `UPDATE course_chapters SET title = ?, slug = ?, sort_order = ?, start_page = ?, end_page = ?,
              content = ?, content_json = ?, content_format = 'json', updated_at = NOW(3)
       WHERE id = ?`,
      [
        title,
        slug,
        Number.isFinite(sortOrder) ? sortOrder : 0,
        req.body?.startPage ? n(req.body.startPage) : null,
        req.body?.endPage ? n(req.body.endPage) : null,
        html,
        JSON.stringify(doc),
        id,
      ],
    );
    if (subjectId) {
      await resequenceSubjectChapters(subjectId);
    }
    res.json({ ok: true, slug });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_exists' });
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

/** DELETE /api/admin/courses/chapters/:id */
router.delete('/chapters/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [existing]: any = await query(
      'SELECT subject_id AS subjectId FROM course_chapters WHERE id = ? LIMIT 1',
      [id],
    );
    const subjectId = existing?.[0]?.subjectId ? n(existing[0].subjectId) : null;
    const [r]: any = await query('DELETE FROM course_chapters WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    if (subjectId) {
      await resequenceSubjectChapters(subjectId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** PUT /api/admin/courses/subjects/:id/chapters/reorder */
router.put('/subjects/:id/chapters/reorder', async (req, res) => {
  const subjectId = n(req.params.id);
  if (!subjectId) return res.status(400).json({ error: 'invalid_id' });
  try {
    const chapterIds = req.body?.chapterIds;
    if (Array.isArray(chapterIds) && chapterIds.length > 0) {
      for (let i = 0; i < chapterIds.length; i++) {
        await query('UPDATE course_chapters SET sort_order = ? WHERE id = ? AND subject_id = ?', [
          (i + 1) * 10,
          n(chapterIds[i]),
          subjectId,
        ]);
      }
    } else {
      await resequenceSubjectChapters(subjectId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'reorder_failed' });
  }
});

/** GET /api/admin/courses/chapters/:id/activities */
router.get('/chapters/:id/activities', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [rows]: any = await query(
      `SELECT x.id, x.page_number AS pageNumber, x.placement, x.sort_order AS sortOrder,
              a.id AS activityId, a.title, a.activity_type AS activityType, a.status
       FROM course_chapter_activities x
       JOIN learn_activities a ON a.id = x.activity_id
       WHERE x.chapter_id = ?
       ORDER BY x.sort_order ASC, x.id ASC`,
      [id],
    );
    res.json(
      (rows || []).map((r: any) => ({
        id: n(r.id),
        activityId: n(r.activityId),
        title: r.title,
        activityType: r.activityType,
        status: r.status,
        pageNumber: r.pageNumber != null ? n(r.pageNumber) : null,
        placement: r.placement,
        sortOrder: n(r.sortOrder),
      })),
    );
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  }
});

/** POST /api/admin/courses/chapters/:id/activities */
router.post('/chapters/:id/activities', async (req, res) => {
  const chapterId = n(req.params.id);
  const activityId = n(req.body?.activityId);
  if (!activityId) return res.status(400).json({ error: 'activityId_required' });
  try {
    const [r]: any = await query(
      `INSERT INTO course_chapter_activities (chapter_id, activity_id, page_number, placement, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))`,
      [
        chapterId,
        activityId,
        req.body?.pageNumber ? n(req.body.pageNumber) : null,
        req.body?.placement || 'PRACTICE',
        n(req.body?.sortOrder ?? 0),
      ],
    );
    res.status(201).json({ id: n(r.insertId) });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'already_attached' });
    console.error(e);
    res.status(500).json({ error: 'attach_failed' });
  }
});

/** DELETE /api/admin/courses/chapter-activities/:id */
router.delete('/chapter-activities/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [r]: any = await query('DELETE FROM course_chapter_activities WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/** PUT /api/admin/courses/chapter-activities/:id { placement, pageNumber } */
router.put('/chapter-activities/:id', async (req, res) => {
  const id = n(req.params.id);
  const placement =
    String(req.body?.placement || 'PRACTICE').toUpperCase() === 'INLINE' ? 'INLINE' : 'PRACTICE';
  const pageNumber =
    req.body?.pageNumber != null && req.body?.pageNumber !== '' ? n(req.body.pageNumber) : null;
  try {
    const [r]: any = await query(
      'UPDATE course_chapter_activities SET placement = ?, page_number = ? WHERE id = ?',
      [placement, pageNumber, id],
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

function mapAdminFlashcard(r: any) {
  return {
    id: n(r.id),
    chapterId: n(r.chapterId),
    front: String(r.front || ''),
    back: String(r.back || ''),
    pageNumber: r.pageNumber != null ? n(r.pageNumber) : null,
    sortOrder: n(r.sortOrder),
  };
}

/** GET /api/admin/courses/chapters/:id/flashcards */
router.get('/chapters/:id/flashcards', async (req, res) => {
  const chapterId = n(req.params.id);
  if (!chapterId) return res.status(400).json({ error: 'invalid_id' });
  try {
    const [rows]: any = await query(
      `SELECT id, chapter_id AS chapterId, front, back, page_number AS pageNumber, sort_order AS sortOrder
       FROM course_flashcards WHERE chapter_id = ? AND user_id IS NULL
       ORDER BY sort_order ASC, id ASC`,
      [chapterId],
    );
    res.json((rows || []).map(mapAdminFlashcard));
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** POST /api/admin/courses/chapters/:id/flashcards { front, back, pageNumber, sortOrder } */
router.post('/chapters/:id/flashcards', async (req, res) => {
  const chapterId = n(req.params.id);
  const front = String(req.body?.front || '')
    .trim()
    .slice(0, 500);
  const back = String(req.body?.back || '')
    .trim()
    .slice(0, 2000);
  const pageNumber = req.body?.pageNumber != null ? n(req.body.pageNumber) : null;
  const sortOrder = n(req.body?.sortOrder ?? 0);
  if (!chapterId || !front || !back)
    return res.status(400).json({ error: 'front_and_back_required' });
  try {
    const [ch]: any = await query('SELECT id FROM course_chapters WHERE id = ? LIMIT 1', [
      chapterId,
    ]);
    if (!ch?.[0]) return res.status(404).json({ error: 'not_found' });
    const [r]: any = await query(
      `INSERT INTO course_flashcards (chapter_id, user_id, front, back, page_number, sort_order, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [chapterId, front, back, pageNumber, sortOrder],
    );
    res.status(201).json({ id: n(r.insertId), chapterId, front, back, pageNumber, sortOrder });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.delete('/flashcards/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    const [r]: any = await query('DELETE FROM course_flashcards WHERE id = ? AND user_id IS NULL', [
      id,
    ]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default router;

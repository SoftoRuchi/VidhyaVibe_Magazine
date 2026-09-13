import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool, query } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import type { AuthRequest } from '../../middleware/auth';
import { requireAuth } from '../../middleware/auth';
import { memoryUpload } from '../../middleware/upload';
import { getStorageAdapter } from '../../providers/storage';
import { publicFileUrlForKey } from '../../utils/courseAssets';
import { slugify } from '../../utils/slugify';
import { asDoc, htmlToJson, jsonToHtml } from '../../utils/textbookContent';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

const upload = memoryUpload;
const subjectUpload = upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'bookPdf', maxCount: 1 },
]);
const imageUpload = upload.single('image');

function n(v: unknown): number {
  return Number(v);
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
    console.error(e);
    res.status(500).json({ error: 'upload_failed' });
  }
});

function filesOf(req: AuthRequest, field: string): Express.Multer.File[] {
  const bag = req.files as Record<string, Express.Multer.File[]> | undefined;
  return bag?.[field] || [];
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
                file_key AS fileKey, pages, sort_order AS sortOrder, status, published_at AS publishedAt
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
          hasBookPdf: !!s.fileKey,
          chapters: (chapters || []).map((ch: any) => ({
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
    const [sem]: any = await conn.query(
      `SELECT sem.id, c.slug AS courseSlug FROM course_semesters sem
       JOIN courses c ON c.id = sem.course_id WHERE sem.id = ? LIMIT 1`,
      [semesterId],
    );
    if (!sem?.[0]) return res.status(404).json({ error: 'semester_not_found' });

    let coverKey: string | null = null;
    let fileKey: string | null = null;
    const storage = getStorageAdapter();
    const cover = filesOf(req, 'cover')[0];
    const pdf = filesOf(req, 'bookPdf')[0];
    if (cover) {
      const key = `courses/${sem[0].courseSlug}/${slug}/cover-${uuidv4()}`;
      const up = await storage.upload(key, cover.buffer as Buffer, cover.mimetype);
      coverKey = up.key;
    }
    if (pdf) {
      const key = `courses/${sem[0].courseSlug}/${slug}/${uuidv4()}.pdf`;
      const up = await storage.upload(key, pdf.buffer as Buffer, pdf.mimetype || 'application/pdf');
      fileKey = up.key;
    }

    const [r]: any = await conn.query(
      `INSERT INTO course_subjects
        (semester_id, name, slug, description, syllabus_code, cover_key, file_key, pages, sort_order, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${published ? 'NOW(3)' : 'NULL'}, NOW(3), NOW(3))`,
      [
        semesterId,
        name,
        slug,
        req.body?.description || null,
        req.body?.syllabusCode || null,
        coverKey,
        fileKey,
        req.body?.pages ? n(req.body.pages) : null,
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
    let fileKey: string | undefined;
    const storage = getStorageAdapter();
    const cover = filesOf(req, 'cover')[0];
    const pdf = filesOf(req, 'bookPdf')[0];
    if (cover) {
      const key = `courses/${rows[0].courseSlug}/${slug}/cover-${uuidv4()}`;
      const up = await storage.upload(key, cover.buffer as Buffer, cover.mimetype);
      coverKey = up.key;
    }
    if (pdf) {
      const key = `courses/${rows[0].courseSlug}/${slug}/${uuidv4()}.pdf`;
      const up = await storage.upload(key, pdf.buffer as Buffer, pdf.mimetype || 'application/pdf');
      fileKey = up.key;
    }

    await conn.query(
      `UPDATE course_subjects SET
         name = ?, slug = ?, description = ?, syllabus_code = ?, pages = ?, sort_order = ?,
         status = ?,
         published_at = CASE
           WHEN ? = 1 AND published_at IS NULL THEN NOW(3)
           WHEN ? = 0 THEN NULL
           ELSE published_at END,
         cover_key = COALESCE(?, cover_key),
         file_key = COALESCE(?, file_key),
         updated_at = NOW(3)
       WHERE id = ?`,
      [
        name,
        slug,
        req.body?.description || null,
        req.body?.syllabusCode || null,
        req.body?.pages ? n(req.body.pages) : null,
        n(req.body?.sortOrder ?? 0),
        published ? 'PUBLISHED' : 'DRAFT',
        published ? 1 : 0,
        published ? 1 : 0,
        coverKey ?? null,
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
        n(req.body?.sortOrder ?? 0),
        req.body?.startPage ? n(req.body.startPage) : null,
        req.body?.endPage ? n(req.body.endPage) : null,
        req.body?.content || null,
      ],
    );
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
              s.id AS subjectId, s.name AS subjectName,
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
      'SELECT id, slug, title, content, content_json AS contentJson FROM course_chapters WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing?.[0]) return res.status(404).json({ error: 'not_found' });
    const slug = req.body?.slug ? slugify(String(req.body.slug)) : existing[0].slug;
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
        n(req.body?.sortOrder ?? 0),
        req.body?.startPage ? n(req.body.startPage) : null,
        req.body?.endPage ? n(req.body.endPage) : null,
        html,
        JSON.stringify(doc),
        id,
      ],
    );
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
    const [r]: any = await query('DELETE FROM course_chapters WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
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

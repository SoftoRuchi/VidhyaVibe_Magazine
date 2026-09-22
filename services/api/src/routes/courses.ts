import { Router } from 'express';
import { query } from '../db';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requireChapterAccess, requireSubjectAccess } from '../middleware/courseAccess';
import { optionalAuth } from '../middleware/optionalAuth';
import { memoryUpload } from '../middleware/upload';
import { getStorageAdapter } from '../providers/storage';
import {
  acquireReadingSession,
  assertCanReadSubject,
  attachBookOrderProof,
  BookAccessError,
  confirmBookRazorpayPayment,
  createBookCheckout,
  ensureBookAccessTables,
  heartbeatReadingSession,
  listEntitledBooks,
  releaseReadingSession,
  resolveEntitlement,
} from '../services/bookAccess';
import { publicFileUrlForKey, rewriteCourseAssetUrls } from '../utils/courseAssets';
import { sendStorageBody } from '../utils/sendStorage';
import { asDoc, jsonToHtml, quickChecksFromDoc } from '../utils/textbookContent';

const router = Router();

function n(v: unknown): number {
  return Number(v);
}

function parseJson(v: unknown): unknown {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function publishedCourseSql(alias = 'c') {
  return `${alias}.status = 'PUBLISHED' AND ${alias}.published_at IS NOT NULL AND ${alias}.published_at <= NOW()`;
}

function publishedSubjectSql(alias = 's') {
  return `${alias}.status = 'PUBLISHED' AND ${alias}.published_at IS NOT NULL AND ${alias}.published_at <= NOW()`;
}

/** GET /api/courses */
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await query(
      `SELECT c.id, c.name, c.slug, c.university, c.description, c.cover_key AS coverKey, c.sort_order AS sortOrder,
              (SELECT COUNT(*) FROM course_semesters sem WHERE sem.course_id = c.id) AS semesterCount
       FROM courses c
       WHERE ${publishedCourseSql('c')}
       ORDER BY c.sort_order ASC, c.id ASC`,
    );
    res.json(
      (rows || []).map((r: any) => ({
        id: n(r.id),
        name: r.name,
        slug: r.slug,
        university: r.university,
        description: r.description,
        coverKey: r.coverKey,
        sortOrder: n(r.sortOrder),
        semesterCount: n(r.semesterCount),
      })),
    );
  } catch (e: any) {
    console.error('[courses] list failed', e);
    res.status(500).json({ error: 'list_failed', details: e?.message });
  }
});

/** POST /api/courses/progress */
router.post('/progress', requireAuth, async (req: AuthRequest, res) => {
  const subjectId = n(req.body?.subjectId);
  const chapterId = req.body?.chapterId != null ? n(req.body.chapterId) : null;
  const currentPage = req.body?.currentPage != null ? n(req.body.currentPage) : null;
  const percent = req.body?.percent != null ? Number(req.body.percent) : null;
  if (!subjectId) return res.status(400).json({ error: 'subjectId_required' });
  try {
    const [subs]: any = await query(
      `SELECT id FROM course_subjects s WHERE s.id = ? AND ${publishedSubjectSql('s')} LIMIT 1`,
      [subjectId],
    );
    if (!subs?.[0]) return res.status(404).json({ error: 'subject_not_found' });
    await assertCanReadSubject(Number(req.user!.id), subjectId, req.user?.isAdmin);

    await query(
      `INSERT INTO course_progress (user_id, subject_id, chapter_id, current_page, percent, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         chapter_id = COALESCE(VALUES(chapter_id), chapter_id),
         current_page = COALESCE(VALUES(current_page), current_page),
         percent = COALESCE(VALUES(percent), percent),
         updated_at = NOW(3)`,
      [req.user!.id, subjectId, chapterId, currentPage, percent],
    );
    res.json({ ok: true });
  } catch (e: any) {
    if (e instanceof BookAccessError) {
      return res.status(e.status).json({ error: e.code, message: e.message });
    }
    console.error('[courses] progress failed', e);
    res.status(500).json({ error: 'progress_failed' });
  }
});

/** GET /api/courses/continue */
router.get('/continue', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [rows]: any = await query(
      `SELECT p.subject_id AS subjectId, p.chapter_id AS chapterId, p.current_page AS currentPage, p.percent,
              ch.title AS chapterTitle, ch.slug AS chapterSlug,
              s.name AS subjectName, s.slug AS subjectSlug,
              sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.name AS courseName, c.slug AS courseSlug, c.university
       FROM course_progress p
       JOIN course_subjects s ON s.id = p.subject_id
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       LEFT JOIN course_chapters ch ON ch.id = p.chapter_id
       WHERE p.user_id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       ORDER BY p.updated_at DESC
       LIMIT 1`,
      [req.user!.id],
    );
    const row = rows?.[0];
    if (!row?.chapterId) return res.json(null);
    const subjectId = n(row.subjectId);
    const ent = await resolveEntitlement(Number(req.user!.id), subjectId, req.user?.isAdmin);
    if (!ent.allowed) return res.json(null);
    const semesterNumber = n(row.semesterNumber);
    const page = row.currentPage != null ? n(row.currentPage) : null;
    const href =
      `/courses/${row.courseSlug}/sem-${semesterNumber}/${row.subjectSlug}/read?chapter=${row.chapterSlug}` +
      (page ? `&page=${page}` : '');
    res.json({
      subjectId: n(row.subjectId),
      chapterId: n(row.chapterId),
      currentPage: page,
      percent: row.percent != null ? Number(row.percent) : null,
      chapterTitle: row.chapterTitle,
      chapterSlug: row.chapterSlug,
      subjectName: row.subjectName,
      subjectSlug: row.subjectSlug,
      semesterNumber,
      semesterTitle: row.semesterTitle,
      courseName: row.courseName,
      courseSlug: row.courseSlug,
      university: row.university,
      href,
    });
  } catch (e: any) {
    console.error('[courses] continue failed', e);
    res.status(500).json({ error: 'continue_failed' });
  }
});

/** GET /api/courses/my-books — textbooks this user may open */
router.get('/my-books', requireAuth, async (req: AuthRequest, res) => {
  try {
    const books = await listEntitledBooks(Number(req.user!.id));
    res.json({ books });
  } catch (e: any) {
    console.error('[courses] my-books failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

function sendBookAccessError(res: any, e: any) {
  if (e instanceof BookAccessError) {
    return res.status(e.status).json({ error: e.code, message: e.message });
  }
  console.error('[courses] session failed', e);
  return res.status(500).json({ error: 'session_failed' });
}

function bookHref(courseSlug: string, semesterNumber: number, subjectSlug: string) {
  return `/courses/${courseSlug}/sem-${semesterNumber}/${subjectSlug}`;
}

function numberPrice(v: unknown): number | null {
  if (v == null || v === '') return null;
  const amount = Number(v);
  return Number.isFinite(amount) ? amount : null;
}

/** GET /api/courses/subjects/:id/offer — catalog + price, no license required */
router.get('/subjects/:id/offer', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.price,
              sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.name AS courseName, c.slug AS courseSlug
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [id],
    );
    const s = rows?.[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    const ent = await resolveEntitlement(Number(req.user!.id), id, req.user?.isAdmin);
    const price = numberPrice(s.price);
    const href = bookHref(s.courseSlug, n(s.semesterNumber), s.slug);
    const canRead = !!ent.allowed;
    const purchasable = !canRead && price != null && price > 0;
    res.json({
      id: n(s.id),
      name: s.name,
      slug: s.slug,
      description: s.description,
      syllabusCode: s.syllabusCode,
      frontCoverUrl: s.coverKey ? publicFileUrlForKey(s.coverKey) : null,
      price,
      currency: 'INR',
      canRead,
      alreadyOwned: canRead && ent.accessModel !== 'OPEN',
      purchasable,
      accessModel: canRead ? ent.accessModel : null,
      href,
      buyHref: `${href}/buy`,
      course: { name: s.courseName, slug: s.courseSlug },
      semester: { number: n(s.semesterNumber), title: s.semesterTitle },
    });
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

/** POST /api/courses/subjects/:id/purchase — start individual checkout */
router.post('/subjects/:id/purchase', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT s.id, s.name, s.slug, s.price,
              sem.number AS semesterNumber, c.slug AS courseSlug
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [id],
    );
    const s = rows?.[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    const href = bookHref(s.courseSlug, n(s.semesterNumber), s.slug);
    const ent = await resolveEntitlement(Number(req.user!.id), id, req.user?.isAdmin);
    if (ent.allowed) {
      return res.status(409).json({
        error: 'already_owned',
        message: 'You already have access to this book.',
        href,
        accessModel: ent.accessModel,
      });
    }
    const price = numberPrice(s.price);
    if (price == null || price <= 0) {
      return res.status(400).json({
        error: 'not_for_sale',
        message: 'This book is not listed for individual purchase. Ask your college for a seat.',
      });
    }
    const checkout = await createBookCheckout({
      userId: Number(req.user!.id),
      subjectId: id,
      price,
    });
    res.status(201).json({ ...checkout, href });
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

/** POST /api/courses/subjects/:id/purchase/confirm — Razorpay signature */
router.post('/subjects/:id/purchase/confirm', requireAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  const orderId = n(req.body?.orderId);
  if (!id || !orderId) return res.status(400).json({ error: 'order_required' });
  try {
    const [rows]: any = await query(
      `SELECT s.slug, sem.number AS semesterNumber, c.slug AS courseSlug
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? LIMIT 1`,
      [id],
    );
    const href = rows?.[0]
      ? bookHref(rows[0].courseSlug, n(rows[0].semesterNumber), rows[0].slug)
      : '/courses';
    const result = await confirmBookRazorpayPayment({
      userId: Number(req.user!.id),
      subjectId: id,
      orderId,
      razorpay_payment_id: String(req.body?.razorpay_payment_id || ''),
      razorpay_order_id: String(req.body?.razorpay_order_id || ''),
      razorpay_signature: String(req.body?.razorpay_signature || ''),
    });
    res.json({ ok: true, href, ...result, accessModel: 'INDIVIDUAL' });
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

/** POST /api/courses/subjects/:id/purchase/:orderId/proof */
router.post(
  '/subjects/:id/purchase/:orderId/proof',
  requireAuth,
  memoryUpload.single('proof'),
  async (req: AuthRequest, res) => {
    const id = n(req.params.id);
    const orderId = n(req.params.orderId);
    const file = (req as any).file as
      | { buffer: Buffer; originalname: string; mimetype: string }
      | undefined;
    if (!file) return res.status(400).json({ error: 'file_required' });
    try {
      const storage = getStorageAdapter();
      const key = `payments/books/${orderId}/${Date.now()}-${file.originalname}`;
      const up = await storage.upload(key, file.buffer, file.mimetype);
      const proofId = await attachBookOrderProof({
        userId: Number(req.user!.id),
        subjectId: id,
        orderId,
        fileKey: up.key,
      });
      res.status(201).json({
        proofId,
        message: 'Proof uploaded. Access opens after VidhyaVibe confirms the payment.',
      });
    } catch (e: any) {
      sendBookAccessError(res, e);
    }
  },
);

/** GET /api/courses/subjects/:id/access */
router.get('/subjects/:id/access', requireAuth, async (req: AuthRequest, res) => {
  const subjectId = n(req.params.id);
  try {
    const ent = await resolveEntitlement(Number(req.user!.id), subjectId, req.user?.isAdmin);
    res.json(ent);
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

/** POST /api/courses/subjects/:id/session */
router.post('/subjects/:id/session', requireAuth, async (req: AuthRequest, res) => {
  const subjectId = n(req.params.id);
  try {
    const result = await acquireReadingSession({
      userId: Number(req.user!.id),
      subjectId,
      isAdmin: req.user?.isAdmin,
      deviceKey: String(req.body?.deviceKey || 'unknown'),
      deviceName: req.body?.deviceName || null,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']) : null,
      chapterId: req.body?.chapterId != null ? n(req.body.chapterId) : null,
      pageNumber: req.body?.pageNumber != null ? n(req.body.pageNumber) : null,
    });
    res.status(201).json(result);
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

router.post('/subjects/:id/session/heartbeat', requireAuth, async (req: AuthRequest, res) => {
  const sessionId = n(req.body?.sessionId);
  if (!sessionId) return res.status(400).json({ error: 'sessionId_required' });
  try {
    await heartbeatReadingSession({
      sessionId,
      userId: Number(req.user!.id),
      chapterId: req.body?.chapterId != null ? n(req.body.chapterId) : null,
      pageNumber: req.body?.pageNumber != null ? n(req.body.pageNumber) : null,
    });
    res.json({ ok: true });
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

router.post('/subjects/:id/session/release', requireAuth, async (req: AuthRequest, res) => {
  try {
    await releaseReadingSession(n(req.body?.sessionId), Number(req.user!.id), 'CLOSE');
    res.json({ ok: true });
  } catch (e: any) {
    sendBookAccessError(res, e);
  }
});

/** GET /api/courses/subjects/:id */
router.get('/subjects/:id', requireSubjectAccess, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const [rows]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.back_cover_key AS backCoverKey, s.file_key AS fileKey, s.pages, s.sort_order AS sortOrder,
              sem.id AS semesterId, sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.id AS courseId, c.name AS courseName, c.slug AS courseSlug, c.university
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [id],
    );
    const s = rows?.[0];
    if (!s) return res.status(404).json({ error: 'not_found' });

    const [chapters]: any = await query(
      `SELECT ch.id, ch.title, ch.slug, ch.sort_order AS sortOrder, ch.start_page AS startPage, ch.end_page AS endPage,
              (SELECT COUNT(*) FROM course_chapter_activities a WHERE a.chapter_id = ch.id) AS activityCount
       FROM course_chapters ch
       WHERE ch.subject_id = ?
       ORDER BY ch.sort_order ASC, ch.id ASC`,
      [id],
    );

    const [prog]: any = await query(
      `SELECT chapter_id AS chapterId, current_page AS currentPage, percent
       FROM course_progress WHERE user_id = ? AND subject_id = ? LIMIT 1`,
      [req.user!.id, id],
    );

    res.json({
      id: n(s.id),
      name: s.name,
      slug: s.slug,
      description: s.description,
      syllabusCode: s.syllabusCode,
      coverKey: s.coverKey,
      backCoverKey: s.backCoverKey,
      frontCoverUrl: s.coverKey ? publicFileUrlForKey(s.coverKey) : null,
      backCoverUrl: s.backCoverKey ? publicFileUrlForKey(s.backCoverKey) : null,
      pages: s.pages != null ? n(s.pages) : null,
      hasBookPdf: !!s.fileKey,
      pdfUrl: s.fileKey ? `/api/courses/subjects/${id}/pdf` : null,
      sortOrder: n(s.sortOrder),
      course: {
        id: n(s.courseId),
        name: s.courseName,
        slug: s.courseSlug,
        university: s.university,
      },
      semester: {
        id: n(s.semesterId),
        number: n(s.semesterNumber),
        title: s.semesterTitle,
      },
      chapters: (chapters || []).map((ch: any) => ({
        id: n(ch.id),
        title: ch.title,
        slug: ch.slug,
        sortOrder: n(ch.sortOrder),
        startPage: ch.startPage != null ? n(ch.startPage) : null,
        endPage: ch.endPage != null ? n(ch.endPage) : null,
        activityCount: n(ch.activityCount),
      })),
      progress: prog?.[0]
        ? {
            chapterId: prog[0].chapterId != null ? n(prog[0].chapterId) : null,
            currentPage: prog[0].currentPage != null ? n(prog[0].currentPage) : null,
            percent: prog[0].percent != null ? Number(prog[0].percent) : null,
          }
        : null,
    });
  } catch (e: any) {
    console.error('[courses] subject failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/subjects/:id/pdf */
router.get('/subjects/:id/pdf', requireSubjectAccess, async (req, res) => {
  const id = n(req.params.id);
  try {
    const [rows]: any = await query(
      `SELECT s.file_key AS fileKey
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE s.id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [id],
    );
    const s = rows?.[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (!s.fileKey) return res.status(404).json({ error: 'pdf_not_available' });
    const storage = getStorageAdapter();
    if (!storage.get) return res.status(400).json({ error: 'get_not_supported' });
    const data: any = await storage.get(s.fileKey);
    sendStorageBody(res, data, {
      contentType: 'application/pdf',
      disposition: 'inline; filename="course.pdf"',
      cacheControl: 'private, max-age=3600',
    });
  } catch (e: any) {
    console.error('[courses] pdf failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/chapters/:id */
router.get('/chapters/:id', requireChapterAccess, async (req, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const [rows]: any = await query(
      `SELECT ch.id, ch.title, ch.slug, ch.sort_order AS sortOrder, ch.start_page AS startPage,
              ch.end_page AS endPage, ch.content, ch.content_json AS contentJson, ch.content_format AS contentFormat,
              s.id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug, s.file_key AS fileKey,
              s.cover_key AS coverKey, s.back_cover_key AS backCoverKey,
              sem.number AS semesterNumber, sem.title AS semesterTitle,
              c.name AS courseName, c.slug AS courseSlug
       FROM course_chapters ch
       JOIN course_subjects s ON s.id = ch.subject_id
       JOIN course_semesters sem ON sem.id = s.semester_id
       JOIN courses c ON c.id = sem.course_id
       WHERE ch.id = ? AND ${publishedSubjectSql('s')} AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [id],
    );
    const ch = rows?.[0];
    if (!ch) return res.status(404).json({ error: 'not_found' });

    const [acts]: any = await query(
      `SELECT x.id AS linkId, x.page_number AS pageNumber, x.placement, x.sort_order AS sortOrder,
              a.id, a.title, a.description, a.activity_type AS activityType, a.difficulty,
              a.estimated_minutes AS estimatedMinutes, a.instructions, a.config,
              a.success_message AS successMessage, a.explanation, a.points, a.badge_label AS badgeLabel
       FROM course_chapter_activities x
       JOIN learn_activities a ON a.id = x.activity_id
       WHERE x.chapter_id = ? AND a.status = 'PUBLISHED'
       ORDER BY x.sort_order ASC, x.id ASC`,
      [id],
    );

    const doc = asDoc(ch.contentJson, {
      id: String(n(ch.id)),
      title: ch.title,
      html: ch.content || '',
    });
    const html = ch.contentFormat === 'json' ? jsonToHtml(doc) : ch.content || jsonToHtml(doc);
    const activities = (acts || []).map((a: any) => ({
      linkId: n(a.linkId),
      id: n(a.id),
      title: a.title,
      description: a.description,
      activityType: a.activityType,
      difficulty: a.difficulty,
      estimatedMinutes: n(a.estimatedMinutes),
      instructions: a.instructions,
      config: parseJson(a.config),
      successMessage: a.successMessage,
      explanation: a.explanation,
      points: n(a.points),
      badgeLabel: a.badgeLabel,
      pageNumber: a.pageNumber != null ? n(a.pageNumber) : null,
      placement: a.placement,
      sortOrder: n(a.sortOrder),
    }));

    res.json({
      id: n(ch.id),
      title: ch.title,
      slug: ch.slug,
      sortOrder: n(ch.sortOrder),
      startPage: ch.startPage != null ? n(ch.startPage) : null,
      endPage: ch.endPage != null ? n(ch.endPage) : null,
      content: rewriteCourseAssetUrls(html),
      contentFormat: ch.contentFormat || 'html',
      contentJson: doc,
      quickChecks: quickChecksFromDoc(doc),
      subject: {
        id: n(ch.subjectId),
        name: ch.subjectName,
        slug: ch.subjectSlug,
        hasBookPdf: !!ch.fileKey,
        pdfUrl: ch.fileKey ? `/api/courses/subjects/${n(ch.subjectId)}/pdf` : null,
        frontCoverUrl: ch.coverKey ? publicFileUrlForKey(ch.coverKey) : null,
        backCoverUrl: ch.backCoverKey ? publicFileUrlForKey(ch.backCoverKey) : null,
      },
      course: { name: ch.courseName, slug: ch.courseSlug },
      semester: { number: n(ch.semesterNumber), title: ch.semesterTitle },
      activities,
    });
  } catch (e: any) {
    console.error('[courses] chapter failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/notes — all notes for the signed-in user, with book/chapter metadata */
router.get('/notes', requireAuth, async (req: AuthRequest, res) => {
  const userId = n(req.user?.id);
  try {
    const [rows]: any = await query(
      `SELECT
         n.id,
         n.chapter_id AS chapterId,
         n.page_number AS pageNumber,
         n.content,
         n.quote,
         n.created_at AS createdAt,
         n.updated_at AS updatedAt,
         ch.title AS chapterTitle,
         ch.slug AS chapterSlug,
         s.name AS subjectName,
         s.slug AS subjectSlug,
         c.name AS courseName,
         c.slug AS courseSlug,
         sem.number AS semesterNumber
       FROM course_notes n
       INNER JOIN course_chapters ch ON ch.id = n.chapter_id
       INNER JOIN course_subjects s ON s.id = ch.subject_id
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       WHERE n.user_id = ?
       ORDER BY n.updated_at DESC`,
      [userId],
    );
    res.json({
      notes: (rows || []).map((r: any) => {
        const semesterNumber = n(r.semesterNumber);
        const pageNumber = r.pageNumber != null ? n(r.pageNumber) : null;
        const chapterQ = encodeURIComponent(String(r.chapterSlug || ''));
        const pageQ = pageNumber ? `&page=${pageNumber}` : '';
        const base = `/courses/${r.courseSlug}/sem-${semesterNumber}/${r.subjectSlug}`;
        return {
          id: n(r.id),
          chapterId: n(r.chapterId),
          pageNumber,
          content: r.content,
          quote: r.quote ? String(r.quote) : null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          chapterTitle: r.chapterTitle,
          chapterSlug: r.chapterSlug,
          subjectName: r.subjectName,
          subjectSlug: r.subjectSlug,
          courseName: r.courseName,
          courseSlug: r.courseSlug,
          semesterNumber,
          href: `${base}/read?chapter=${chapterQ}${pageQ}`,
          notesHref: `${base}/notes?chapter=${chapterQ}${pageQ}`,
        };
      }),
    });
  } catch (e: any) {
    console.error('[courses] notes list failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/:slug/catalog — textbooks + prices for subscribe */
router.get('/:slug/catalog', optionalAuth, async (req: AuthRequest, res) => {
  const slug = String(req.params.slug || '').trim();
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT c.id, c.name, c.slug, c.university, c.description, c.cover_key AS coverKey
       FROM courses c WHERE c.slug = ? AND ${publishedCourseSql('c')} LIMIT 1`,
      [slug],
    );
    const c = rows?.[0];
    if (!c) return res.status(404).json({ error: 'not_found' });

    const [books]: any = await query(
      `SELECT s.id, s.name, s.slug, s.syllabus_code AS syllabusCode, s.cover_key AS coverKey,
              s.price, s.sort_order AS sortOrder,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount,
              sem.number AS semesterNumber, sem.title AS semesterTitle
       FROM course_subjects s
       JOIN course_semesters sem ON sem.id = s.semester_id
       WHERE sem.course_id = ? AND ${publishedSubjectSql('s')}
       ORDER BY sem.number ASC, s.sort_order ASC, s.id ASC`,
      [c.id],
    );

    const userId = req.user?.id != null ? Number(req.user.id) : null;
    const mapped = [];
    for (const s of books || []) {
      const href = bookHref(c.slug, n(s.semesterNumber), s.slug);
      const price = numberPrice(s.price);
      let canRead = false;
      let accessModel: string | null = null;
      if (userId) {
        const ent = await resolveEntitlement(userId, n(s.id), req.user?.isAdmin);
        canRead = !!ent.allowed;
        accessModel = canRead ? ent.accessModel : null;
      }
      const purchasable = !canRead && price != null && price > 0;
      mapped.push({
        id: n(s.id),
        name: s.name,
        slug: s.slug,
        syllabusCode: s.syllabusCode,
        coverKey: s.coverKey,
        frontCoverUrl: s.coverKey ? publicFileUrlForKey(s.coverKey) : null,
        price,
        chapterCount: n(s.chapterCount),
        semesterNumber: n(s.semesterNumber),
        semesterTitle: s.semesterTitle,
        canRead,
        purchasable,
        accessModel,
        href,
        buyHref: `${href}/buy`,
      });
    }

    res.json({
      id: n(c.id),
      name: c.name,
      slug: c.slug,
      university: c.university,
      description: c.description,
      coverKey: c.coverKey,
      books: mapped,
    });
  } catch (e: any) {
    console.error('[courses] catalog failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/:slug */
router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  try {
    const [rows]: any = await query(
      `SELECT c.id, c.name, c.slug, c.university, c.description, c.cover_key AS coverKey, c.sort_order AS sortOrder
       FROM courses c WHERE c.slug = ? AND ${publishedCourseSql('c')} LIMIT 1`,
      [slug],
    );
    const c = rows?.[0];
    if (!c) return res.status(404).json({ error: 'not_found' });

    const [sems]: any = await query(
      `SELECT sem.id, sem.number, sem.title, sem.sort_order AS sortOrder,
              (SELECT COUNT(*) FROM course_subjects s
               WHERE s.semester_id = sem.id AND ${publishedSubjectSql('s')}) AS subjectCount
       FROM course_semesters sem
       WHERE sem.course_id = ?
       ORDER BY sem.number ASC, sem.id ASC`,
      [c.id],
    );

    res.json({
      id: n(c.id),
      name: c.name,
      slug: c.slug,
      university: c.university,
      description: c.description,
      coverKey: c.coverKey,
      sortOrder: n(c.sortOrder),
      semesters: (sems || []).map((s: any) => ({
        id: n(s.id),
        number: n(s.number),
        title: s.title,
        sortOrder: n(s.sortOrder),
        subjectCount: n(s.subjectCount),
      })),
    });
  } catch (e: any) {
    console.error('[courses] detail failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

/** GET /api/courses/:slug/semesters/:n */
router.get('/:slug/semesters/:n', optionalAuth, async (req: AuthRequest, res) => {
  const slug = String(req.params.slug || '').trim();
  const number = n(req.params.n);
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT c.id AS courseId, c.name AS courseName, c.slug AS courseSlug, c.university,
              sem.id AS semesterId, sem.number, sem.title
       FROM courses c
       JOIN course_semesters sem ON sem.course_id = c.id
       WHERE c.slug = ? AND sem.number = ? AND ${publishedCourseSql('c')}
       LIMIT 1`,
      [slug, number],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });

    const [subjects]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.sort_order AS sortOrder, s.price,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount
       FROM course_subjects s
       WHERE s.semester_id = ? AND ${publishedSubjectSql('s')}
       ORDER BY s.sort_order ASC, s.id ASC`,
      [row.semesterId],
    );

    const userId = req.user?.id != null ? Number(req.user.id) : null;
    const mapped = [];
    for (const s of subjects || []) {
      const price = numberPrice(s.price);
      let canRead = false;
      let accessModel: string | null = null;
      if (userId) {
        const ent = await resolveEntitlement(userId, n(s.id), req.user?.isAdmin);
        canRead = !!ent.allowed;
        accessModel = canRead ? ent.accessModel : null;
      }
      mapped.push({
        id: n(s.id),
        name: s.name,
        slug: s.slug,
        description: s.description,
        syllabusCode: s.syllabusCode,
        coverKey: s.coverKey,
        sortOrder: n(s.sortOrder),
        price,
        chapterCount: n(s.chapterCount),
        canRead,
        purchasable: !canRead && price != null && price > 0,
        accessModel,
      });
    }

    res.json({
      course: {
        id: n(row.courseId),
        name: row.courseName,
        slug: row.courseSlug,
        university: row.university,
      },
      semester: {
        id: n(row.semesterId),
        number: n(row.number),
        title: row.title,
      },
      subjects: mapped,
    });
  } catch (e: any) {
    console.error('[courses] semester failed', e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

export default router;

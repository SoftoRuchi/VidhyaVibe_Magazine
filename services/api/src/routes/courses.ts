import { Router } from 'express';
import { query } from '../db';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requireChapterAccess, requireSubjectAccess } from '../middleware/courseAccess';
import { optionalAuth } from '../middleware/optionalAuth';
import { memoryUpload } from '../middleware/upload';
import { getStorageAdapter } from '../providers/storage';
import {
  acquireReadingSession,
  applyListDiscount,
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
import { ensureShippingAddress } from '../services/guestBuyer';
import { publicFileUrlForKey, rewriteCourseAssetUrls } from '../utils/courseAssets';
import { compareChapters } from '../utils/courseChapters';
import { sendStorageBody } from '../utils/sendStorage';
import {
  asDoc,
  jsonToHtml,
  quickChecksFromDoc,
  stripImageFileNotes,
} from '../utils/textbookContent';

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

/** GET /api/courses/browse — public catalogue: course, semester, and book */
router.get('/browse', async (_req, res) => {
  try {
    const [rows]: any = await query(
      `SELECT c.id AS courseId, c.name AS courseName, c.slug AS courseSlug, c.university,
              c.description AS courseDescription, c.cover_key AS courseCover, c.sort_order AS courseSort,
              sem.number AS semesterNumber, sem.title AS semesterTitle,
              s.id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              s.description AS subjectDescription, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.price, s.discount_pct AS discountPct, s.sort_order AS subjectSort,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount,
              SUBSTRING(
                COALESCE((SELECT GROUP_CONCAT(ch.title SEPARATOR ' ') FROM course_chapters ch WHERE ch.subject_id = s.id), ''),
                1, 800
              ) AS chapterTitles
       FROM courses c
       LEFT JOIN course_semesters sem ON sem.course_id = c.id
       LEFT JOIN course_subjects s
         ON s.semester_id = sem.id AND ${publishedSubjectSql('s')}
       WHERE ${publishedCourseSql('c')}
       ORDER BY c.sort_order ASC, c.id ASC, sem.number ASC, s.sort_order ASC, s.id ASC`,
    );

    const courses: any[] = [];
    const byCourse = new Map<number, any>();
    for (const row of rows || []) {
      const courseId = n(row.courseId);
      let course = byCourse.get(courseId);
      if (!course) {
        course = {
          id: courseId,
          name: row.courseName,
          slug: row.courseSlug,
          university: row.university,
          description: row.courseDescription,
          coverKey: row.courseCover,
          semesters: [] as any[],
        };
        byCourse.set(courseId, course);
        courses.push(course);
      }
      if (row.semesterNumber == null || row.subjectId == null) continue;
      const semesterNumber = n(row.semesterNumber);
      let semester = course.semesters.find((s: any) => s.number === semesterNumber);
      if (!semester) {
        semester = { number: semesterNumber, title: row.semesterTitle, books: [] };
        course.semesters.push(semester);
      }
      const sale = salePrice(row.price, row.discountPct);
      const href = bookHref(row.courseSlug, semesterNumber, row.subjectSlug);
      const search = [
        row.subjectName,
        row.subjectDescription,
        row.syllabusCode,
        row.courseName,
        row.university,
        row.semesterTitle,
        row.chapterTitles,
      ]
        .filter(Boolean)
        .join(' ');
      semester.books.push({
        id: n(row.subjectId),
        name: row.subjectName,
        slug: row.subjectSlug,
        description: row.subjectDescription,
        syllabusCode: row.syllabusCode,
        coverKey: row.coverKey,
        frontCoverUrl: row.coverKey ? publicFileUrlForKey(row.coverKey) : null,
        price: sale.price,
        listPrice: sale.listPrice,
        discountPct: sale.discountPct,
        chapterCount: n(row.chapterCount),
        semesterNumber,
        semesterTitle: row.semesterTitle,
        courseName: row.courseName,
        courseSlug: row.courseSlug,
        university: row.university,
        href,
        buyHref: `${href}/buy`,
        purchasable: sale.price != null && sale.price > 0,
        search,
      });
    }

    res.json({ courses });
  } catch (e: any) {
    console.error('[courses] browse failed', e);
    res.status(500).json({ error: 'browse_failed', details: e?.message });
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

function salePrice(list: unknown, discountPct: unknown) {
  const listPrice = numberPrice(list);
  const pct = numberPrice(discountPct);
  const price = applyListDiscount(listPrice, pct);
  const onSale = listPrice != null && price != null && price < listPrice;
  return {
    listPrice: onSale ? listPrice : null,
    price,
    discountPct: onSale && pct && pct > 0 ? pct : null,
  };
}

function studentList(
  row: { price?: unknown; physicalPrice?: unknown; bothPrice?: unknown },
  format: string,
) {
  if (format === 'POD') return row.physicalPrice != null ? row.physicalPrice : row.price;
  if (format === 'BOTH') return row.bothPrice != null ? row.bothPrice : row.price;
  return row.price;
}

/** GET /api/courses/subjects/:id/offer — catalog + price, login not required */
router.get('/subjects/:id/offer', optionalAuth, async (req: AuthRequest, res) => {
  const id = n(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT s.id, s.name, s.slug, s.description, s.syllabus_code AS syllabusCode,
              s.cover_key AS coverKey, s.price, s.physical_price AS physicalPrice,
              s.both_price AS bothPrice, s.discount_pct AS discountPct,
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
    const userId = req.user?.id != null ? Number(req.user.id) : null;
    let canRead = false;
    let accessModel: string | null = null;
    if (userId) {
      const ent = await resolveEntitlement(userId, id, req.user?.isAdmin);
      canRead = !!ent.allowed;
      accessModel = canRead ? ent.accessModel : null;
    }
    const ebook = salePrice(studentList(s, 'EBOOK'), s.discountPct);
    const physical = salePrice(studentList(s, 'POD'), s.discountPct);
    const both = salePrice(studentList(s, 'BOTH'), s.discountPct);
    const href = bookHref(s.courseSlug, n(s.semesterNumber), s.slug);
    const purchasable =
      !canRead &&
      [ebook.price, physical.price, both.price].some((amount) => amount != null && amount > 0);
    res.json({
      id: n(s.id),
      name: s.name,
      slug: s.slug,
      description: s.description,
      syllabusCode: s.syllabusCode,
      frontCoverUrl: s.coverKey ? publicFileUrlForKey(s.coverKey) : null,
      price: ebook.price,
      listPrice: ebook.listPrice,
      discountPct: ebook.discountPct,
      formats: {
        EBOOK: ebook,
        POD: physical,
        BOTH: both,
      },
      currency: 'INR',
      canRead,
      alreadyOwned: canRead && accessModel !== 'OPEN',
      purchasable,
      accessModel,
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
      `SELECT s.id, s.name, s.slug, s.price, s.physical_price AS physicalPrice,
              s.both_price AS bothPrice, s.discount_pct AS discountPct,
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
    const rawFormat = String(req.body?.format || 'EBOOK').toUpperCase();
    const format = rawFormat === 'POD' || rawFormat === 'BOTH' ? rawFormat : 'EBOOK';
    const sale = salePrice(studentList(s, format), s.discountPct);
    if (sale.price == null || sale.price <= 0) {
      return res.status(400).json({
        error: 'not_for_sale',
        message: 'This book is not listed for individual purchase. Ask your college for a seat.',
      });
    }
    let shipping: { line1: string; city: string; state?: string; pincode: string } | null = null;
    if (format !== 'EBOOK') {
      const line1 = String(req.body?.deliveryAddress || '').trim();
      const city = String(req.body?.city || '').trim();
      const state = String(req.body?.state || '').trim();
      const pincode = String(req.body?.pincode || '').trim();
      if (line1.length < 8) {
        return res.status(400).json({
          error: 'delivery_address_required',
          message: 'Please enter your full delivery address.',
        });
      }
      if (!city) {
        return res.status(400).json({ error: 'city_required', message: 'Please enter your city.' });
      }
      if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
          error: 'pincode_required',
          message: 'Please enter a valid 6-digit PIN code.',
        });
      }
      shipping = { line1, city, state: state || undefined, pincode };
      await ensureShippingAddress({
        userId: Number(req.user!.id),
        line1,
        city,
        state: state || undefined,
        pincode,
      });
    }
    const checkout = await createBookCheckout({
      userId: Number(req.user!.id),
      subjectId: id,
      price: sale.price,
      format,
      shipping,
    });
    res.status(201).json({ ...checkout, href, format });
  } catch (e: any) {
    const code = e?.message;
    if (
      code === 'delivery_address_required' ||
      code === 'city_required' ||
      code === 'pincode_required'
    ) {
      return res.status(400).json({
        error: code,
        message: 'Please enter a complete delivery address for the printed book.',
      });
    }
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
      chapters: (chapters || []).sort(compareChapters).map((ch: any) => ({
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
    const html = stripImageFileNotes(
      ch.contentFormat === 'json' ? jsonToHtml(doc) : ch.content || jsonToHtml(doc),
    );
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
         s.id AS subjectId,
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
          subjectId: n(r.subjectId),
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
              s.price, s.discount_pct AS discountPct, s.sort_order AS sortOrder,
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
      const sale = salePrice(s.price, s.discountPct);
      let canRead = false;
      let accessModel: string | null = null;
      if (userId) {
        const ent = await resolveEntitlement(userId, n(s.id), req.user?.isAdmin);
        canRead = !!ent.allowed;
        accessModel = canRead ? ent.accessModel : null;
      }
      const purchasable = !canRead && sale.price != null && sale.price > 0;
      mapped.push({
        id: n(s.id),
        name: s.name,
        slug: s.slug,
        syllabusCode: s.syllabusCode,
        coverKey: s.coverKey,
        frontCoverUrl: s.coverKey ? publicFileUrlForKey(s.coverKey) : null,
        price: sale.price,
        listPrice: sale.listPrice,
        discountPct: sale.discountPct,
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
              s.cover_key AS coverKey, s.file_key AS fileKey, s.sort_order AS sortOrder,
              s.price, s.physical_price AS physicalPrice, s.both_price AS bothPrice,
              s.discount_pct AS discountPct,
              (SELECT COUNT(*) FROM course_chapters ch WHERE ch.subject_id = s.id) AS chapterCount
       FROM course_subjects s
       WHERE s.semester_id = ? AND ${publishedSubjectSql('s')}
       ORDER BY s.sort_order ASC, s.id ASC`,
      [row.semesterId],
    );

    const userId = req.user?.id != null ? Number(req.user.id) : null;
    const mapped = [];
    for (const s of subjects || []) {
      const ebook = salePrice(s.price, s.discountPct);
      const physical = salePrice(s.physicalPrice, s.discountPct);
      const both = salePrice(s.bothPrice, s.discountPct);
      let canRead = false;
      let accessModel: string | null = null;
      if (userId) {
        const ent = await resolveEntitlement(userId, n(s.id), req.user?.isAdmin);
        canRead = !!ent.allowed;
        accessModel = canRead ? ent.accessModel : null;
      }
      const priced = [ebook.price, physical.price, both.price].some(
        (amount) => amount != null && amount > 0,
      );
      mapped.push({
        id: n(s.id),
        name: s.name,
        slug: s.slug,
        description: s.description,
        syllabusCode: s.syllabusCode,
        coverKey: s.coverKey,
        sortOrder: n(s.sortOrder),
        price: ebook.price,
        listPrice: ebook.listPrice,
        discountPct: ebook.discountPct,
        ebookPrice: ebook.price,
        physicalPrice: physical.price,
        bothPrice: both.price,
        hasSample: !!s.fileKey,
        sampleUrl: s.fileKey ? publicFileUrlForKey(s.fileKey) : null,
        chapterCount: n(s.chapterCount),
        canRead,
        purchasable: !canRead && priced,
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

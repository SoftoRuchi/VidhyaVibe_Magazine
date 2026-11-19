import { Router } from 'express';
import { query } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import {
  assignStudentsToLot,
  BookAccessError,
  emailStudentLogin,
  ensureBookAccessTables,
  grantIndividualLicense,
  upsertUserByEmail,
} from '../../services/bookAccess';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function n(v: unknown): number {
  return Number(v);
}

router.get('/subjects', async (_req, res) => {
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT s.id, s.name, sem.number AS semesterNumber, c.name AS courseName, c.id AS courseId,
              s.price, s.book_bank_price AS bookBankPrice, s.library_price AS libraryPrice,
              s.discount_pct AS discountPct
       FROM course_subjects s
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       ORDER BY c.name ASC, sem.number ASC, s.sort_order ASC`,
    );
    res.json(
      (rows || []).map((r: any) => ({
        id: n(r.id),
        name: r.name,
        courseId: n(r.courseId),
        courseName: r.courseName,
        semesterNumber: n(r.semesterNumber),
        label: `${r.courseName} · Sem ${n(r.semesterNumber)} · ${r.name}`,
        price: r.price != null ? Number(r.price) : null,
        bookBankPrice: r.bookBankPrice != null ? Number(r.bookBankPrice) : null,
        libraryPrice: r.libraryPrice != null ? Number(r.libraryPrice) : null,
        discountPct: r.discountPct != null ? Number(r.discountPct) : null,
      })),
    );
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  }
});

router.post('/individual', async (req: AuthRequest, res) => {
  const subjectId = n(req.body?.subjectId);
  const email = String(req.body?.email || '').trim();
  if (!subjectId || !email) return res.status(400).json({ error: 'subject_and_email_required' });
  try {
    await ensureBookAccessTables();
    const user = await upsertUserByEmail({
      email,
      name: req.body?.name,
      password: req.body?.password,
    });
    const granted = await grantIndividualLicense({
      userId: user.id,
      subjectId,
      notes: req.body?.notes || null,
    });
    const [subs]: any = await query('SELECT name FROM course_subjects WHERE id = ? LIMIT 1', [
      subjectId,
    ]);
    const emailed = await emailStudentLogin({
      email: user.email,
      name: user.name,
      password: user.password || null,
      accountCreated: user.created,
      bookName: subs?.[0]?.name || null,
    });
    res.status(granted.created ? 201 : 200).json({
      lotId: granted.lotId,
      purchaseCode: granted.purchaseCode,
      created: granted.created,
      userId: user.id,
      email: user.email,
      emailed,
    });
  } catch (e: any) {
    if (e.status) return res.status(e.status).json({ error: e.code, message: e.message });
    console.error(e);
    res.status(500).json({ error: 'grant_failed' });
  }
});

router.get('/:lotId', async (req, res) => {
  const lotId = n(req.params.lotId);
  try {
    const [rows]: any = await query(
      `SELECT l.id, l.subject_id AS subjectId, l.access_model AS accessModel, l.institute_id AS instituteId,
              l.user_id AS userId, l.seat_count AS seatCount, l.purchase_code AS purchaseCode, l.status, l.notes,
              s.name AS subjectName
       FROM book_license_lots l
       INNER JOIN course_subjects s ON s.id = l.subject_id
       WHERE l.id = ? LIMIT 1`,
      [lotId],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    const [seats]: any = await query(
      `SELECT st.id, st.user_id AS userId, u.name, u.email, st.created_at AS createdAt
       FROM book_license_seats st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.lot_id = ?
       ORDER BY u.name ASC`,
      [lotId],
    );
    res.json({
      ...rows[0],
      id: n(rows[0].id),
      subjectId: n(rows[0].subjectId),
      seatCount: n(rows[0].seatCount),
      seats: (seats || []).map((s: any) => ({
        id: n(s.id),
        userId: n(s.userId),
        name: s.name,
        email: s.email,
        createdAt: s.createdAt,
      })),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

router.post('/:lotId/students', async (req, res) => {
  const lotId = n(req.params.lotId);
  const students = Array.isArray(req.body?.students) ? req.body.students : [];
  if (!students.length) return res.status(400).json({ error: 'students_required' });
  try {
    const result = await assignStudentsToLot(lotId, students);
    res.status(201).json({
      assigned: result.assigned,
      emailed: result.emailed,
      students: result.students,
    });
  } catch (e: any) {
    if (e instanceof BookAccessError) {
      return res.status(e.status).json({ error: e.code, message: e.message });
    }
    console.error(e);
    res.status(500).json({ error: 'assign_failed' });
  }
});

router.patch('/:lotId', async (req, res) => {
  const lotId = n(req.params.lotId);
  const status = String(req.body?.status || '').toUpperCase();
  if (!['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  try {
    await query('UPDATE book_license_lots SET status = ?, updated_at = NOW(3) WHERE id = ?', [
      status,
      lotId,
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

router.delete('/:lotId/seats/:seatId', async (req, res) => {
  try {
    await query('DELETE FROM book_license_seats WHERE id = ? AND lot_id = ?', [
      n(req.params.seatId),
      n(req.params.lotId),
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default router;

import { Router } from 'express';
import { query } from '../db';
import { sendActivityCsv, wantsCsv } from '../lib/activityCsv';
import { friendlyDeviceLabel } from '../lib/deviceLabel';
import { parseAppDate, toUtcIso } from '../lib/formatAppDateTime';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import {
  BookAccessError,
  adminEndReadingSession,
  assertInstituteAdmin,
  assignStudentsToLot,
  emailStudentLogin,
  ensureBookAccessTables,
  expireStaleSessions,
  listInstituteAdminInstitutes,
  upsertUserByEmail,
} from '../services/bookAccess';

const router = Router();
router.use(requireAuth);

function n(v: unknown): number {
  return Number(v);
}

function sendAccessError(res: any, e: any) {
  if (e instanceof BookAccessError) {
    return res.status(e.status).json({ error: e.code, message: e.message });
  }
  console.error('[institute]', e);
  return res.status(500).json({ error: 'institute_failed' });
}

function secondsBetween(start: unknown, end: unknown) {
  const a = parseAppDate(start)?.getTime() || 0;
  const b = parseAppDate(end)?.getTime() || Date.now();
  if (!a) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

const READING_SELECT = `SELECT rs.id, rs.user_id AS userId, u.name, u.email, rs.subject_id AS subjectId, s.name AS subjectName,
              c.name AS courseName, rs.access_model AS accessModel, rs.device_name AS deviceName, rs.ip_address AS ipAddress,
              rs.user_agent AS userAgent, ch.title AS chapterTitle, rs.page_number AS pageNumber,
              rs.started_at AS startedAt, rs.last_heartbeat_at AS lastHeartbeatAt,
              rs.ended_at AS endedAt, rs.end_reason AS endReason, rs.seconds_active AS secondsActive,
              (SELECT COUNT(*) FROM book_reading_sessions x
                WHERE x.user_id = rs.user_id AND x.subject_id = rs.subject_id) AS openCount
       FROM book_reading_sessions rs
       INNER JOIN users u ON u.id = rs.user_id
       INNER JOIN course_subjects s ON s.id = rs.subject_id
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       LEFT JOIN course_chapters ch ON ch.id = rs.chapter_id`;

function mapReading(r: any) {
  const { userAgent, ...rest } = r;
  return {
    ...rest,
    id: n(r.id),
    userId: n(r.userId),
    subjectId: n(r.subjectId),
    secondsActive: n(r.secondsActive),
    openCount: n(r.openCount),
    live: !r.endedAt,
    deviceName: friendlyDeviceLabel(r.deviceName, userAgent),
    startedAt: toUtcIso(r.startedAt),
    lastHeartbeatAt: toUtcIso(r.lastHeartbeatAt),
    endedAt: toUtcIso(r.endedAt),
  };
}

async function loadLogins(instituteId: number, limit = 200) {
  const cap = Math.min(5000, Math.max(1, limit));
  try {
    const [loginRows]: any = await query(
      `SELECT sess.id, sess.user_id AS userId, u.name, u.email,
              sess.device_name AS deviceName, sess.ip_address AS ipAddress, sess.user_agent AS userAgent,
              sess.created_at AS loggedInAt, sess.logged_out_at AS loggedOutAt, sess.last_seen_at AS lastSeenAt
       FROM sessions sess
       INNER JOIN users u ON u.id = sess.user_id
       INNER JOIN institute_members m ON m.user_id = sess.user_id AND m.institute_id = ?
       ORDER BY sess.created_at DESC
       LIMIT ${cap}`,
      [instituteId],
    );
    return loginRows || [];
  } catch {
    try {
      const [loginRows]: any = await query(
        `SELECT sess.id, sess.userId AS userId, u.name, u.email,
                sess.deviceName AS deviceName, sess.ipAddress AS ipAddress, sess.userAgent AS userAgent,
                sess.createdAt AS loggedInAt, sess.logged_out_at AS loggedOutAt, sess.last_seen_at AS lastSeenAt
         FROM sessions sess
         INNER JOIN users u ON u.id = sess.userId
         INNER JOIN institute_members m ON m.user_id = sess.userId AND m.institute_id = ?
         ORDER BY sess.createdAt DESC
         LIMIT ${cap}`,
        [instituteId],
      );
      return loginRows || [];
    } catch {
      return [];
    }
  }
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const institutes = await listInstituteAdminInstitutes(Number(req.user!.id));
    res.json({ institutes });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  const instituteId = n(req.params.id);
  try {
    await assertInstituteAdmin(Number(req.user!.id), instituteId);
    await expireStaleSessions();
    const [rows]: any = await query(
      `SELECT id, name, code, email, phone, city, status, created_at AS createdAt FROM institutes WHERE id = ? LIMIT 1`,
      [instituteId],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    const [members]: any = await query(
      `SELECT m.id, m.role, m.class_name AS className, m.roll_number AS rollNumber, m.created_at AS createdAt,
              u.id AS userId, u.name, u.email
       FROM institute_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.institute_id = ?
       ORDER BY u.name ASC`,
      [instituteId],
    );
    const [lots]: any = await query(
      `SELECT l.id, l.subject_id AS subjectId, l.access_model AS accessModel, l.seat_count AS seatCount,
              l.purchase_code AS purchaseCode, l.status, l.created_at AS createdAt,
              s.name AS subjectName, c.name AS courseName,
              (SELECT COUNT(*) FROM book_license_seats st WHERE st.lot_id = l.id) AS assignedSeats,
              (SELECT COUNT(*) FROM book_reading_sessions rs
                WHERE rs.lot_id = l.id AND rs.ended_at IS NULL
                  AND rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND)) AS liveReaders
       FROM book_license_lots l
       INNER JOIN course_subjects s ON s.id = l.subject_id
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       WHERE l.institute_id = ?
       ORDER BY l.created_at DESC`,
      [instituteId],
    );
    const [live]: any = await query(
      `${READING_SELECT}
       WHERE rs.institute_id = ?
         AND rs.ended_at IS NULL
         AND rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND)
       ORDER BY rs.last_heartbeat_at DESC`,
      [instituteId],
    );
    const [today]: any = await query(
      `SELECT COUNT(*) AS todayOpens, COUNT(DISTINCT user_id) AS todayReaders
       FROM book_reading_sessions
       WHERE institute_id = ? AND DATE(started_at) = CURDATE()`,
      [instituteId],
    );
    res.json({
      id: n(rows[0].id),
      name: rows[0].name,
      code: rows[0].code,
      email: rows[0].email,
      phone: rows[0].phone,
      city: rows[0].city,
      status: rows[0].status,
      createdAt: rows[0].createdAt,
      stats: {
        students: (members || []).filter((m: any) => m.role !== 'INSTITUTE_ADMIN').length,
        licenses: (lots || []).length,
        liveCount: (live || []).length,
        todayOpens: n(today?.[0]?.todayOpens || 0),
        todayReaders: n(today?.[0]?.todayReaders || 0),
      },
      live: (live || []).map(mapReading),
      members: (members || []).map((m: any) => ({
        id: n(m.id),
        userId: n(m.userId),
        name: m.name,
        email: m.email,
        role: m.role,
        className: m.className,
        rollNumber: m.rollNumber,
        createdAt: m.createdAt,
      })),
      lots: (lots || []).map((l: any) => ({
        id: n(l.id),
        subjectId: n(l.subjectId),
        subjectName: l.subjectName,
        courseName: l.courseName,
        accessModel: l.accessModel,
        seatCount: n(l.seatCount),
        assignedSeats: n(l.assignedSeats),
        liveReaders: n(l.liveReaders),
        remaining: Math.max(0, n(l.seatCount) - n(l.liveReaders)),
        full: l.accessModel === 'LIBRARY' && n(l.liveReaders) >= n(l.seatCount),
        purchaseCode: l.purchaseCode,
        status: l.status,
        createdAt: l.createdAt,
      })),
    });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

router.get('/:id/activity', async (req: AuthRequest, res) => {
  const instituteId = n(req.params.id);
  const csv = wantsCsv(req);
  const rowLimit = csv ? 5000 : 200;
  try {
    await assertInstituteAdmin(Number(req.user!.id), instituteId);
    await expireStaleSessions();
    const [sessions]: any = await query(
      `${READING_SELECT}
       WHERE rs.institute_id = ?
       ORDER BY COALESCE(rs.last_heartbeat_at, rs.started_at) DESC
       LIMIT ${rowLimit}`,
      [instituteId],
    );
    const logins = await loadLogins(instituteId, rowLimit);
    const reading = (sessions || []).map(mapReading);
    const loginRows = (logins || []).map((r: any) => {
      const { userAgent, ...rest } = r;
      return {
        ...rest,
        id: n(r.id),
        userId: n(r.userId),
        secondsActive: secondsBetween(r.loggedInAt, r.loggedOutAt || r.lastSeenAt),
        live: !r.loggedOutAt,
        deviceName: friendlyDeviceLabel(r.deviceName, userAgent),
        loggedInAt: toUtcIso(r.loggedInAt),
        lastSeenAt: toUtcIso(r.lastSeenAt),
        loggedOutAt: toUtcIso(r.loggedOutAt),
      };
    });
    if (csv) {
      sendActivityCsv(req, res, reading, loginRows, `college-${instituteId}`);
      return;
    }
    res.json({
      reading,
      logins: loginRows,
    });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

router.post('/:id/members', async (req: AuthRequest, res) => {
  const instituteId = n(req.params.id);
  const email = String(req.body?.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email_required' });
  try {
    await assertInstituteAdmin(Number(req.user!.id), instituteId);
    await ensureBookAccessTables();
    const user = await upsertUserByEmail({
      email,
      name: req.body?.name,
      password: req.body?.password,
    });
    await query(
      `INSERT INTO institute_members (institute_id, user_id, role, class_name, roll_number, created_at)
       VALUES (?, ?, 'STUDENT', ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE class_name = VALUES(class_name), roll_number = VALUES(roll_number)`,
      [instituteId, user.id, req.body?.className || null, req.body?.rollNumber || null],
    );
    const [inst]: any = await query('SELECT name FROM institutes WHERE id = ? LIMIT 1', [
      instituteId,
    ]);
    const emailed = await emailStudentLogin({
      email: user.email,
      name: user.name,
      password: user.password || null,
      accountCreated: user.created,
      collegeName: inst?.[0]?.name || null,
    });
    res.status(201).json({
      userId: user.id,
      email: user.email,
      created: user.created,
      emailed,
    });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

router.post('/:id/live/:sessionId/end', async (req: AuthRequest, res) => {
  const instituteId = n(req.params.id);
  const sessionId = n(req.params.sessionId);
  try {
    await assertInstituteAdmin(Number(req.user!.id), instituteId);
    const [rows]: any = await query(
      'SELECT id, institute_id AS instituteId FROM book_reading_sessions WHERE id = ? LIMIT 1',
      [sessionId],
    );
    if (!rows?.[0] || n(rows[0].instituteId) !== instituteId) {
      return res.status(404).json({ error: 'session_not_found' });
    }
    const result = await adminEndReadingSession(sessionId, 'ADMIN');
    res.json({ ok: true, ...result });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

router.post('/:id/lots/:lotId/students', async (req: AuthRequest, res) => {
  const instituteId = n(req.params.id);
  const lotId = n(req.params.lotId);
  const students = Array.isArray(req.body?.students) ? req.body.students : [];
  if (!students.length) return res.status(400).json({ error: 'students_required' });
  try {
    await assertInstituteAdmin(Number(req.user!.id), instituteId);
    const [lots]: any = await query(
      'SELECT id, institute_id AS instituteId FROM book_license_lots WHERE id = ? LIMIT 1',
      [lotId],
    );
    if (!lots?.[0] || n(lots[0].instituteId) !== instituteId) {
      return res.status(404).json({ error: 'lot_not_found' });
    }
    const result = await assignStudentsToLot(lotId, students);
    res.status(201).json({
      assigned: result.assigned,
      emailed: result.emailed,
      students: result.students,
    });
  } catch (e: any) {
    sendAccessError(res, e);
  }
});

export default router;

import crypto from 'crypto';
import { Router } from 'express';
import { query } from '../../db';
import { sendActivityCsv, wantsCsv } from '../../lib/activityCsv';
import { friendlyDeviceLabel } from '../../lib/deviceLabel';
import { parseAppDate, toUtcIso } from '../../lib/formatAppDateTime';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import {
  adminEndReadingSession,
  BookAccessError,
  emailStudentLogin,
  ensureBookAccessTables,
  expireStaleSessions,
  makePurchaseCode,
  upsertUserByEmail,
  type AccessModel,
} from '../../services/bookAccess';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function n(v: unknown): number {
  return Number(v);
}

function slugCode(name: string) {
  const base = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return (base || 'INST') + rand;
}

function mapInstitute(r: any) {
  return {
    id: n(r.id),
    name: r.name,
    code: r.code,
    email: r.email,
    phone: r.phone,
    city: r.city,
    status: r.status,
    memberCount: r.memberCount != null ? n(r.memberCount) : undefined,
    lotCount: r.lotCount != null ? n(r.lotCount) : undefined,
    createdAt: r.createdAt,
  };
}

function secondsBetween(start: unknown, end: unknown) {
  const a = parseAppDate(start)?.getTime() || 0;
  const b = parseAppDate(end)?.getTime() || Date.now();
  if (!a) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

function mapReading(r: any) {
  const { userAgent, ...rest } = r;
  return {
    ...rest,
    id: n(r.id),
    userId: n(r.userId),
    subjectId: n(r.subjectId),
    instituteId: r.instituteId != null ? n(r.instituteId) : null,
    secondsActive: n(r.secondsActive),
    openCount: n(r.openCount),
    live: !r.endedAt,
    deviceName: friendlyDeviceLabel(r.deviceName, userAgent),
    startedAt: toUtcIso(r.startedAt),
    lastHeartbeatAt: toUtcIso(r.lastHeartbeatAt),
    endedAt: toUtcIso(r.endedAt),
  };
}

function mapLogin(r: any) {
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
}

const READING_SELECT = `SELECT rs.id, rs.user_id AS userId, u.name, u.email, rs.subject_id AS subjectId, s.name AS subjectName,
              c.name AS courseName, i.name AS instituteName, rs.institute_id AS instituteId,
              rs.access_model AS accessModel, rs.device_name AS deviceName, rs.ip_address AS ipAddress,
              rs.user_agent AS userAgent,
              rs.chapter_id AS chapterId, ch.title AS chapterTitle, rs.page_number AS pageNumber,
              rs.started_at AS startedAt, rs.last_heartbeat_at AS lastHeartbeatAt,
              rs.ended_at AS endedAt, rs.end_reason AS endReason, rs.seconds_active AS secondsActive,
              (SELECT COUNT(*) FROM book_reading_sessions x
                WHERE x.user_id = rs.user_id AND x.subject_id = rs.subject_id) AS openCount
       FROM book_reading_sessions rs
       INNER JOIN users u ON u.id = rs.user_id
       INNER JOIN course_subjects s ON s.id = rs.subject_id
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       LEFT JOIN institutes i ON i.id = rs.institute_id
       LEFT JOIN course_chapters ch ON ch.id = rs.chapter_id`;

router.get('/', async (_req, res) => {
  try {
    await ensureBookAccessTables();
    const [rows]: any = await query(
      `SELECT i.id, i.name, i.code, i.email, i.phone, i.city, i.status, i.created_at AS createdAt,
              (SELECT COUNT(*) FROM institute_members m WHERE m.institute_id = i.id) AS memberCount,
              (SELECT COUNT(*) FROM book_license_lots l WHERE l.institute_id = i.id) AS lotCount
       FROM institutes i
       ORDER BY i.created_at DESC`,
    );
    res.json((rows || []).map(mapInstitute));
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  }
});

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  const code = String(req.body?.code || slugCode(name))
    .trim()
    .toUpperCase();
  try {
    await ensureBookAccessTables();
    const [ins]: any = await query(
      `INSERT INTO institutes (name, code, email, phone, city, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW(3), NOW(3))`,
      [name, code, req.body?.email || null, req.body?.phone || null, req.body?.city || null],
    );
    res.status(201).json({ id: n(ins.insertId), name, code });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'code_exists' });
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  }
});

router.get('/activity', async (req, res) => {
  const instituteId = req.query.instituteId ? n(req.query.instituteId) : 0;
  const subjectId = req.query.subjectId ? n(req.query.subjectId) : 0;
  const liveOnly = String(req.query.live || '') === '1';
  const q = String(req.query.q || '').trim();
  const csv = wantsCsv(req);
  const rowLimit = csv ? 5000 : 400;
  try {
    await ensureBookAccessTables();
    await expireStaleSessions();
    const where: string[] = [];
    const params: any[] = [];
    if (instituteId) {
      where.push('rs.institute_id = ?');
      params.push(instituteId);
    }
    if (subjectId) {
      where.push('rs.subject_id = ?');
      params.push(subjectId);
    }
    if (liveOnly) {
      where.push(
        'rs.ended_at IS NULL AND rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND)',
      );
    }
    if (q) {
      where.push('(u.email LIKE ? OR u.name LIKE ? OR s.name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [sessions]: any = await query(
      `${READING_SELECT}
       ${sqlWhere}
       ORDER BY COALESCE(rs.last_heartbeat_at, rs.started_at) DESC
       LIMIT ${rowLimit}`,
      params,
    );
    const [statsRows]: any = await query(
      `SELECT
         SUM(CASE WHEN rs.ended_at IS NULL AND rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND) THEN 1 ELSE 0 END) AS liveCount,
         COUNT(DISTINCT CASE WHEN DATE(rs.started_at) = CURDATE() THEN rs.user_id END) AS todayReaders,
         SUM(CASE WHEN DATE(rs.started_at) = CURDATE() THEN 1 ELSE 0 END) AS todayOpens,
         COUNT(DISTINCT rs.user_id) AS uniqueReaders
       FROM book_reading_sessions rs
       INNER JOIN users u ON u.id = rs.user_id
       INNER JOIN course_subjects s ON s.id = rs.subject_id
       ${sqlWhere}`,
      params,
    );
    let logins: any[] = [];
    const loginWhere: string[] = [];
    const loginParams: any[] = [];
    if (instituteId) {
      loginWhere.push(
        'EXISTS (SELECT 1 FROM institute_members m WHERE m.user_id = sess.user_id AND m.institute_id = ?)',
      );
      loginParams.push(instituteId);
    }
    if (q) {
      loginWhere.push('(u.email LIKE ? OR u.name LIKE ?)');
      loginParams.push(`%${q}%`, `%${q}%`);
    }
    const loginSqlWhere = loginWhere.length ? `WHERE ${loginWhere.join(' AND ')}` : '';
    try {
      const [loginRows]: any = await query(
        `SELECT sess.id, sess.user_id AS userId, u.name, u.email,
                sess.device_name AS deviceName, sess.ip_address AS ipAddress, sess.user_agent AS userAgent,
                sess.created_at AS loggedInAt, sess.logged_out_at AS loggedOutAt, sess.last_seen_at AS lastSeenAt,
                (SELECT GROUP_CONCAT(DISTINCT i.name SEPARATOR ', ')
                 FROM institute_members m INNER JOIN institutes i ON i.id = m.institute_id
                 WHERE m.user_id = sess.user_id) AS instituteName
         FROM sessions sess
         INNER JOIN users u ON u.id = sess.user_id
         ${loginSqlWhere}
         ORDER BY sess.created_at DESC
         LIMIT ${csv ? 5000 : 300}`,
        loginParams,
      );
      logins = loginRows || [];
    } catch {
      try {
        const [loginRows]: any = await query(
          `SELECT sess.id, sess.userId AS userId, u.name, u.email,
                  sess.deviceName AS deviceName, sess.ipAddress AS ipAddress, sess.userAgent AS userAgent,
                  sess.createdAt AS loggedInAt, sess.logged_out_at AS loggedOutAt, sess.last_seen_at AS lastSeenAt
           FROM sessions sess
           INNER JOIN users u ON u.id = sess.userId
           ${loginSqlWhere.replace(/sess\.user_id/g, 'sess.userId')}
           ORDER BY sess.createdAt DESC
           LIMIT ${csv ? 5000 : 300}`,
          loginParams,
        );
        logins = loginRows || [];
      } catch {
        logins = [];
      }
    }
    const stats = statsRows?.[0] || {};
    const reading = (sessions || []).map(mapReading);
    const loginRows = (logins || []).map(mapLogin);
    if (csv) {
      sendActivityCsv(req, res, reading, loginRows, 'book-activity');
      return;
    }
    res.json({
      stats: {
        liveCount: n(stats.liveCount || 0),
        todayReaders: n(stats.todayReaders || 0),
        todayOpens: n(stats.todayOpens || 0),
        uniqueReaders: n(stats.uniqueReaders || 0),
      },
      reading,
      logins: loginRows,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'activity_failed' });
  }
});

router.get('/live', async (req, res) => {
  const instituteId = req.query.instituteId ? n(req.query.instituteId) : 0;
  const subjectId = req.query.subjectId ? n(req.query.subjectId) : 0;
  try {
    await ensureBookAccessTables();
    await expireStaleSessions();
    const where = [
      'rs.ended_at IS NULL',
      'rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND)',
    ];
    const params: any[] = [];
    if (instituteId) {
      where.push('rs.institute_id = ?');
      params.push(instituteId);
    }
    if (subjectId) {
      where.push('rs.subject_id = ?');
      params.push(subjectId);
    }
    const [sessions]: any = await query(
      `${READING_SELECT}
       WHERE ${where.join(' AND ')}
       ORDER BY rs.last_heartbeat_at DESC
       LIMIT 400`,
      params,
    );
    const occWhere: string[] = [`l.status = 'ACTIVE'`];
    const occParams: any[] = [];
    if (instituteId) {
      occWhere.push('l.institute_id = ?');
      occParams.push(instituteId);
    }
    if (subjectId) {
      occWhere.push('l.subject_id = ?');
      occParams.push(subjectId);
    }
    const [occupancy]: any = await query(
      `SELECT l.id, l.access_model AS accessModel, l.seat_count AS seatCount, l.purchase_code AS purchaseCode,
              s.name AS subjectName, c.name AS courseName, i.name AS instituteName, l.institute_id AS instituteId,
              (SELECT COUNT(*) FROM book_reading_sessions rs
                WHERE rs.lot_id = l.id AND rs.ended_at IS NULL
                  AND rs.last_heartbeat_at >= DATE_SUB(NOW(3), INTERVAL 120 SECOND)) AS liveReaders
       FROM book_license_lots l
       INNER JOIN course_subjects s ON s.id = l.subject_id
       INNER JOIN course_semesters sem ON sem.id = s.semester_id
       INNER JOIN courses c ON c.id = sem.course_id
       LEFT JOIN institutes i ON i.id = l.institute_id
       WHERE ${occWhere.join(' AND ')}
       ORDER BY liveReaders DESC, c.name ASC, s.name ASC`,
      occParams,
    );
    res.json({
      readers: (sessions || []).map(mapReading),
      occupancy: (occupancy || []).map((r: any) => {
        const seatCount = n(r.seatCount);
        const liveReaders = n(r.liveReaders);
        return {
          id: n(r.id),
          accessModel: r.accessModel,
          subjectName: r.subjectName,
          courseName: r.courseName,
          instituteName: r.instituteName || 'Individual',
          instituteId: r.instituteId != null ? n(r.instituteId) : null,
          purchaseCode: r.purchaseCode,
          seatCount,
          liveReaders,
          remaining: Math.max(0, seatCount - liveReaders),
          full: r.accessModel === 'LIBRARY' && liveReaders >= seatCount,
        };
      }),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'live_failed' });
  }
});

router.post('/live/:sessionId/end', async (req, res) => {
  try {
    const result = await adminEndReadingSession(n(req.params.sessionId), 'ADMIN');
    res.json({ ok: true, ...result });
  } catch (e: any) {
    if (e instanceof BookAccessError) {
      return res.status(e.status).json({ error: e.code, message: e.message });
    }
    console.error(e);
    res.status(500).json({ error: 'end_failed' });
  }
});

router.get('/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    await ensureBookAccessTables();
    await expireStaleSessions();
    const [rows]: any = await query(
      `SELECT id, name, code, email, phone, city, status, created_at AS createdAt FROM institutes WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows?.[0]) return res.status(404).json({ error: 'not_found' });
    const [members]: any = await query(
      `SELECT m.id, m.role, m.class_name AS className, m.roll_number AS rollNumber, m.created_at AS createdAt,
              u.id AS userId, u.name, u.email
       FROM institute_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.institute_id = ?
       ORDER BY u.name ASC`,
      [id],
    );
    const [lots]: any = await query(
      `SELECT l.id, l.subject_id AS subjectId, l.access_model AS accessModel, l.seat_count AS seatCount,
              l.purchase_code AS purchaseCode, l.status, l.notes, l.created_at AS createdAt,
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
      [id],
    );
    res.json({
      ...mapInstitute(rows[0]),
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
        purchaseCode: l.purchaseCode,
        status: l.status,
        notes: l.notes,
        createdAt: l.createdAt,
      })),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

router.put('/:id', async (req, res) => {
  const id = n(req.params.id);
  try {
    await query(
      `UPDATE institutes SET name = ?, email = ?, phone = ?, city = ?, status = ?, updated_at = NOW(3) WHERE id = ?`,
      [
        String(req.body?.name || '').trim(),
        req.body?.email || null,
        req.body?.phone || null,
        req.body?.city || null,
        req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        id,
      ],
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

router.post('/:id/members', async (req, res) => {
  const instituteId = n(req.params.id);
  const email = String(req.body?.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email_required' });
  try {
    await ensureBookAccessTables();
    const user = await upsertUserByEmail({
      email,
      name: req.body?.name,
      password: req.body?.password,
    });
    await query(
      `INSERT INTO institute_members (institute_id, user_id, role, class_name, roll_number, created_at)
       VALUES (?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE role = VALUES(role), class_name = VALUES(class_name), roll_number = VALUES(roll_number)`,
      [
        instituteId,
        user.id,
        req.body?.role === 'INSTITUTE_ADMIN' ? 'INSTITUTE_ADMIN' : 'STUDENT',
        req.body?.className || null,
        req.body?.rollNumber || null,
      ],
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
    if (e.status) return res.status(e.status).json({ error: e.code, message: e.message });
    console.error(e);
    res.status(500).json({ error: 'add_member_failed' });
  }
});

router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    await query('DELETE FROM institute_members WHERE id = ? AND institute_id = ?', [
      n(req.params.memberId),
      n(req.params.id),
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

router.patch('/:id/members/:memberId', async (req, res) => {
  const role = String(req.body?.role || '').toUpperCase();
  if (role !== 'STUDENT' && role !== 'INSTITUTE_ADMIN') {
    return res.status(400).json({ error: 'invalid_role' });
  }
  try {
    const [upd]: any = await query(
      `UPDATE institute_members SET role = ? WHERE id = ? AND institute_id = ?`,
      [role, n(req.params.memberId), n(req.params.id)],
    );
    if (!upd?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, role });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'update_failed' });
  }
});

router.post('/:id/lots', async (req, res) => {
  const instituteId = n(req.params.id);
  const subjectId = n(req.body?.subjectId);
  const model = String(req.body?.accessModel || 'BOOK_BANK').toUpperCase() as AccessModel;
  const seatCount = Math.max(1, n(req.body?.seatCount || 1));
  if (!subjectId) return res.status(400).json({ error: 'subjectId_required' });
  if (model !== 'BOOK_BANK' && model !== 'LIBRARY') {
    return res.status(400).json({ error: 'invalid_access_model' });
  }
  try {
    await ensureBookAccessTables();
    const [inst]: any = await query('SELECT id, code FROM institutes WHERE id = ? LIMIT 1', [
      instituteId,
    ]);
    if (!inst?.[0]) return res.status(404).json({ error: 'institute_not_found' });
    const [sub]: any = await query('SELECT id FROM course_subjects WHERE id = ? LIMIT 1', [
      subjectId,
    ]);
    if (!sub?.[0]) return res.status(404).json({ error: 'subject_not_found' });
    const purchaseCode = makePurchaseCode(model, inst[0].code, subjectId);
    const [ins]: any = await query(
      `INSERT INTO book_license_lots
        (subject_id, access_model, institute_id, seat_count, purchase_code, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, NOW(3), NOW(3))`,
      [subjectId, model, instituteId, seatCount, purchaseCode, req.body?.notes || null],
    );
    res.status(201).json({
      id: n(ins.insertId),
      purchaseCode,
      accessModel: model,
      seatCount,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'create_lot_failed' });
  }
});

router.get('/:id/activity', async (req, res) => {
  const instituteId = n(req.params.id);
  const csv = wantsCsv(req);
  const rowLimit = csv ? 5000 : 200;
  try {
    await expireStaleSessions();
    const [sessions]: any = await query(
      `${READING_SELECT}
       WHERE rs.institute_id = ?
       ORDER BY rs.started_at DESC
       LIMIT ${rowLimit}`,
      [instituteId],
    );
    let logins: any[] = [];
    try {
      const [loginRows]: any = await query(
        `SELECT sess.id, sess.user_id AS userId, u.name, u.email,
                sess.device_name AS deviceName, sess.ip_address AS ipAddress, sess.user_agent AS userAgent,
                sess.created_at AS loggedInAt, sess.logged_out_at AS loggedOutAt, sess.last_seen_at AS lastSeenAt
         FROM sessions sess
         INNER JOIN users u ON u.id = sess.user_id
         INNER JOIN institute_members m ON m.user_id = sess.user_id AND m.institute_id = ?
         ORDER BY sess.created_at DESC
         LIMIT ${rowLimit}`,
        [instituteId],
      );
      logins = loginRows || [];
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
           LIMIT ${rowLimit}`,
          [instituteId],
        );
        logins = loginRows || [];
      } catch {
        logins = [];
      }
    }
    const reading = (sessions || []).map(mapReading);
    const loginRows = (logins || []).map(mapLogin);
    if (csv) {
      sendActivityCsv(req, res, reading, loginRows, `institute-${instituteId}`);
      return;
    }
    res.json({
      reading,
      logins: loginRows,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'activity_failed' });
  }
});

export default router;

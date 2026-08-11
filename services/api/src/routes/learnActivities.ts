import { Router } from 'express';
import { getPool } from '../db';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { evaluateActivity } from '../services/learnActivityEngine';

const router = Router();
router.use(optionalAuth);

function parseJson(v: unknown): any {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function mapPublic(row: any, extras: Record<string, unknown> = {}) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description ?? null,
    activityType: row.activityType,
    subjectId: row.subjectId != null ? Number(row.subjectId) : null,
    subjectName: row.subjectName ?? null,
    subjectSlug: row.subjectSlug ?? null,
    difficulty: row.difficulty,
    estimatedMinutes: Number(row.estimatedMinutes ?? 10),
    instructions: row.instructions ?? null,
    config: parseJson(row.config),
    successMessage: row.successMessage ?? null,
    explanation: row.explanation ?? null,
    points: Number(row.points ?? 10),
    badgeLabel: row.badgeLabel ?? null,
    status: row.status,
    publishedAt: row.publishedAt ?? null,
    ...extras,
  };
}

function ageToBand(age: number): string {
  if (age <= 10) return '8-10';
  if (age <= 13) return '11-13';
  if (age <= 16) return '14-16';
  return '17+';
}

async function loadBands(conn: any, activityId: number): Promise<string[]> {
  const [bands]: any = await conn.query(
    `SELECT age_band AS ageBand FROM learn_activity_age_bands WHERE activity_id = ?`,
    [activityId],
  );
  return (bands || []).map((b: any) => String(b.ageBand));
}

/** GET /api/learn/activities/subjects */
router.get('/subjects', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT id, name, slug FROM learn_subjects WHERE active = 1 ORDER BY sort_order ASC, id ASC`,
    );
    res.json({
      subjects: (rows || []).map((s: any) => ({
        id: Number(s.id),
        name: s.name,
        slug: s.slug,
      })),
    });
  } catch (err: any) {
    console.error('[learn/activities] subjects failed', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'subjects_failed',
        message: err?.message || 'Failed to load subjects',
      });
    }
  } finally {
    conn.release();
  }
});

/**
 * GET /api/learn/activities
 * Query: ageBand | age | subjectId | subjectSlug | activityType | difficulty
 */
router.get('/', async (req: AuthRequest, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    let ageBand = String(req.query.ageBand || '').trim();
    const age = req.query.age != null ? Number(req.query.age) : null;
    if (!ageBand && age != null && Number.isFinite(age)) ageBand = ageToBand(age);

    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const subjectSlug = String(req.query.subjectSlug || '').trim();
    const activityType = String(req.query.activityType || '').trim();
    const difficulty = String(req.query.difficulty || '').trim();
    const userId = req.user?.id ?? null;

    const where: string[] = [`a.status = 'PUBLISHED'`];
    const params: any[] = [];

    if (ageBand) {
      // Filter by assigned age bands only (publish requires at least one band).
      // Avoid joining age_groups here — MySQL reserved aliases / schema drift caused hangs.
      where.push(
        `EXISTS (
           SELECT 1 FROM learn_activity_age_bands b
           WHERE b.activity_id = a.id AND b.age_band = ?
         )`,
      );
      params.push(ageBand);
    }
    if (subjectId) {
      where.push('a.subject_id = ?');
      params.push(subjectId);
    }
    if (subjectSlug) {
      where.push('s.slug = ?');
      params.push(subjectSlug);
    }
    if (activityType) {
      where.push('a.activity_type = ?');
      params.push(activityType);
    }
    if (difficulty) {
      where.push('a.difficulty = ?');
      params.push(difficulty);
    }

    const [rows]: any = await conn.query(
      `SELECT a.id, a.title, a.description, a.activity_type AS activityType,
              a.subject_id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              a.difficulty, a.estimated_minutes AS estimatedMinutes, a.instructions,
              a.config, a.success_message AS successMessage, a.explanation,
              a.points, a.badge_label AS badgeLabel, a.status, a.published_at AS publishedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT 100`,
      params,
    );

    const items = [];
    for (const row of rows || []) {
      const bands = await loadBands(conn, Number(row.id));
      let progressStatus = 'NOT_STARTED';
      let pointsEarned = 0;
      if (userId) {
        const [prog]: any = await conn.query(
          `SELECT status, points_earned AS pointsEarned FROM learn_activity_progress
           WHERE user_id = ? AND activity_id = ? ORDER BY id DESC LIMIT 1`,
          [userId, Number(row.id)],
        );
        if (prog?.[0]) {
          progressStatus = prog[0].status;
          pointsEarned = Number(prog[0].pointsEarned ?? 0);
        }
      }
      // Strip heavy config from list — client loads detail for play
      const { config: _c, ...rest } = mapPublic(row, {
        ageBands: bands,
        progressStatus,
        pointsEarned,
      });
      items.push(rest);
    }

    res.json({ items, ageBand: ageBand || null });
  } catch (err: any) {
    console.error('[learn/activities] list failed', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'list_failed',
        message: err?.message || 'Failed to load activities',
      });
    }
  } finally {
    conn.release();
  }
});

/** GET /api/learn/activities/me/progress */
router.get('/me/progress', requireAuth, async (req: AuthRequest, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT p.id, p.activity_id AS activityId, a.title, a.activity_type AS activityType,
              p.status, p.score, p.attempts, p.points_earned AS pointsEarned,
              p.result_status AS resultStatus, p.result_message AS resultMessage,
              p.started_at AS startedAt, p.completed_at AS completedAt, p.time_spent_sec AS timeSpentSec
       FROM learn_activity_progress p
       JOIN learn_activities a ON a.id = p.activity_id
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC
       LIMIT 100`,
      [req.user!.id],
    );
    res.json({
      items: (rows || []).map((r: any) => ({
        id: Number(r.id),
        activityId: Number(r.activityId),
        title: r.title,
        activityType: r.activityType,
        status: r.status,
        score: r.score != null ? Number(r.score) : null,
        attempts: Number(r.attempts ?? 0),
        pointsEarned: Number(r.pointsEarned ?? 0),
        resultStatus: r.resultStatus,
        resultMessage: r.resultMessage,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        timeSpentSec: r.timeSpentSec,
      })),
    });
  } finally {
    conn.release();
  }
});

/** GET /api/learn/activities/:id */
router.get('/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT a.id, a.title, a.description, a.activity_type AS activityType,
              a.subject_id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              a.difficulty, a.estimated_minutes AS estimatedMinutes, a.instructions,
              a.config, a.success_message AS successMessage, a.explanation,
              a.points, a.badge_label AS badgeLabel, a.status, a.published_at AS publishedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE a.id = ? AND a.status = 'PUBLISHED'
       LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const bands = await loadBands(conn, id);
    let progress = null;
    if (req.user?.id) {
      const [prog]: any = await conn.query(
        `SELECT status, score, attempts, points_earned AS pointsEarned, result_status AS resultStatus
         FROM learn_activity_progress WHERE user_id = ? AND activity_id = ? ORDER BY id DESC LIMIT 1`,
        [req.user.id, id],
      );
      if (prog?.[0]) {
        progress = {
          status: prog[0].status,
          score: prog[0].score != null ? Number(prog[0].score) : null,
          attempts: Number(prog[0].attempts ?? 0),
          pointsEarned: Number(prog[0].pointsEarned ?? 0),
          resultStatus: prog[0].resultStatus,
        };
      }
    }
    res.json(mapPublic(row, { ageBands: bands, progress }));
  } finally {
    conn.release();
  }
});

/** POST /api/learn/activities/:id/start */
router.post('/:id/start', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const readerId = req.body?.readerId != null ? Number(req.body.readerId) : null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [acts]: any = await conn.query(
      `SELECT id FROM learn_activities WHERE id = ? AND status = 'PUBLISHED' LIMIT 1`,
      [id],
    );
    if (!acts?.[0]) return res.status(404).json({ error: 'not_found' });

    const [existing]: any = await conn.query(
      `SELECT id, status, attempts FROM learn_activity_progress
       WHERE user_id = ? AND activity_id = ? AND ${readerId == null ? 'reader_id IS NULL' : 'reader_id = ?'}
       LIMIT 1`,
      readerId == null ? [req.user!.id, id] : [req.user!.id, id, readerId],
    );

    if (existing?.[0]) {
      await conn.query(
        `UPDATE learn_activity_progress
         SET status = IF(status = 'COMPLETED', status, 'IN_PROGRESS'),
             attempts = attempts + 1,
             started_at = COALESCE(started_at, NOW(3)),
             updated_at = NOW(3)
         WHERE id = ?`,
        [existing[0].id],
      );
      return res.json({ ok: true, progressId: Number(existing[0].id), status: 'IN_PROGRESS' });
    }

    const [ins]: any = await conn.query(
      `INSERT INTO learn_activity_progress
        (user_id, reader_id, activity_id, status, attempts, started_at, created_at, updated_at)
       VALUES (?, ?, ?, 'IN_PROGRESS', 1, NOW(3), NOW(3), NOW(3))`,
      [req.user!.id, readerId, id],
    );
    res.json({ ok: true, progressId: Number(ins.insertId), status: 'IN_PROGRESS' });
  } finally {
    conn.release();
  }
});

/** POST /api/learn/activities/:id/complete */
router.post('/:id/complete', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const readerId = req.body?.readerId != null ? Number(req.body.readerId) : null;
  const response = (req.body?.response && typeof req.body.response === 'object'
    ? req.body.response
    : {}) as Record<string, any>;
  const timeSpentSec =
    req.body?.timeSpentSec != null ? Number(req.body.timeSpentSec) : null;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [acts]: any = await conn.query(
      `SELECT id, activity_type AS activityType, config, success_message AS successMessage,
              explanation, points
       FROM learn_activities WHERE id = ? AND status = 'PUBLISHED' LIMIT 1`,
      [id],
    );
    const act = acts?.[0];
    if (!act) return res.status(404).json({ error: 'not_found' });

    const result = evaluateActivity({
      activityType: act.activityType,
      config: parseJson(act.config),
      response,
      successMessage: act.successMessage,
      explanation: act.explanation,
      points: Number(act.points ?? 10),
    });

    const completed =
      result.resultStatus === 'CORRECT' ||
      result.resultStatus === 'COMPLETED_SUCCESS' ||
      result.resultStatus === 'COMPLETED_CREATIVE' ||
      result.resultStatus === 'PARTIAL';

    const [existing]: any = await conn.query(
      `SELECT id, attempts FROM learn_activity_progress
       WHERE user_id = ? AND activity_id = ? AND ${readerId == null ? 'reader_id IS NULL' : 'reader_id = ?'}
       LIMIT 1`,
      readerId == null ? [req.user!.id, id] : [req.user!.id, id, readerId],
    );

    let progressId: number;
    if (existing?.[0]) {
      progressId = Number(existing[0].id);
      await conn.query(
        `UPDATE learn_activity_progress SET
           status = ?, score = ?, attempts = attempts + 1,
           points_earned = ?, result_status = ?, result_message = ?,
           response_payload = ?,
           completed_at = IF(?, NOW(3), completed_at),
           time_spent_sec = COALESCE(?, time_spent_sec),
           updated_at = NOW(3)
         WHERE id = ?`,
        [
          completed ? 'COMPLETED' : 'IN_PROGRESS',
          result.score,
          result.pointsEarned,
          result.resultStatus,
          result.resultMessage,
          JSON.stringify(response),
          completed ? 1 : 0,
          timeSpentSec,
          progressId,
        ],
      );
    } else {
      const [ins]: any = await conn.query(
        `INSERT INTO learn_activity_progress
          (user_id, reader_id, activity_id, status, score, attempts, points_earned,
           result_status, result_message, response_payload, started_at, completed_at,
           time_spent_sec, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW(3), IF(?, NOW(3), NULL), ?, NOW(3), NOW(3))`,
        [
          req.user!.id,
          readerId,
          id,
          completed ? 'COMPLETED' : 'IN_PROGRESS',
          result.score,
          result.pointsEarned,
          result.resultStatus,
          result.resultMessage,
          JSON.stringify(response),
          completed ? 1 : 0,
          timeSpentSec,
        ],
      );
      progressId = Number(ins.insertId);
    }

    if (completed) {
      await conn.query(
        `UPDATE learn_activities SET completion_count = completion_count + 1 WHERE id = ?`,
        [id],
      );
    }

    res.json({
      ok: true,
      progressId,
      ...result,
      badgeLabel: null,
    });
  } finally {
    conn.release();
  }
});

export default router;

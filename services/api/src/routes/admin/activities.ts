import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import {
  LEARN_AGE_BANDS,
  LEARN_DIFFICULTIES,
  LEARN_STATUSES,
  canPublishActivity,
  isLearnActivityType,
  listActivityTypeMeta,
  validateActivityConfig,
} from '../../services/learnActivityEngine';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function parseJson(v: unknown): any {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function mapActivity(row: any, extras: Record<string, unknown> = {}) {
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
    createdBy: row.createdBy != null ? Number(row.createdBy) : null,
    publishedAt: row.publishedAt ?? null,
    completionCount: Number(row.completionCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  };
}

async function loadAgeMeta(conn: any, activityId: number) {
  const [bands]: any = await conn.query(
    `SELECT age_band AS ageBand FROM learn_activity_age_bands WHERE activity_id = ?`,
    [activityId],
  );
  const [groups]: any = await conn.query(
    `SELECT ag.id, ag.name, ag.slug, ag.minAge, ag.maxAge
     FROM learn_activity_age_groups laag
     JOIN age_groups ag ON ag.id = laag.age_group_id
     WHERE laag.activity_id = ?`,
    [activityId],
  );
  return {
    ageBands: (bands || []).map((b: any) => String(b.ageBand)),
    ageGroups: (groups || []).map((g: any) => ({
      id: Number(g.id),
      name: g.name,
      slug: g.slug,
      minAge: g.minAge,
      maxAge: g.maxAge,
    })),
    ageGroupIds: (groups || []).map((g: any) => Number(g.id)),
  };
}

async function replaceAges(
  conn: any,
  activityId: number,
  ageBands: string[],
  ageGroupIds: number[],
) {
  await conn.query(`DELETE FROM learn_activity_age_bands WHERE activity_id = ?`, [activityId]);
  await conn.query(`DELETE FROM learn_activity_age_groups WHERE activity_id = ?`, [activityId]);
  for (const band of ageBands) {
    if (!(LEARN_AGE_BANDS as readonly string[]).includes(band) && !/^\d/.test(band)) continue;
    await conn.query(
      `INSERT INTO learn_activity_age_bands (activity_id, age_band) VALUES (?, ?)`,
      [activityId, band],
    );
  }
  for (const gid of ageGroupIds) {
    if (!Number.isFinite(gid)) continue;
    await conn.query(
      `INSERT INTO learn_activity_age_groups (activity_id, age_group_id) VALUES (?, ?)`,
      [activityId, gid],
    );
  }
}

/** GET /api/admin/activities/meta */
router.get('/meta', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [subjects]: any = await conn.query(
      `SELECT id, name, slug, sort_order AS sortOrder, active
       FROM learn_subjects WHERE active = 1 ORDER BY sort_order ASC, id ASC`,
    );
    const [ageGroups]: any = await conn.query(
      `SELECT id, name, slug, minAge, maxAge, active FROM age_groups WHERE active = 1 ORDER BY sortOrder ASC, id ASC`,
    );
    res.json({
      activityTypes: listActivityTypeMeta(),
      difficulties: LEARN_DIFFICULTIES.map((d) => ({ id: d, label: d })),
      statuses: LEARN_STATUSES.map((s) => ({ id: s, label: s })),
      ageBands: LEARN_AGE_BANDS.map((b) => ({ id: b, label: b === '17+' ? '17+' : `Ages ${b}` })),
      subjects: (subjects || []).map((s: any) => ({
        id: Number(s.id),
        name: s.name,
        slug: s.slug,
        sortOrder: Number(s.sortOrder ?? 0),
      })),
      ageGroups: (ageGroups || []).map((g: any) => ({
        id: Number(g.id),
        name: g.name,
        slug: g.slug,
        minAge: g.minAge,
        maxAge: g.maxAge,
      })),
    });
  } finally {
    conn.release();
  }
});

/** GET /api/admin/activities/stats */
router.get('/stats', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [[totals]]: any = await conn.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'PUBLISHED') AS published,
         SUM(status = 'DRAFT') AS draft,
         SUM(status = 'ARCHIVED') AS archived,
         SUM(completion_count) AS completions
       FROM learn_activities`,
    );
    const [popular]: any = await conn.query(
      `SELECT id, title, activity_type AS activityType, completion_count AS completionCount
       FROM learn_activities ORDER BY completion_count DESC, id DESC LIMIT 8`,
    );
    res.json({
      total: Number(totals?.total ?? 0),
      published: Number(totals?.published ?? 0),
      draft: Number(totals?.draft ?? 0),
      archived: Number(totals?.archived ?? 0),
      completions: Number(totals?.completions ?? 0),
      popular: (popular || []).map((r: any) => ({
        id: Number(r.id),
        title: r.title,
        activityType: r.activityType,
        completionCount: Number(r.completionCount ?? 0),
      })),
    });
  } finally {
    conn.release();
  }
});

/** GET /api/admin/activities */
router.get('/', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const activityType = String(req.query.activityType || '').trim();
    const difficulty = String(req.query.difficulty || '').trim();
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const ageBand = String(req.query.ageBand || '').trim();

    const where: string[] = ['1=1'];
    const params: any[] = [];
    if (q) {
      where.push('(a.title LIKE ? OR a.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) {
      where.push('a.status = ?');
      params.push(status);
    }
    if (activityType) {
      where.push('a.activity_type = ?');
      params.push(activityType);
    }
    if (difficulty) {
      where.push('a.difficulty = ?');
      params.push(difficulty);
    }
    if (subjectId) {
      where.push('a.subject_id = ?');
      params.push(subjectId);
    }
    if (ageBand) {
      where.push(
        `EXISTS (SELECT 1 FROM learn_activity_age_bands b WHERE b.activity_id = a.id AND b.age_band = ?)`,
      );
      params.push(ageBand);
    }

    const [rows]: any = await conn.query(
      `SELECT a.id, a.title, a.description, a.activity_type AS activityType,
              a.subject_id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              a.difficulty, a.estimated_minutes AS estimatedMinutes, a.instructions,
              a.config, a.success_message AS successMessage, a.explanation,
              a.points, a.badge_label AS badgeLabel, a.status,
              a.created_by AS createdBy, a.published_at AS publishedAt,
              a.completion_count AS completionCount,
              a.created_at AS createdAt, a.updated_at AS updatedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.updated_at DESC, a.id DESC
       LIMIT 200`,
      params,
    );

    const items = [];
    for (const row of rows || []) {
      const ages = await loadAgeMeta(conn, Number(row.id));
      items.push(mapActivity(row, ages));
    }
    res.json({ items });
  } catch (e: any) {
    console.error('[admin/activities GET]', e);
    const code = e?.code || e?.errno;
    if (code === 'ER_NO_SUCH_TABLE' || code === 1146) {
      return res.status(503).json({
        error: 'migration_required',
        message:
          'Learn activity tables are missing. Run packages/db/migrations/20260810_learn_activities_platform.sql on the database.',
      });
    }
    return res.status(500).json({
      error: 'list_failed',
      message: e?.sqlMessage || e?.message || 'Failed to list activities',
    });
  } finally {
    conn.release();
  }
});

/** GET /api/admin/activities/:id */
router.get('/:id', async (req, res) => {
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
              a.points, a.badge_label AS badgeLabel, a.status,
              a.created_by AS createdBy, a.published_at AS publishedAt,
              a.completion_count AS completionCount,
              a.created_at AS createdAt, a.updated_at AS updatedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE a.id = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const ages = await loadAgeMeta(conn, id);
    res.json(mapActivity(row, ages));
  } finally {
    conn.release();
  }
});

function parseBody(body: any) {
  const title = String(body?.title || '').trim();
  const description = body?.description != null ? String(body.description) : null;
  const activityType = String(body?.activityType || '').trim();
  const subjectId = body?.subjectId != null && body.subjectId !== '' ? Number(body.subjectId) : null;
  const difficulty = String(body?.difficulty || 'Easy').trim();
  const estimatedMinutes = Number(body?.estimatedMinutes ?? 10) || 10;
  const instructions = body?.instructions != null ? String(body.instructions) : null;
  const config =
    typeof body?.config === 'string' ? parseJson(body.config) : body?.config && typeof body.config === 'object'
      ? body.config
      : {};
  const successMessage = body?.successMessage != null ? String(body.successMessage) : null;
  const explanation = body?.explanation != null ? String(body.explanation) : null;
  const points = Number(body?.points ?? 10) || 10;
  const badgeLabel = body?.badgeLabel != null ? String(body.badgeLabel) : null;
  const ageBands = Array.isArray(body?.ageBands) ? body.ageBands.map(String) : [];
  const ageGroupIds = Array.isArray(body?.ageGroupIds)
    ? body.ageGroupIds.map(Number).filter((n: number) => Number.isFinite(n))
    : [];
  return {
    title,
    description,
    activityType,
    subjectId,
    difficulty,
    estimatedMinutes,
    instructions,
    config,
    successMessage,
    explanation,
    points,
    badgeLabel,
    ageBands,
    ageGroupIds,
  };
}

/** POST /api/admin/activities */
router.post('/', async (req: AuthRequest, res) => {
  const data = parseBody(req.body);
  if (!data.title) return res.status(400).json({ error: 'title_required' });
  if (!isLearnActivityType(data.activityType)) {
    return res.status(400).json({ error: 'invalid_activity_type' });
  }
  const configIssues = validateActivityConfig(data.activityType, data.config);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const configJson = JSON.stringify(data.config || {});
    const [result]: any = await conn.query(
      `INSERT INTO learn_activities
        (title, description, activity_type, subject_id, difficulty, estimated_minutes,
         instructions, config, success_message, explanation, points, badge_label,
         status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, NOW(3), NOW(3))`,
      [
        data.title,
        data.description,
        data.activityType,
        data.subjectId,
        (LEARN_DIFFICULTIES as readonly string[]).includes(data.difficulty)
          ? data.difficulty
          : 'Easy',
        data.estimatedMinutes,
        data.instructions,
        configJson,
        data.successMessage,
        data.explanation,
        data.points,
        data.badgeLabel,
        req.user?.id ?? null,
      ],
    );
    const id = Number(result.insertId);
    await replaceAges(conn, id, data.ageBands, data.ageGroupIds);
    const [rows]: any = await conn.query(
      `SELECT a.id, a.title, a.description, a.activity_type AS activityType,
              a.subject_id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              a.difficulty, a.estimated_minutes AS estimatedMinutes, a.instructions,
              a.config, a.success_message AS successMessage, a.explanation,
              a.points, a.badge_label AS badgeLabel, a.status,
              a.created_by AS createdBy, a.published_at AS publishedAt,
              a.completion_count AS completionCount,
              a.created_at AS createdAt, a.updated_at AS updatedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE a.id = ?`,
      [id],
    );
    const ages = await loadAgeMeta(conn, id);
    res.status(201).json({
      ...mapActivity(rows[0], ages),
      configWarnings: configIssues,
    });
  } catch (e: any) {
    console.error('[admin/activities POST]', e);
    const code = e?.code || e?.errno;
    if (code === 'ER_NO_SUCH_TABLE' || code === 1146) {
      return res.status(503).json({
        error: 'migration_required',
        message:
          'Learn activity tables are missing. Run packages/db/migrations/20260810_learn_activities_platform.sql on the database.',
      });
    }
    return res.status(500).json({
      error: 'create_failed',
      message: e?.sqlMessage || e?.message || 'Failed to create activity',
      code,
    });
  } finally {
    conn.release();
  }
});

/** PUT /api/admin/activities/:id */
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const data = parseBody(req.body);
  if (!data.title) return res.status(400).json({ error: 'title_required' });
  if (!isLearnActivityType(data.activityType)) {
    return res.status(400).json({ error: 'invalid_activity_type' });
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [existing]: any = await conn.query(
      `SELECT id, status FROM learn_activities WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!existing?.[0]) return res.status(404).json({ error: 'not_found' });

    await conn.query(
      `UPDATE learn_activities SET
         title = ?, description = ?, activity_type = ?, subject_id = ?, difficulty = ?,
         estimated_minutes = ?, instructions = ?, config = ?,
         success_message = ?, explanation = ?, points = ?, badge_label = ?,
         updated_at = NOW(3)
       WHERE id = ?`,
      [
        data.title,
        data.description,
        data.activityType,
        data.subjectId,
        (LEARN_DIFFICULTIES as readonly string[]).includes(data.difficulty)
          ? data.difficulty
          : 'Easy',
        data.estimatedMinutes,
        data.instructions,
        JSON.stringify(data.config || {}),
        data.successMessage,
        data.explanation,
        data.points,
        data.badgeLabel,
        id,
      ],
    );
    await replaceAges(conn, id, data.ageBands, data.ageGroupIds);

    const [rows]: any = await conn.query(
      `SELECT a.id, a.title, a.description, a.activity_type AS activityType,
              a.subject_id AS subjectId, s.name AS subjectName, s.slug AS subjectSlug,
              a.difficulty, a.estimated_minutes AS estimatedMinutes, a.instructions,
              a.config, a.success_message AS successMessage, a.explanation,
              a.points, a.badge_label AS badgeLabel, a.status,
              a.created_by AS createdBy, a.published_at AS publishedAt,
              a.completion_count AS completionCount,
              a.created_at AS createdAt, a.updated_at AS updatedAt
       FROM learn_activities a
       LEFT JOIN learn_subjects s ON s.id = a.subject_id
       WHERE a.id = ?`,
      [id],
    );
    const ages = await loadAgeMeta(conn, id);
    res.json(mapActivity(rows[0], ages));
  } catch (e: any) {
    console.error('[admin/activities PUT]', e);
    return res.status(500).json({
      error: 'update_failed',
      message: e?.sqlMessage || e?.message || 'Failed to update activity',
    });
  } finally {
    conn.release();
  }
});

/** POST /api/admin/activities/:id/duplicate */
router.post('/:id/duplicate', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(`SELECT * FROM learn_activities WHERE id = ? LIMIT 1`, [id]);
    const src = rows?.[0];
    if (!src) return res.status(404).json({ error: 'not_found' });
    const [result]: any = await conn.query(
      `INSERT INTO learn_activities
        (title, description, activity_type, subject_id, difficulty, estimated_minutes,
         instructions, config, success_message, explanation, points, badge_label,
         status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, NOW(3), NOW(3))`,
      [
        `${src.title} (Copy)`,
        src.description,
        src.activity_type,
        src.subject_id,
        src.difficulty,
        src.estimated_minutes,
        src.instructions,
        typeof src.config === 'string' ? src.config : JSON.stringify(src.config || {}),
        src.success_message,
        src.explanation,
        src.points,
        src.badge_label,
        req.user?.id ?? null,
      ],
    );
    const newId = Number(result.insertId);
    const ages = await loadAgeMeta(conn, id);
    await replaceAges(conn, newId, ages.ageBands, ages.ageGroupIds);
    res.status(201).json({ id: newId, status: 'DRAFT' });
  } catch (e: any) {
    console.error('[admin/activities duplicate]', e);
    return res.status(500).json({
      error: 'duplicate_failed',
      message: e?.sqlMessage || e?.message || 'Failed to duplicate activity',
    });
  } finally {
    conn.release();
  }
});

/** POST /api/admin/activities/:id/publish */
router.post('/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT id, title, activity_type AS activityType, config, status FROM learn_activities WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const ages = await loadAgeMeta(conn, id);
    const issues = canPublishActivity({
      title: row.title,
      activityType: row.activityType,
      config: parseJson(row.config),
      ageBands: ages.ageBands,
      ageGroupIds: ages.ageGroupIds,
    });
    if (issues.length) {
      return res.status(400).json({ error: 'invalid_configuration', issues });
    }
    await conn.query(
      `UPDATE learn_activities SET status = 'PUBLISHED', published_at = COALESCE(published_at, NOW(3)), updated_at = NOW(3) WHERE id = ?`,
      [id],
    );
    res.json({ ok: true, id, status: 'PUBLISHED' });
  } finally {
    conn.release();
  }
});

/** POST /api/admin/activities/:id/unpublish */
router.post('/:id/unpublish', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      `UPDATE learn_activities SET status = 'DRAFT', updated_at = NOW(3) WHERE id = ?`,
      [id],
    );
    if (!r?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, id, status: 'DRAFT' });
  } finally {
    conn.release();
  }
});

/** DELETE /api/admin/activities/:id — archive by default; ?hard=1 deletes */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const hard = String(req.query.hard || '') === '1';
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    if (hard) {
      const [r]: any = await conn.query(`DELETE FROM learn_activities WHERE id = ?`, [id]);
      if (!r?.affectedRows) return res.status(404).json({ error: 'not_found' });
      return res.json({ ok: true, deleted: true });
    }
    const [r]: any = await conn.query(
      `UPDATE learn_activities SET status = 'ARCHIVED', updated_at = NOW(3) WHERE id = ?`,
      [id],
    );
    if (!r?.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, status: 'ARCHIVED' });
  } finally {
    conn.release();
  }
});

export default router;

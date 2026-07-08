import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';
import { memoryUpload } from '../../middleware/upload';
import { getStorageAdapter } from '../../providers/storage';

const router = Router();
const uploadFields = memoryUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'media', maxCount: 20 },
]);

router.use(requireAuth);
router.use(requireAdmin);

const SELECT_FIELDS = `
  id, type, title, subtitle, body, image_key AS imageKey,
  cta_label AS ctaLabel, cta_href AS ctaHref, sort_order AS sortOrder,
  active, starts_at AS startsAt, expires_at AS expiresAt,
  created_at AS createdAt, updated_at AS updatedAt
`;

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    type: row.type,
    title: row.title,
    subtitle: row.subtitle ?? null,
    body: row.body ?? null,
    imageKey: row.imageKey ?? null,
    ctaLabel: row.ctaLabel ?? null,
    ctaHref: row.ctaHref ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
    active: !!row.active,
    startsAt: row.startsAt ?? null,
    expiresAt: row.expiresAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMediaRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    postId: Number(row.postId),
    mediaType: row.mediaType,
    mediaKey: row.mediaKey,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

function parseBool(v: unknown, fallback = true): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return v === 'true' || v === '1' || v === 1;
}

function mediaTypeFromMime(mimetype: string): 'IMAGE' | 'VIDEO' {
  return mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

async function uploadMediaFile(
  file: Express.Multer.File,
): Promise<{ key: string; mediaType: 'IMAGE' | 'VIDEO' }> {
  const storage = getStorageAdapter();
  const mediaType = mediaTypeFromMime(file.mimetype);
  const ext =
    (file.originalname || (mediaType === 'VIDEO' ? 'mp4' : 'jpg')).split('.').pop() || 'bin';
  const key = `posts/${mediaType.toLowerCase()}/${uuidv4()}.${ext}`;
  const uploaded = await storage.upload(key, file.buffer, file.mimetype);
  return { key: uploaded.key, mediaType };
}

async function fetchMediaForPost(conn: any, postId: number) {
  const [rows]: any = await conn.query(
    `SELECT id, post_id AS postId, media_type AS mediaType, media_key AS mediaKey, sort_order AS sortOrder
     FROM site_post_media WHERE post_id = ? ORDER BY sort_order ASC, id ASC`,
    [postId],
  );
  return (rows || []).map(mapMediaRow);
}

async function insertMediaFiles(
  conn: any,
  postId: number,
  files: Express.Multer.File[],
  startOrder = 0,
) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { key, mediaType } = await uploadMediaFile(file);
    await conn.query(
      `INSERT INTO site_post_media (post_id, media_type, media_key, sort_order, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [postId, mediaType, key, startOrder + i],
    );
  }
}

router.get('/list', async (_req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT ${SELECT_FIELDS} FROM site_posts ORDER BY sort_order ASC, id DESC`,
    );
    const posts = (rows || []).map(mapRow);
    const carouselIds = posts
      .filter((p: { type: string }) => p.type === 'CAROUSEL')
      .map((p: { id: number }) => p.id);
    const mediaByPost: Record<number, ReturnType<typeof mapMediaRow>[]> = {};
    if (carouselIds.length) {
      const [mediaRows]: any = await conn.query(
        `SELECT id, post_id AS postId, media_type AS mediaType, media_key AS mediaKey, sort_order AS sortOrder
         FROM site_post_media WHERE post_id IN (?) ORDER BY sort_order ASC, id ASC`,
        [carouselIds],
      );
      for (const row of mediaRows || []) {
        const m = mapMediaRow(row);
        if (!mediaByPost[m.postId]) mediaByPost[m.postId] = [];
        mediaByPost[m.postId].push(m);
      }
    }
    res.json(
      posts.map((p: { id: number; type: string }) => ({ ...p, media: mediaByPost[p.id] || [] })),
    );
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  } finally {
    conn.release();
  }
});

router.delete('/:postId/media/:mediaId', async (req, res) => {
  const postId = Number(req.params.postId);
  const mediaId = Number(req.params.mediaId);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      'DELETE FROM site_post_media WHERE id = ? AND post_id = ? LIMIT 1',
      [mediaId, postId],
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'delete_media_failed' });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      `SELECT ${SELECT_FIELDS} FROM site_posts WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const media = await fetchMediaForPost(conn, id);
    res.json({ ...mapRow(row), media });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'get_failed' });
  } finally {
    conn.release();
  }
});

router.post('/', uploadFields, async (req, res) => {
  const {
    type = 'POST',
    title,
    subtitle,
    body,
    ctaLabel,
    ctaHref,
    sortOrder = 0,
    active = true,
    startsAt,
    expiresAt,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title_required' });

  const files = req.files as
    | { image?: Express.Multer.File[]; media?: Express.Multer.File[] }
    | undefined;
  const imageFile = files?.image?.[0];
  const mediaFiles = files?.media || [];

  if (type === 'CAROUSEL' && mediaFiles.length === 0 && !imageFile) {
    return res.status(400).json({ error: 'carousel_media_required' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let imageKey: string | null = null;
    if (imageFile && type === 'POST') {
      const uploaded = await uploadMediaFile(imageFile);
      imageKey = uploaded.key;
    }

    const [r]: any = await conn.query(
      `INSERT INTO site_posts
        (type, title, subtitle, body, image_key, cta_label, cta_href,
         sort_order, active, starts_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        type,
        title,
        subtitle || null,
        body || null,
        imageKey,
        ctaLabel || null,
        ctaHref || null,
        Number(sortOrder) || 0,
        parseBool(active) ? 1 : 0,
        startsAt || null,
        expiresAt || null,
      ],
    );
    const postId = r.insertId;

    if (type === 'CAROUSEL') {
      await insertMediaFiles(conn, postId, mediaFiles);
      if (mediaFiles.length === 0 && imageFile) {
        await insertMediaFiles(conn, postId, [imageFile]);
      }
    }

    await conn.commit();
    res.status(201).json({ id: postId, imageKey });
  } catch (e: any) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'create_failed', message: e.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', uploadFields, async (req, res) => {
  const id = Number(req.params.id);
  const {
    type,
    title,
    subtitle,
    body,
    ctaLabel,
    ctaHref,
    sortOrder,
    active,
    startsAt,
    expiresAt,
    imageKey: existingImageKey,
  } = req.body;

  const files = req.files as
    | { image?: Express.Multer.File[]; media?: Express.Multer.File[] }
    | undefined;
  const imageFile = files?.image?.[0];
  const mediaFiles = files?.media || [];

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing]: any = await conn.query(
      'SELECT id, image_key, type FROM site_posts WHERE id = ? LIMIT 1',
      [id],
    );
    if (!existing?.[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'not_found' });
    }

    const postType = type ?? existing[0].type;
    let imageKey = existing?.[0]?.image_key ?? null;
    if (postType === 'POST') {
      if (imageFile) {
        const uploaded = await uploadMediaFile(imageFile);
        imageKey = uploaded.key;
      } else if (existingImageKey === '' || existingImageKey === null) {
        imageKey = null;
      }
    } else {
      imageKey = null;
    }

    await conn.query(
      `UPDATE site_posts SET
        type = COALESCE(?, type),
        title = COALESCE(?, title),
        subtitle = ?,
        body = ?,
        image_key = ?,
        cta_label = ?,
        cta_href = ?,
        sort_order = COALESCE(?, sort_order),
        active = COALESCE(?, active),
        starts_at = ?,
        expires_at = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        type ?? null,
        title ?? null,
        subtitle ?? null,
        body ?? null,
        imageKey,
        ctaLabel ?? null,
        ctaHref ?? null,
        sortOrder != null ? Number(sortOrder) : null,
        active != null ? (parseBool(active, true) ? 1 : 0) : null,
        startsAt ?? null,
        expiresAt ?? null,
        id,
      ],
    );

    if (postType === 'CAROUSEL' && mediaFiles.length > 0) {
      const [maxRow]: any = await conn.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM site_post_media WHERE post_id = ?',
        [id],
      );
      const startOrder = Number(maxRow?.[0]?.maxOrder ?? -1) + 1;
      await insertMediaFiles(conn, id, mediaFiles, startOrder);
    }

    await conn.commit();
    const media = await fetchMediaForPost(conn, id);
    res.json({ ok: true, imageKey, media });
  } catch (e: any) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'update_failed', message: e.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query('DELETE FROM site_posts WHERE id = ? LIMIT 1', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  } finally {
    conn.release();
  }
});

export default router;

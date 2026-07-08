import { Router } from 'express';
import { query } from '../db';

const router = Router();

const ACTIVE_POST_SQL = `
  SELECT id, type, title, subtitle, body, image_key AS imageKey,
         cta_label AS ctaLabel, cta_href AS ctaHref, sort_order AS sortOrder,
         created_at AS createdAt
  FROM site_posts
  WHERE active = 1
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY sort_order ASC, id DESC
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
    createdAt: row.createdAt ?? null,
  };
}

function mapMediaRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    postId: Number(row.postId),
    mediaType: String(row.mediaType ?? 'IMAGE'),
    mediaKey: String(row.mediaKey ?? ''),
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

export function flattenCarouselSlides(
  carouselPosts: Array<ReturnType<typeof mapRow> & { media?: ReturnType<typeof mapMediaRow>[] }>,
) {
  const slides: Array<
    ReturnType<typeof mapRow> & {
      mediaId: number | null;
      mediaType: string;
      mediaKey: string;
      slideKey: string;
    }
  > = [];

  for (const post of carouselPosts) {
    const items =
      post.media && post.media.length > 0
        ? post.media
        : post.imageKey
          ? [
              {
                id: 0,
                postId: post.id,
                mediaType: 'IMAGE' as const,
                mediaKey: String(post.imageKey),
                sortOrder: 0,
              },
            ]
          : [];

    for (const item of items) {
      slides.push({
        ...post,
        mediaId: item.id || null,
        mediaType: item.mediaType,
        mediaKey: item.mediaKey,
        slideKey: `${post.id}-${item.id || item.mediaKey}`,
      });
    }
  }

  return slides;
}

async function attachMediaToCarouselPosts(carouselPosts: ReturnType<typeof mapRow>[]) {
  if (!carouselPosts.length) return carouselPosts.map((p) => ({ ...p, media: [] }));

  const ids = carouselPosts.map((p) => p.id);
  const [mediaRows]: any = await query(
    `SELECT id, post_id AS postId, media_type AS mediaType, media_key AS mediaKey, sort_order AS sortOrder
     FROM site_post_media WHERE post_id IN (?) ORDER BY sort_order ASC, id ASC`,
    [ids],
  );

  const mediaByPost: Record<number, ReturnType<typeof mapMediaRow>[]> = {};
  for (const row of mediaRows || []) {
    const m = mapMediaRow(row);
    if (!mediaByPost[m.postId]) mediaByPost[m.postId] = [];
    mediaByPost[m.postId].push(m);
  }

  return carouselPosts.map((p) => ({ ...p, media: mediaByPost[p.id] || [] }));
}

/** Public posts + carousel content */
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await query(ACTIVE_POST_SQL);
    const items = (rows || []).map(mapRow);
    const posts = items.filter((p: { type: string }) => p.type === 'POST');
    const carouselRaw = items.filter((p: { type: string }) => p.type === 'CAROUSEL');
    const carousel = await attachMediaToCarouselPosts(carouselRaw);
    const carouselSlides = flattenCarouselSlides(carousel);
    res.json({ posts, carousel, carouselSlides });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'list_posts_failed' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const [rows]: any = await query(
      `SELECT id, type, title, subtitle, body, image_key AS imageKey,
              cta_label AS ctaLabel, cta_href AS ctaHref, sort_order AS sortOrder,
              created_at AS createdAt
       FROM site_posts
       WHERE id = ? AND active = 1
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const post = mapRow(row);
    const [mediaRows]: any = await query(
      `SELECT id, post_id AS postId, media_type AS mediaType, media_key AS mediaKey, sort_order AS sortOrder
       FROM site_post_media WHERE post_id = ? ORDER BY sort_order ASC, id ASC`,
      [id],
    );
    const media = (mediaRows || []).map(mapMediaRow);
    res.json({ ...post, media });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'get_post_failed' });
  }
});

export default router;

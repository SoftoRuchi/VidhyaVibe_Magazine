import { Router } from 'express';
import { getPool } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/library
 * Returns user's library: subscribed magazines (with latest edition) + purchased editions.
 */
router.get('/', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  const readerId = req.query.readerId ? Number(req.query.readerId) : null;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    if (readerId) {
      const [readerRows]: any = await conn.query(
        'SELECT id FROM readers WHERE id = ? AND userId = ? LIMIT 1',
        [readerId, userId],
      );
      if (!readerRows[0]) return res.status(403).json({ error: 'reader_not_owned_by_user' });
    }

    // 1. Subscribed magazines (active subscriptions with magazineId)
    const [subRows]: any = await conn.query(
      `SELECT us.id as subscriptionId, us.magazineId, us.status, us.endsAt,
              m.title as magazineTitle, m.slug as magazineSlug, m.coverKey as magazineCoverKey,
              (SELECT id FROM magazine_editions WHERE magazineId = us.magazineId AND publishedAt <= NOW() ORDER BY publishedAt DESC LIMIT 1) as editionId,
              (SELECT volume FROM magazine_editions WHERE magazineId = us.magazineId AND publishedAt <= NOW() ORDER BY publishedAt DESC LIMIT 1) as volume,
              (SELECT issueNumber FROM magazine_editions WHERE magazineId = us.magazineId AND publishedAt <= NOW() ORDER BY publishedAt DESC LIMIT 1) as issueNumber,
              (SELECT publishedAt FROM magazine_editions WHERE magazineId = us.magazineId AND publishedAt <= NOW() ORDER BY publishedAt DESC LIMIT 1) as publishedAt
       FROM user_subscriptions us
       JOIN magazines m ON m.id = us.magazineId
       WHERE us.userId = ? AND us.status = 'ACTIVE' AND (us.endsAt IS NULL OR us.endsAt > NOW()) AND us.magazineId IS NOT NULL
       ${readerId ? 'AND us.readerId = ?' : ''}
       ORDER BY us.endsAt DESC`,
      readerId ? [userId, readerId] : [userId],
    );

    const subscribed = subRows.map((r: any) => ({
      type: 'subscription',
      subscriptionId: r.subscriptionId,
      magazineId: r.magazineId,
      title: r.magazineTitle,
      slug: r.magazineSlug,
      coverKey: r.magazineCoverKey,
      editionId: r.editionId,
      volume: r.volume,
      issueNumber: r.issueNumber,
      publishedAt: r.publishedAt,
    }));

    // 2. Purchased editions (individual buys)
    const [purchaseRows]: any = await conn.query(
      `SELECT ep.id as purchaseId, ep.editionId, ep.purchasedAt,
              me.volume, me.issueNumber, me.publishedAt,
              m.id as magazineId, m.title as magazineTitle, m.slug as magazineSlug, m.coverKey as magazineCoverKey
       FROM edition_purchases ep
       JOIN magazine_editions me ON me.id = ep.editionId
       JOIN magazines m ON m.id = me.magazineId
       WHERE ep.userId = ?
       ${readerId ? 'AND ep.readerId = ?' : ''}
       ORDER BY ep.purchasedAt DESC`,
      readerId ? [userId, readerId] : [userId],
    );

    const purchased = purchaseRows.map((r: any) => ({
      type: 'purchase',
      purchaseId: r.purchaseId,
      editionId: r.editionId,
      magazineId: r.magazineId,
      title: r.magazineTitle,
      slug: r.magazineSlug,
      coverKey: r.magazineCoverKey,
      volume: r.volume,
      issueNumber: r.issueNumber,
      publishedAt: r.publishedAt,
      purchasedAt: r.purchasedAt,
    }));

    res.json({
      subscribed,
      purchased,
      items: [
        ...subscribed.map((s: any) => ({ ...s, accessType: 'subscription' })),
        ...purchased.map((p: any) => ({ ...p, accessType: 'purchase' })),
      ],
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'library_failed', details: e.message });
  } finally {
    conn.release();
  }
});

export default router;

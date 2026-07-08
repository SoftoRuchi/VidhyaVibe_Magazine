import { Router } from 'express';
import { query } from '../db';

const router = Router();

const ACTIVE_OFFER_SQL = `
  SELECT id, type, badge, title, subtitle, highlight, detail, color, border_color AS borderColor,
         cta_label AS ctaLabel, cta_href AS ctaHref, plan_id AS planId, magazine_id AS magazineId,
         sort_order AS sortOrder
  FROM sale_offers
  WHERE active = 1
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY sort_order ASC, id ASC
`;

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    type: row.type,
    badge: row.badge ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    highlight: row.highlight ?? null,
    detail: row.detail ?? null,
    color: row.color ?? null,
    borderColor: row.borderColor ?? null,
    ctaLabel: row.ctaLabel ?? null,
    ctaHref: row.ctaHref ?? null,
    planId: row.planId != null ? Number(row.planId) : null,
    magazineId: row.magazineId != null ? Number(row.magazineId) : null,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

/** Public sales page content */
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await query(ACTIVE_OFFER_SQL);
    const offers = (rows || []).map(mapRow);
    const banner = offers.find((o: { type: string }) => o.type === 'BANNER') ?? null;
    const deals = offers.filter((o: { type: string }) => o.type === 'DEAL');
    const benefits = offers.filter((o: { type: string }) => o.type === 'BENEFIT');
    res.json({ banner, deals, benefits });
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: 'list_sales_failed' });
  }
});

export default router;

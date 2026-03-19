import { getEnv } from '@magazine/config';
import { Router } from 'express';
import { getPool } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

const env = getEnv();
const router = Router();

// List available plans. With ?magazineId=X returns plans with magazine-specific pricing when set.
// Public endpoint - users need to see plans/prices before logging in.
router.get('/plans', async (req, res) => {
  const magazineId = req.query.magazineId ? Number(req.query.magazineId) : null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    if (magazineId) {
      const [planRows]: any = await conn.query(
        `SELECT sp.id, sp.name, sp.slug, sp.description, sp.minMonths, sp.maxMonths,
                sp.deliveryMode, sp.autoDispatch, sp.dispatchFrequencyDays,
                sp.price as defaultPrice, sp.currency as defaultCurrency
         FROM subscription_plans sp WHERE sp.active = 1`,
      );
      const [mpRows]: any = await conn.query(
        `SELECT plan_id, delivery_mode, price, currency FROM magazine_plans WHERE magazine_id = ? AND active = 1`,
        [magazineId],
      );
      const mpMap: Record<string, { price: number; currency: string }> = {};
      for (const mp of mpRows) {
        mpMap[`${mp.plan_id}:${mp.delivery_mode}`] = {
          price: mp.price,
          currency: mp.currency || 'INR',
        };
      }
      const plans = planRows.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        minMonths: p.minMonths,
        maxMonths: p.maxMonths,
        deliveryMode: p.deliveryMode,
        autoDispatch: p.autoDispatch,
        dispatchFrequencyDays: p.dispatchFrequencyDays,
        prices: {
          ELECTRONIC: mpMap[`${p.id}:ELECTRONIC`] ?? {
            price: p.defaultPrice,
            currency: p.defaultCurrency || 'INR',
          },
          PHYSICAL: mpMap[`${p.id}:PHYSICAL`] ?? {
            price: p.defaultPrice,
            currency: p.defaultCurrency || 'INR',
          },
          BOTH: mpMap[`${p.id}:BOTH`] ?? {
            price: p.defaultPrice,
            currency: p.defaultCurrency || 'INR',
          },
        },
        price: mpMap[`${p.id}:BOTH`]?.price ?? p.defaultPrice,
        currency: mpMap[`${p.id}:BOTH`]?.currency ?? (p.defaultCurrency || 'INR'),
      }));
      res.json(plans);
    } else {
      const [rows]: any = await conn.query(
        'SELECT id, name, slug, description, price, currency, minMonths, maxMonths, deliveryMode, autoDispatch, dispatchFrequencyDays FROM subscription_plans WHERE active = 1',
      );
      res.json(rows);
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'list_plans_failed' });
  } finally {
    conn.release();
  }
});

router.use(requireAuth);

// Subscribe endpoint
router.post('/subscribe', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  const { planId, months, readerId, deliveryMode, addressId, couponCode, magazineId } = req.body;
  if (!planId || !months) return res.status(400).json({ error: 'planId_and_months_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // fetch plan
    const [planRows]: any = await conn.query(
      'SELECT * FROM subscription_plans WHERE id = ? LIMIT 1',
      [planId],
    );
    const plan = planRows[0];
    if (!plan) {
      await conn.rollback();
      return res.status(404).json({ error: 'plan_not_found' });
    }

    if (plan.minMonths && months < plan.minMonths) {
      await conn.rollback();
      return res.status(400).json({ error: 'months_below_minimum' });
    }
    if (plan.maxMonths && months > plan.maxMonths) {
      await conn.rollback();
      return res.status(400).json({ error: 'months_above_maximum' });
    }

    // determine effective delivery mode
    const effectiveDelivery = deliveryMode || plan.deliveryMode;

    // if physical delivery required, validate address exists
    if (
      effectiveDelivery === 'PHYSICAL' ||
      effectiveDelivery === 'BOTH' ||
      plan.delivery_mode === 'PHYSICAL'
    ) {
      // check address either for reader or user
      let addrOk = false;
      if (addressId) {
        const [aRows]: any = await conn.query('SELECT id FROM addresses WHERE id = ? LIMIT 1', [
          addressId,
        ]);
        addrOk = !!aRows[0];
      } else if (readerId) {
        const [aRows]: any = await conn.query(
          'SELECT id FROM addresses WHERE readerId = ? LIMIT 1',
          [readerId],
        );
        addrOk = !!aRows[0];
      } else {
        const [aRows]: any = await conn.query('SELECT id FROM addresses WHERE userId = ? LIMIT 1', [
          userId,
        ]);
        addrOk = !!aRows[0];
      }
      if (!addrOk) {
        await conn.rollback();
        return res.status(400).json({ error: 'physical_address_required' });
      }
    }

    // compute price (plan.price is whole currency units; payments table stores cents)
    const price = Number(plan.price ?? 0) * Number(months);
    const amountCents = Math.round(price * 100);

    // handle coupon validation via coupon service
    let couponId: number | null = null;
    if (couponCode) {
      const { validateCoupon } = require('../services/coupons');
      const vres = await validateCoupon(couponCode, userId, planId, undefined);
      if (!vres.valid) {
        await conn.rollback();
        return res.status(400).json({ error: 'invalid_coupon', reason: vres.reason });
      }
      couponId = vres.coupon.id;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + Number(months));

    const [ins]: any = await conn.query(
      'INSERT INTO user_subscriptions (userId, readerId, magazineId, planId, status, startsAt, endsAt, autoRenew, price, currency, couponId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        userId,
        readerId || null,
        magazineId || null,
        planId,
        'ACTIVE',
        startsAt,
        endsAt,
        1,
        price,
        plan.currency || 'USD',
        couponId,
      ],
    );
    const subscriptionId = ins.insertId;

    // create payment placeholder
    const [pay]: any = await conn.query(
      'INSERT INTO payments (userId, subscriptionId, amountCents, currency, provider, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [userId, subscriptionId, amountCents, plan.currency || 'USD', 'manual', 'PENDING'],
    );
    const paymentId = pay.insertId;

    // If plan autoDispatch and physical delivery, generate dispatch schedules
    if (
      plan.autoDispatch &&
      (effectiveDelivery === 'PHYSICAL' ||
        effectiveDelivery === 'BOTH' ||
        plan.deliveryMode === 'PHYSICAL')
    ) {
      // determine frequency in days
      const freqDays = plan.dispatchFrequencyDays || 30;
      let next = new Date(startsAt);
      // schedule until endsAt exclusive
      while (next < endsAt) {
        const scheduledAt = new Date(next);
        // try to find edition for the scheduled date if magazineId provided
        let editionIdForSchedule = null;
        if (magazineId) {
          const [edRows]: any = await conn.query(
            'SELECT id FROM magazine_editions WHERE magazineId = ? AND publishedAt <= ? ORDER BY publishedAt DESC LIMIT 1',
            [magazineId, scheduledAt],
          );
          if (edRows && edRows[0]) editionIdForSchedule = edRows[0].id;
        }
        await conn.query(
          'INSERT INTO dispatch_schedules (subscriptionId, editionId, scheduledAt, status, createdAt) VALUES (?, ?, ?, ?, NOW())',
          [subscriptionId, editionIdForSchedule, scheduledAt, 'SCHEDULED'],
        );
        next = new Date(next.getTime() + freqDays * 24 * 60 * 60 * 1000);
      }
    }

    // record coupon usage (if any)
    if (couponId) {
      const { recordCouponUsage } = require('../services/coupons');
      await recordCouponUsage(couponId, userId, subscriptionId);
    }

    await conn.commit();
    res.status(201).json({ subscriptionId, paymentId });
  } catch (e: any) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'subscribe_failed', details: e.message });
  } finally {
    conn.release();
  }
});

// Check subscription status for a magazine
router.get('/check/:magazineId', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const magazineId = Number(req.params.magazineId);
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!magazineId) return res.status(400).json({ error: 'magazineId_required' });

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // Check if user has an active subscription for this magazine
    const [subRows]: any = await conn.query(
      'SELECT id FROM user_subscriptions WHERE userId = ? AND magazineId = ? AND status = "ACTIVE" AND endsAt > NOW() LIMIT 1',
      [userId, magazineId],
    );

    const isSubscribed = subRows.length > 0;

    if (!isSubscribed) {
      return res.json({ subscribed: false });
    }

    // If subscribed, find the latest published edition for this magazine
    const [edRows]: any = await conn.query(
      'SELECT id FROM magazine_editions WHERE magazineId = ? AND publishedAt <= NOW() ORDER BY publishedAt DESC LIMIT 1',
      [magazineId],
    );

    const editionId = edRows.length > 0 ? edRows[0].id : null;

    res.json({
      subscribed: true,
      editionId,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'check_failed' });
  } finally {
    conn.release();
  }
});

export default router;

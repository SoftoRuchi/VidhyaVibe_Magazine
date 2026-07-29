import crypto from 'crypto';
import { getPool } from '../db';
import { computeSubscriptionAmount } from '../utils/subscriptionPricing';
import { applyCouponDiscount, normalizeCouponCode, validateCoupon } from './coupons';
import { assertMagazineNotAlreadyPurchased } from './magazinePurchaseGuard';
import { sendPurchaseConfirmation } from './notifications';

/** Create subscription, payment, coupon usage, and dispatch schedules after an order is paid. */
async function fulfillOrderAfterPayment(
  conn: any,
  order: any,
  opts: {
    provider: string;
    providerPaymentId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ subscriptionId: number; paymentId: number }> {
  const [existingByOrder]: any = await conn.query(
    `SELECT id, subscriptionId FROM payments
     WHERE subscriptionId IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.orderId')) = ?
     LIMIT 1`,
    [String(order.id)],
  );
  if (existingByOrder?.[0]?.subscriptionId) {
    return {
      subscriptionId: Number(existingByOrder[0].subscriptionId),
      paymentId: Number(existingByOrder[0].id),
    };
  }

  const [existingPay]: any = await conn.query(
    'SELECT id, subscriptionId FROM payments WHERE provider = ? AND providerPaymentId = ? LIMIT 1',
    [opts.provider, opts.providerPaymentId],
  );
  if (existingPay?.[0]?.subscriptionId) {
    return {
      subscriptionId: Number(existingPay[0].subscriptionId),
      paymentId: Number(existingPay[0].id),
    };
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMonth(endsAt.getMonth() + Number(order.months));
  const finalAmount = Number(order.final_amount ?? order.final_cents ?? 0);

  const [insSub]: any = await conn.query(
    'INSERT INTO user_subscriptions (userId, readerId, magazineId, planId, delivery_mode, status, startsAt, endsAt, autoRenew, price, currency, couponId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
    [
      order.user_id ?? order.userId,
      order.reader_id ?? order.readerId ?? null,
      order.magazine_id ?? order.magazineId ?? null,
      order.plan_id ?? order.planId,
      order.delivery_mode ?? order.deliveryMode ?? 'BOTH',
      'ACTIVE',
      startsAt,
      endsAt,
      1,
      finalAmount,
      order.currency,
      order.coupon_id ?? order.couponId ?? null,
    ],
  );
  const subscriptionId = insSub.insertId;

  const [pay]: any = await conn.query(
    'INSERT INTO payments (userId, subscriptionId, amountCents, currency, provider, providerPaymentId, status, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))',
    [
      order.user_id ?? order.userId,
      subscriptionId,
      Math.round(finalAmount * 100),
      order.currency,
      opts.provider,
      opts.providerPaymentId,
      'SUCCESS',
      JSON.stringify(opts.metadata ?? {}),
    ],
  );
  const paymentId = pay.insertId;

  const couponId = order.coupon_id ?? order.couponId;
  const userId = order.user_id ?? order.userId;
  if (couponId) {
    // Insert on the same connection — do NOT use Prisma here (separate pool → lock wait timeout)
    await conn.query(
      'INSERT INTO coupon_usages (couponId, userId, subscriptionId, usedAt) VALUES (?, ?, ?, NOW(3))',
      [Number(couponId), userId ? Number(userId) : null, subscriptionId],
    );
  }

  await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['PAID', order.id]);

  const [planRows]: any = await conn.query(
    'SELECT dispatchFrequencyDays, autoDispatch, deliveryMode FROM subscription_plans WHERE id = ? LIMIT 1',
    [order.plan_id ?? order.planId],
  );
  const plan = planRows[0];
  const deliveryMode = order.delivery_mode ?? order.deliveryMode;
  if (plan?.autoDispatch && ['PHYSICAL', 'BOTH'].includes(deliveryMode)) {
    const freqDays = plan.dispatchFrequencyDays || 30;
    let next = new Date(startsAt);
    while (next < endsAt) {
      let editionIdForSchedule = null;
      const magazineId = order.magazine_id ?? order.magazineId;
      if (magazineId) {
        const [edRows]: any = await conn.query(
          'SELECT id FROM magazine_editions WHERE magazineId = ? AND publishedAt <= ? ORDER BY publishedAt DESC LIMIT 1',
          [magazineId, next],
        );
        if (edRows?.[0]) editionIdForSchedule = edRows[0].id;
      }
      await conn.query(
        'INSERT INTO dispatch_schedules (subscriptionId, editionId, scheduledAt, status, createdAt) VALUES (?, ?, ?, ?, NOW(3))',
        [subscriptionId, editionIdForSchedule, next, 'SCHEDULED'],
      );
      next = new Date(next.getTime() + freqDays * 24 * 60 * 60 * 1000);
    }
  }

  return { subscriptionId, paymentId };
}

async function createRazorpayOrder(params: { amount: number; currency: string; receipt: string }) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('razorpay_credentials_missing');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      // Razorpay expects amount in the smallest currency unit (paise for INR)
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      receipt: params.receipt,
    }),
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      data?.error?.description || data?.error?.message || data?.message || 'razorpay_order_failed';
    throw new Error(msg);
  }
  if (!data?.id) throw new Error('razorpay_order_id_missing');
  return data as { id: string; amount: number; currency: string; receipt: string; status: string };
}

export async function confirmRazorpayPayment(params: {
  userId?: number;
  orderId: number;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  /** When true, order.user_id is trusted (guest checkout — no JWT). Signature still verified. */
  allowGuest?: boolean;
}) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error('razorpay_credentials_missing');

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [
      params.orderId,
    ]);
    const order = rows?.[0];
    if (!order) throw new Error('order_not_found');

    if (!params.allowGuest) {
      if (params.userId == null) throw new Error('unauthenticated');
      if (Number(order.user_id) !== Number(params.userId)) throw new Error('forbidden');
    }

    // Ensure the Razorpay order id matches what we stored at creation time
    if (!order.rp_order_id) throw new Error('rp_order_id_missing');
    if (String(order.rp_order_id) !== String(params.razorpay_order_id))
      throw new Error('rp_order_mismatch');

    // Verify signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const payload = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
    if (expected !== params.razorpay_signature) {
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['FAILED', order.id]);
      await conn.commit();
      throw new Error('invalid_signature');
    }

    if (order.status === 'PAID') {
      const result = await fulfillOrderAfterPayment(conn, order, {
        provider: 'razorpay',
        providerPaymentId: params.razorpay_payment_id,
        metadata: {
          razorpay_order_id: params.razorpay_order_id,
          razorpay_signature: params.razorpay_signature,
          orderId: order.id,
        },
      });
      await conn.commit();
      void notifyPurchaseConfirmation(order, result, params.razorpay_payment_id).catch((err) => {
        console.error('[payments] purchase confirmation notify failed', err);
      });
      return { ok: true, ...result };
    }

    await conn.query('UPDATE orders SET rp_payment_id = ?, rp_signature = ? WHERE id = ?', [
      params.razorpay_payment_id,
      params.razorpay_signature,
      order.id,
    ]);

    const result = await fulfillOrderAfterPayment(conn, order, {
      provider: 'razorpay',
      providerPaymentId: params.razorpay_payment_id,
      metadata: {
        razorpay_order_id: params.razorpay_order_id,
        razorpay_signature: params.razorpay_signature,
        orderId: order.id,
      },
    });

    await conn.commit();
    void notifyPurchaseConfirmation(order, result, params.razorpay_payment_id).catch((err) => {
      console.error('[payments] purchase confirmation notify failed', err);
    });
    return { ok: true, ...result };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function notifyPurchaseConfirmation(
  order: any,
  _result: { subscriptionId: number; paymentId: number },
  razorpayPaymentId?: string,
) {
  const pool = getPool();
  const [userRows]: any = await pool.query(
    'SELECT name, email, phone FROM users WHERE id = ? LIMIT 1',
    [order.user_id],
  );
  const user = userRows?.[0];
  if (!user?.email && !user?.phone) return;

  let magazineTitle: string | null = null;
  if (order.magazine_id) {
    const [magRows]: any = await pool.query('SELECT title FROM magazines WHERE id = ? LIMIT 1', [
      order.magazine_id,
    ]);
    magazineTitle = magRows?.[0]?.title || null;
  }

  const paymentRef = razorpayPaymentId || order.rp_payment_id || order.rpPaymentId || null;

  await sendPurchaseConfirmation({
    name: user.name || 'Customer',
    email: user.email,
    phone: user.phone || '',
    orderId: Number(order.id),
    amount: Number(order.final_amount ?? order.final_cents ?? 0),
    currency: order.currency || 'INR',
    months: Number(order.months || 1),
    magazineTitle,
    paymentId: paymentRef,
  });
}

export async function createOrder(params: {
  userId: number;
  planId: number;
  months: number;
  readerId?: number;
  deliveryMode?: string;
  addressId?: number;
  couponCode?: string;
  magazineId?: number;
  guest?: { name: string; email: string; phone: string };
}) {
  if (params.magazineId) {
    await assertMagazineNotAlreadyPurchased({
      magazineId: Number(params.magazineId),
      userId: params.userId,
      email: params.guest?.email,
      phone: params.guest?.phone,
    });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let plan: any;
    let effectivePrice: number;
    let effectiveCurrency: string;
    const deliveryMode = params.deliveryMode || 'BOTH';
    if (params.magazineId) {
      // DB column naming differs between environments (snake_case vs camelCase).
      // Fetch the full row and read both variants in JS.
      const [rows]: any = await conn.query(
        `SELECT * FROM subscription_plans WHERE id = ? AND active = 1 LIMIT 1`,
        [params.planId],
      );
      plan = rows[0];
      if (!plan) throw new Error('plan_not_found');
      let mpRows: any[] = [];
      try {
        const [r]: any = await conn.query(
          `SELECT price, currency FROM magazine_plans WHERE magazine_id = ? AND plan_id = ? AND delivery_mode = ? AND active = 1 LIMIT 1`,
          [params.magazineId, params.planId, deliveryMode],
        );
        mpRows = r;
      } catch {
        const [r]: any = await conn.query(
          `SELECT price, currency FROM magazine_plans WHERE magazineId = ? AND planId = ? AND deliveryMode = ? AND active = 1 LIMIT 1`,
          [params.magazineId, params.planId, deliveryMode],
        );
        mpRows = r;
      }
      if (mpRows[0]) {
        effectivePrice = Number(mpRows[0].price);
        effectiveCurrency = mpRows[0].currency || 'INR';
      } else {
        effectivePrice = Number(plan.defaultPrice ?? plan.price);
        effectiveCurrency = (plan.defaultCurrency ?? plan.currency) || 'INR';
      }
    } else {
      const [planRows]: any = await conn.query(
        'SELECT * FROM subscription_plans WHERE id = ? LIMIT 1',
        [params.planId],
      );
      plan = planRows[0];
      if (!plan) throw new Error('plan_not_found');
      effectivePrice = Number(plan.price);
      effectiveCurrency = plan.currency || 'INR';
    }
    const minMonths = plan.minMonths ?? plan.min_months;
    const maxMonths = plan.maxMonths ?? plan.max_months;
    if (minMonths && params.months < minMonths) throw new Error('months_below_minimum');
    if (maxMonths && params.months > maxMonths) throw new Error('months_above_maximum');

    // validate address if physical
    if (['PHYSICAL', 'BOTH'].includes(deliveryMode)) {
      let addrOk = false;
      if (params.addressId) {
        const [aRows]: any = await conn.query('SELECT id FROM addresses WHERE id = ? LIMIT 1', [
          params.addressId,
        ]);
        addrOk = !!aRows[0];
      } else if (params.readerId) {
        const [aRows]: any = await conn.query(
          'SELECT id FROM addresses WHERE reader_id = ? LIMIT 1',
          [params.readerId],
        );
        addrOk = !!aRows[0];
      } else {
        const [aRows]: any = await conn.query(
          'SELECT id FROM addresses WHERE user_id = ? LIMIT 1',
          [params.userId],
        );
        addrOk = !!aRows[0];
      }
      if (!addrOk) throw new Error('physical_address_required');
    }

    // compute amounts in whole currency units (no cents conversion)
    const baseAmount = computeSubscriptionAmount(effectivePrice, params.months, plan);
    let final = baseAmount;
    let couponId = null;
    if (params.couponCode) {
      const code = normalizeCouponCode(params.couponCode);
      const v = await validateCoupon(code, params.userId, params.planId, params.magazineId);
      if (!v.valid) throw new Error(`invalid_coupon:${v.reason}`);
      couponId = v.coupon.id;
      final = applyCouponDiscount(final, v.coupon);
    }

    // Create Razorpay order and store its id in orders.rp_order_id (RPOrderId)
    const rpOrder = await createRazorpayOrder({
      amount: final,
      currency: effectiveCurrency,
      receipt: 'test payment',
    });

    // Ensure guest contact snapshot columns exist (MySQL 8+ / MariaDB variants)
    try {
      await conn.query('ALTER TABLE orders ADD COLUMN guest_name VARCHAR(255) NULL');
    } catch {
      /* column may already exist */
    }
    try {
      await conn.query('ALTER TABLE orders ADD COLUMN guest_email VARCHAR(255) NULL');
    } catch {
      /* column may already exist */
    }
    try {
      await conn.query('ALTER TABLE orders ADD COLUMN guest_phone VARCHAR(50) NULL');
    } catch {
      /* column may already exist */
    }

    let orderId: number;
    try {
      const [ins]: any = await conn.query(
        `INSERT INTO orders
          (user_id, plan_id, months, reader_id, delivery_mode, address_id, coupon_id, amount, final_amount, currency, magazine_id, guest_name, guest_email, guest_phone, rp_order_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          params.userId,
          params.planId,
          params.months,
          params.readerId || null,
          deliveryMode,
          params.addressId || null,
          couponId,
          baseAmount,
          final,
          effectiveCurrency,
          params.magazineId || null,
          params.guest?.name || null,
          params.guest?.email || null,
          params.guest?.phone || null,
          rpOrder.id,
        ],
      );
      orderId = ins.insertId;
    } catch {
      // Fallback for DBs without guest_* columns yet
      const [ins]: any = await conn.query(
        'INSERT INTO orders (user_id, plan_id, months, reader_id, delivery_mode, address_id, coupon_id, amount, final_amount, currency, magazine_id, rp_order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          params.userId,
          params.planId,
          params.months,
          params.readerId || null,
          deliveryMode,
          params.addressId || null,
          couponId,
          baseAmount,
          final,
          effectiveCurrency,
          params.magazineId || null,
          rpOrder.id,
        ],
      );
      orderId = ins.insertId;
    }
    await conn.commit();
    // return order info including a UPI uri (simple)
    const upi = `upi://pay?pa=merchant@upi&pn=Magazine&tn=Order%20${orderId}&am=${Number(final).toFixed(2)}&cu=${effectiveCurrency}`;
    return {
      orderId,
      rpOrderId: rpOrder.id,
      amount: baseAmount,
      finalAmount: final,
      currency: effectiveCurrency,
      upi,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function createEditionOrder(
  userId: number,
  editionId: number,
  priceCents: number = 199,
  currency: string = 'INR',
) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [edRows]: any = await conn.query(
      'SELECT id, magazineId FROM magazine_editions WHERE id = ? AND publishedAt IS NOT NULL LIMIT 1',
      [editionId],
    );
    const ed = edRows[0];
    if (!ed) throw new Error('edition_not_found');
    const [ins]: any = await conn.query(
      'INSERT INTO edition_orders (user_id, edition_id, amount_cents, currency, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, editionId, priceCents, currency, 'PENDING'],
    );
    const orderId = ins.insertId;
    const upi = `upi://pay?pa=merchant@upi&pn=Magazine&tn=Edition%20${orderId}&am=${(priceCents / 100).toFixed(2)}&cu=${currency}`;
    return { orderId, finalCents: priceCents, currency, upi };
  } finally {
    conn.release();
  }
}

export async function attachEditionProof(
  orderId: number,
  userId: number,
  fileKey?: string,
  url?: string,
) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      'INSERT INTO edition_order_proofs (order_id, user_id, file_key, url, created_at) VALUES (?, ?, ?, ?, NOW())',
      [orderId, userId, fileKey || null, url || null],
    );
    return r.insertId;
  } finally {
    conn.release();
  }
}

export async function verifyEditionProof(proofId: number, adminId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pRows]: any = await conn.query(
      'SELECT * FROM edition_order_proofs WHERE id = ? LIMIT 1',
      [proofId],
    );
    const proof = pRows[0];
    if (!proof) throw new Error('proof_not_found');
    const [oRows]: any = await conn.query('SELECT * FROM edition_orders WHERE id = ? LIMIT 1', [
      proof.order_id,
    ]);
    const order = oRows[0];
    if (!order) throw new Error('order_not_found');
    if (order.status === 'PAID') throw new Error('order_already_paid');

    const [payIns]: any = await conn.query(
      'INSERT INTO payments (userId, amountCents, currency, provider, providerPaymentId, status, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        order.user_id,
        order.amount_cents,
        order.currency,
        'UPI',
        proof.id.toString(),
        'SUCCESS',
        JSON.stringify({ proofId: proof.id, type: 'edition' }),
      ],
    );
    const paymentId = payIns.insertId;
    await conn.query(
      'INSERT INTO edition_purchases (userId, editionId, priceCents, currency, paymentId, purchasedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [order.user_id, order.edition_id, order.amount_cents, order.currency, paymentId],
    );
    await conn.query('UPDATE edition_orders SET status = ? WHERE id = ?', ['PAID', order.id]);
    await conn.query(
      'UPDATE edition_order_proofs SET verified = 1, verified_at = NOW(), verified_by = ? WHERE id = ?',
      [adminId, proof.id],
    );
    await conn.commit();
    return { paymentId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function attachProof(orderId: number, userId: number, fileKey?: string, url?: string) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [r]: any = await conn.query(
      'INSERT INTO order_proofs (order_id, user_id, file_key, url, created_at) VALUES (?, ?, ?, ?, NOW())',
      [orderId, userId, fileKey || null, url || null],
    );
    return r.insertId;
  } finally {
    conn.release();
  }
}

export async function verifyProof(proofId: number, adminId: number) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // load proof and order
    const [pRows]: any = await conn.query('SELECT * FROM order_proofs WHERE id = ? LIMIT 1', [
      proofId,
    ]);
    const proof = pRows[0];
    if (!proof) throw new Error('proof_not_found');
    const [oRows]: any = await conn.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [
      proof.order_id,
    ]);
    const order = oRows[0];
    if (!order) throw new Error('order_not_found');
    if (order.status === 'PAID') throw new Error('order_already_paid');

    const { subscriptionId, paymentId } = await fulfillOrderAfterPayment(conn, order, {
      provider: 'UPI',
      providerPaymentId: proof.id.toString(),
      metadata: { proofId: proof.id, orderId: order.id },
    });

    await conn.query(
      'UPDATE order_proofs SET verified = 1, verified_at = NOW(), verified_by = ? WHERE id = ?',
      [adminId, proof.id],
    );

    await conn.commit();
    return { subscriptionId, paymentId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

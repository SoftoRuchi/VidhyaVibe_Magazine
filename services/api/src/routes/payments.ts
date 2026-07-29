import { Router } from 'express';
import { verifyAccessToken } from '../auth/jwt';
import { getPool, query } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { guestCheckoutRateLimiter } from '../middleware/rateLimiter';
import { memoryUpload } from '../middleware/upload';
import { getStorageAdapter } from '../providers/storage';
import { previewCouponDiscount, normalizeCouponCode } from '../services/coupons';
import { upsertGuestBuyer, ensureShippingAddress } from '../services/guestBuyer';
import {
  AlreadyPurchasedError,
  assertMagazineNotAlreadyPurchased,
} from '../services/magazinePurchaseGuard';
import { sendCheckoutAcknowledgement } from '../services/notifications';
import {
  createOrder,
  attachProof,
  createEditionOrder,
  attachEditionProof,
  confirmRazorpayPayment,
} from '../services/payments';
import { computeSubscriptionAmount } from '../utils/subscriptionPricing';

const router = Router();
const upload = memoryUpload;

function optionalUserIdFromRequest(req: any): number | undefined {
  try {
    const auth = req.headers?.authorization;
    let token: string | null = null;
    if (auth) {
      const parts = String(auth).split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
        token = parts[1];
      }
    }
    if (!token) {
      const alt = req.headers?.['x-access-token'];
      if (typeof alt === 'string' && alt.trim()) token = alt.trim();
    }
    if (!token) return undefined;
    const payload = verifyAccessToken(token);
    const id = Number(payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

function mapCouponReason(reason?: string) {
  switch (reason) {
    case 'not_found':
      return 'Coupon code not found.';
    case 'inactive':
      return 'This coupon is no longer active.';
    case 'expired':
      return 'This coupon has expired.';
    case 'exhausted':
      return 'This coupon has reached its usage limit.';
    case 'user_limit_exceeded':
      return 'You have already used this coupon the maximum number of times.';
    case 'invalid_for_plan':
      return 'This coupon is not valid for the selected plan.';
    case 'invalid_for_magazine':
      return 'This coupon is not valid for the selected magazine.';
    case 'not_allowed_for_user':
      return 'This coupon is not available for your account.';
    default:
      return 'Invalid coupon code.';
  }
}

function mapOrderError(e: any) {
  if (e instanceof AlreadyPurchasedError || e?.code === 'already_purchased_magazine') {
    return {
      status: 409,
      body: {
        error: 'already_purchased_magazine',
        message:
          e.message ||
          'You have already purchased or subscribed to this magazine with this email or mobile number.',
      },
    };
  }
  const msg = String(e?.message || '');
  if (msg.startsWith('invalid_coupon:')) {
    const reason = msg.slice('invalid_coupon:'.length);
    return {
      status: 400,
      body: {
        error: 'invalid_coupon',
        reason,
        message: mapCouponReason(reason),
      },
    };
  }
  if (msg === 'physical_address_required' || msg === 'delivery_address_required') {
    return {
      status: 400,
      body: {
        error: 'physical_address_required',
        message: 'Please enter a delivery address for physical magazine delivery.',
      },
    };
  }
  if (msg === 'city_required') {
    return {
      status: 400,
      body: { error: 'city_required', message: 'Please enter your city.' },
    };
  }
  if (msg === 'pincode_required') {
    return {
      status: 400,
      body: { error: 'pincode_required', message: 'Please enter a valid 6-digit PIN code.' },
    };
  }
  return {
    status: 400,
    body: { error: 'order_failed', message: e?.message || 'Order failed' },
  };
}

/**
 * Guest checkout — no login token.
 * Collects name/phone/email, creates order, sends acknowledgement.
 */
router.post('/guest-create-order', guestCheckoutRateLimiter, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phoneRaw = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const { planId, months, deliveryMode, couponCode, magazineId } = req.body || {};
  const deliveryAddress =
    typeof req.body?.deliveryAddress === 'string' ? req.body.deliveryAddress.trim() : '';
  const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
  const state = typeof req.body?.state === 'string' ? req.body.state.trim() : '';
  const pincode = typeof req.body?.pincode === 'string' ? req.body.pincode.trim() : '';
  const mode = deliveryMode || 'ELECTRONIC';
  const needsShipping = ['PHYSICAL', 'BOTH'].includes(String(mode));

  if (!name || name.length < 2) {
    return res
      .status(400)
      .json({ error: 'name_required', message: 'Please enter your full name.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res
      .status(400)
      .json({ error: 'email_required', message: 'Please enter a valid email address.' });
  }
  if (phoneDigits.length < 10) {
    return res
      .status(400)
      .json({ error: 'phone_required', message: 'Please enter a valid mobile number.' });
  }
  if (!planId || !months || !magazineId) {
    return res
      .status(400)
      .json({ error: 'missing_fields', message: 'Plan, months and magazine are required.' });
  }
  if (needsShipping) {
    if (!deliveryAddress || deliveryAddress.length < 8) {
      return res.status(400).json({
        error: 'delivery_address_required',
        message: 'Please enter your full delivery address.',
      });
    }
    if (!city) {
      return res.status(400).json({ error: 'city_required', message: 'Please enter your city.' });
    }
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        error: 'pincode_required',
        message: 'Please enter a valid 6-digit PIN code.',
      });
    }
  }

  const phone = phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10);
  const magId = Number(magazineId);

  try {
    // Block before account upsert / Razorpay order if email or mobile already paid for this magazine
    await assertMagazineNotAlreadyPurchased({
      magazineId: magId,
      email,
      phone,
    });

    const { userId, created, temporaryPassword } = await upsertGuestBuyer({
      name,
      email,
      phone,
      deliveryAddress: needsShipping ? deliveryAddress : undefined,
    });

    let addressId: number | undefined;
    if (needsShipping) {
      addressId = await ensureShippingAddress({
        userId,
        line1: deliveryAddress,
        city,
        state,
        pincode,
      });
    }

    const result = await createOrder({
      userId,
      planId: Number(planId),
      months: Number(months),
      deliveryMode: mode,
      couponCode,
      magazineId: magId,
      addressId,
      guest: { name, email, phone },
    });

    // Await so mail is actually attempted before the response (avoids dropped fire-and-forget work)
    let acknowledgementSent = false;
    let acknowledgementDetail: string | undefined;
    try {
      const ack = await sendCheckoutAcknowledgement({
        name,
        email,
        phone,
        temporaryPassword,
        accountCreated: created,
      });
      acknowledgementSent = Boolean(ack.emailSent);
      acknowledgementDetail = ack.detail;
      if (!ack.emailSent) {
        console.warn('[guest-create-order] email not sent', { email, detail: ack.detail });
      }
    } catch (err) {
      console.error('[guest-create-order] acknowledgement failed', err);
    }

    res.json({
      ...result,
      acknowledgementSent,
      acknowledgementDetail,
      accountCreated: created,
      guest: { name, email, phone },
    });
  } catch (e: any) {
    console.error(e);
    const mapped = mapOrderError(e);
    if (mapped.body.error === 'order_failed') {
      mapped.body.error = 'guest_create_order_failed';
    }
    res.status(mapped.status).json(mapped.body);
  }
});

/**
 * Preview / validate a coupon against plan + magazine + months.
 * Public so guest checkout can show the discounted total before payment.
 */
router.post('/validate-coupon', async (req: AuthRequest, res) => {
  const code = normalizeCouponCode(req.body?.couponCode || req.body?.code || '');
  const planId = req.body?.planId != null ? Number(req.body.planId) : undefined;
  const magazineId = req.body?.magazineId != null ? Number(req.body.magazineId) : undefined;
  const months = req.body?.months != null ? Number(req.body.months) : undefined;
  const deliveryMode = req.body?.deliveryMode || 'ELECTRONIC';
  const userId = req.user?.id ? Number(req.user.id) : optionalUserIdFromRequest(req);

  if (!code) {
    return res
      .status(400)
      .json({ valid: false, error: 'coupon_required', message: 'Enter a coupon code.' });
  }
  if (!planId || !months) {
    return res
      .status(400)
      .json({ valid: false, error: 'missing_fields', message: 'Select a plan and months first.' });
  }

  try {
    const pool = getPool();
    const conn = await pool.getConnection();
    let baseAmount = 0;
    let currency = 'INR';
    try {
      const [planRows]: any = await conn.query(
        'SELECT * FROM subscription_plans WHERE id = ? AND active = 1 LIMIT 1',
        [planId],
      );
      const plan = planRows[0];
      if (!plan) {
        return res
          .status(404)
          .json({ valid: false, error: 'plan_not_found', message: 'Plan not found.' });
      }

      let effectivePrice = Number(plan.defaultPrice ?? plan.price ?? 0);
      currency = (plan.defaultCurrency ?? plan.currency) || 'INR';

      if (magazineId) {
        try {
          const [mpRows]: any = await conn.query(
            `SELECT price, currency FROM magazine_plans
             WHERE magazine_id = ? AND plan_id = ? AND delivery_mode = ? AND active = 1 LIMIT 1`,
            [magazineId, planId, deliveryMode],
          );
          if (mpRows[0]) {
            effectivePrice = Number(mpRows[0].price);
            currency = mpRows[0].currency || currency;
          }
        } catch {
          const [mpRows]: any = await conn.query(
            `SELECT price, currency FROM magazine_plans
             WHERE magazineId = ? AND planId = ? AND deliveryMode = ? AND active = 1 LIMIT 1`,
            [magazineId, planId, deliveryMode],
          );
          if (mpRows[0]) {
            effectivePrice = Number(mpRows[0].price);
            currency = mpRows[0].currency || currency;
          }
        }
      }

      baseAmount = computeSubscriptionAmount(effectivePrice, months, plan);
    } finally {
      conn.release();
    }

    const preview = await previewCouponDiscount(code, baseAmount, userId, planId, magazineId);
    if (!preview.valid) {
      return res.status(400).json({
        valid: false,
        error: 'invalid_coupon',
        reason: preview.reason,
        message: mapCouponReason(preview.reason),
      });
    }

    return res.json({
      valid: true,
      code,
      amount: baseAmount,
      finalAmount: preview.finalAmount,
      discountAmount: preview.discountAmount,
      discountPct: preview.discountPct,
      discountFixed: preview.discountFixed,
      currency,
      message:
        preview.discountPct != null
          ? `${preview.discountPct}% off applied`
          : preview.discountFixed != null
            ? `₹${preview.discountFixed} off applied`
            : 'Coupon applied',
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ valid: false, error: 'validate_failed', message: e.message });
  }
});

/** Confirm Razorpay payment for guest checkout (signature-verified, no JWT). */
router.post('/razorpay/guest-confirm', async (req, res) => {
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
  if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const result = await confirmRazorpayPayment({
      orderId: Number(orderId),
      razorpay_payment_id: String(razorpay_payment_id),
      razorpay_order_id: String(razorpay_order_id),
      razorpay_signature: String(razorpay_signature),
      allowGuest: true,
    });
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'confirm_failed', message: e.message });
  }
});

router.use(requireAuth);

// create order (user-facing)
router.post('/create-order', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const {
    planId,
    months,
    readerId,
    deliveryMode,
    addressId,
    couponCode,
    magazineId,
    deliveryAddress,
    city,
    state,
    pincode,
  } = req.body;
  try {
    const mode = deliveryMode || 'ELECTRONIC';
    const needsShipping = ['PHYSICAL', 'BOTH'].includes(String(mode));
    let resolvedAddressId = addressId ? Number(addressId) : undefined;

    if (needsShipping && !resolvedAddressId) {
      const line1 = typeof deliveryAddress === 'string' ? deliveryAddress.trim() : '';
      const cityVal = typeof city === 'string' ? city.trim() : '';
      const stateVal = typeof state === 'string' ? state.trim() : '';
      const pin = typeof pincode === 'string' ? pincode.trim() : '';
      if (!line1 || !cityVal || !/^\d{6}$/.test(pin)) {
        return res.status(400).json({
          error: 'physical_address_required',
          message: 'Please enter delivery address, city and 6-digit PIN code.',
        });
      }
      resolvedAddressId = await ensureShippingAddress({
        userId,
        line1,
        city: cityVal,
        state: stateVal,
        pincode: pin,
      });
      // Keep profile deliveryAddress in sync
      try {
        await query('UPDATE users SET deliveryAddress = ? WHERE id = ?', [line1, userId]);
      } catch {
        // ignore profile sync errors
      }
    }

    const result = await createOrder({
      userId,
      planId: Number(planId),
      months: Number(months),
      readerId,
      deliveryMode: mode,
      addressId: resolvedAddressId,
      couponCode,
      magazineId,
    });
    res.json(result);
  } catch (e: any) {
    console.error(e);
    const mapped = mapOrderError(e);
    if (mapped.body.error === 'order_failed') {
      mapped.body.error = 'create_order_failed';
    }
    res.status(mapped.status).json(mapped.body);
  }
});

// confirm Razorpay payment + update order status (user-facing)
router.post('/razorpay/confirm', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const result = await confirmRazorpayPayment({
      userId,
      orderId: Number(orderId),
      razorpay_payment_id: String(razorpay_payment_id),
      razorpay_order_id: String(razorpay_order_id),
      razorpay_signature: String(razorpay_signature),
    });
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'confirm_failed', message: e.message });
  }
});

// purchase single edition
router.post('/purchase-edition', async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const { editionId } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  if (!editionId) return res.status(400).json({ error: 'editionId_required' });
  try {
    const result = await createEditionOrder(userId, Number(editionId));
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: 'purchase_failed', message: e.message });
  }
});

// upload payment proof for edition order
router.post(
  '/edition-order/:orderId/proof',
  upload.single('proof'),
  async (req: AuthRequest, res) => {
    const userId = Number(req.user?.id);
    const orderId = Number(req.params.orderId);
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    try {
      const storage = getStorageAdapter();
      let fileKey: string | undefined = undefined;
      if (req.file) {
        const key = `payments/edition/${orderId}/${Date.now()}-${req.file.originalname}`;
        const up = await storage.upload(key, req.file.buffer, req.file.mimetype);
        fileKey = up.key;
      } else if (req.body?.url) {
        return res.status(400).json({ error: 'file_required' });
      } else {
        return res.status(400).json({ error: 'file_or_url_required' });
      }
      const proofId = await attachEditionProof(orderId, userId, fileKey);
      res.status(201).json({ proofId });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'attach_proof_failed', message: e.message });
    }
  },
);

// upload payment proof (multipart) - for subscription orders
router.post('/:orderId/proof', upload.single('proof'), async (req: AuthRequest, res) => {
  const userId = Number(req.user?.id);
  const orderId = Number(req.params.orderId);
  try {
    const storage = getStorageAdapter();
    let fileKey: string | undefined = undefined;
    let url: string | undefined = undefined;
    if (req.file) {
      const key = `payments/${orderId}/${Date.now()}-${req.file.originalname}`;
      const up = await storage.upload(key, req.file.buffer, req.file.mimetype);
      fileKey = up.key;
      url = up.url;
    } else if (req.body.url) {
      url = req.body.url;
    } else {
      return res.status(400).json({ error: 'file_or_url_required' });
    }
    const proofId = await attachProof(orderId, userId, fileKey, url);
    res.status(201).json({ proofId });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'attach_proof_failed', message: e.message });
  }
});

export default router;

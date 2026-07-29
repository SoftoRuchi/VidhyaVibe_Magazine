import { prisma } from '@magazine/db';
import { getPool } from '../db';

export type CouponValidationResult = {
  valid: boolean;
  reason?: string;
  coupon?: any;
  discountAmount?: number;
  discountPct?: number | null;
  discountFixed?: number | null;
};

/** Normalize coupon codes for consistent lookup/storage. */
export function normalizeCouponCode(code: string): string {
  return String(code || '')
    .trim()
    .toUpperCase();
}

/** Ensure visibility columns + assignment table exist (safe to call repeatedly). */
let visibilitySchemaReady = false;
export async function ensureCouponVisibilitySchema() {
  if (visibilitySchemaReady) return;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [showCols]: any = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'coupons'
         AND COLUMN_NAME = 'showToUsers'`,
    );
    if (!Number(showCols?.[0]?.cnt)) {
      await conn.query(
        'ALTER TABLE coupons ADD COLUMN showToUsers TINYINT(1) NOT NULL DEFAULT 1 AFTER active',
      );
    }

    const [restrictCols]: any = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'coupons'
         AND COLUMN_NAME = 'restrictToUsers'`,
    );
    if (!Number(restrictCols?.[0]?.cnt)) {
      await conn.query(
        'ALTER TABLE coupons ADD COLUMN restrictToUsers TINYINT(1) NOT NULL DEFAULT 0 AFTER showToUsers',
      );
    }

    await conn.query(
      `CREATE TABLE IF NOT EXISTS coupon_user_assignments (
         id BIGINT NOT NULL AUTO_INCREMENT,
         couponId BIGINT NOT NULL,
         userId BIGINT NOT NULL,
         createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
         PRIMARY KEY (id),
         UNIQUE KEY coupon_user_assignments_coupon_user_unique (couponId, userId),
         INDEX coupon_user_assignments_couponId_idx (couponId),
         INDEX coupon_user_assignments_userId_idx (userId)
       ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    visibilitySchemaReady = true;
  } catch (e) {
    console.warn('[coupons] ensureCouponVisibilitySchema:', (e as Error)?.message || e);
  } finally {
    conn.release();
  }
}

export async function isUserAssignedToCoupon(couponId: number, userId: number): Promise<boolean> {
  const pool = getPool();
  const [rows]: any = await pool.query(
    'SELECT id FROM coupon_user_assignments WHERE couponId = ? AND userId = ? LIMIT 1',
    [couponId, userId],
  );
  return Boolean(rows?.[0]);
}

/** Read discount fields whether Prisma (camelCase) or raw SQL (snake_case). */
export function getCouponDiscountFields(coupon: any): {
  discountPct: number | null;
  discountFixed: number | null;
} {
  const pct = coupon?.discountPct ?? coupon?.discount_pct ?? null;
  const fixed = coupon?.discountCents ?? coupon?.discount_cents ?? null;
  return {
    discountPct: pct != null ? Number(pct) : null,
    discountFixed: fixed != null ? Number(fixed) : null,
  };
}

/** Apply coupon discount to a whole-currency amount. */
export function applyCouponDiscount(amount: number, coupon: any): number {
  const { discountPct, discountFixed } = getCouponDiscountFields(coupon);
  let final = Number(amount);
  if (discountPct != null && discountPct > 0) {
    final = Math.max(0, final - Math.round((final * discountPct) / 100));
  } else if (discountFixed != null && discountFixed > 0) {
    // NOTE: despite the column name discountCents, treat as whole currency units
    final = Math.max(0, final - discountFixed);
  }
  return final;
}

export async function validateCoupon(
  code: string,
  userId?: number,
  planId?: number,
  magazineId?: number,
): Promise<CouponValidationResult> {
  await ensureCouponVisibilitySchema();
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { valid: false, reason: 'not_found' };

  // Try exact (normalized) match first, then original for older mixed-case rows
  const coupon =
    (await prisma.coupon.findUnique({ where: { code: normalized } })) ||
    (await prisma.coupon.findUnique({ where: { code: String(code).trim() } }));

  if (!coupon) return { valid: false, reason: 'not_found' };
  if (!coupon.active) return { valid: false, reason: 'inactive' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  // Selected-users only
  const restricted = Boolean((coupon as any).restrictToUsers);
  if (restricted) {
    if (!userId) return { valid: false, reason: 'not_allowed_for_user' };
    const allowed = await isUserAssignedToCoupon(Number(coupon.id), Number(userId));
    if (!allowed) return { valid: false, reason: 'not_allowed_for_user' };
  }

  // scope checks
  if (coupon.planId && planId && Number(coupon.planId) !== Number(planId)) {
    return { valid: false, reason: 'invalid_for_plan' };
  }
  if (coupon.magazineId && magazineId && Number(coupon.magazineId) !== Number(magazineId)) {
    return { valid: false, reason: 'invalid_for_magazine' };
  }

  // global usage limit
  if (coupon.maxUses) {
    const cnt = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (cnt >= Number(coupon.maxUses)) return { valid: false, reason: 'exhausted' };
  }

  // per-user limit
  if (userId && coupon.perUserLimit) {
    const pcnt = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (pcnt >= Number(coupon.perUserLimit)) {
      return { valid: false, reason: 'user_limit_exceeded' };
    }
  }

  const { discountPct, discountFixed } = getCouponDiscountFields(coupon);
  return {
    valid: true,
    coupon,
    discountPct,
    discountFixed,
  };
}

/** Preview discount for a given base amount (does not record usage). */
export async function previewCouponDiscount(
  code: string,
  baseAmount: number,
  userId?: number,
  planId?: number,
  magazineId?: number,
): Promise<CouponValidationResult & { finalAmount?: number }> {
  const v = await validateCoupon(code, userId, planId, magazineId);
  if (!v.valid || !v.coupon) return v;
  const finalAmount = applyCouponDiscount(baseAmount, v.coupon);
  return {
    ...v,
    discountAmount: Math.max(0, Number(baseAmount) - finalAmount),
    finalAmount,
  };
}

export async function recordCouponUsage(
  couponId: number,
  userId?: number,
  subscriptionId?: number,
) {
  const r = await prisma.couponUsage.create({
    data: {
      couponId,
      userId: userId || undefined,
      subscriptionId: subscriptionId || undefined,
    },
  });
  return r.id;
}

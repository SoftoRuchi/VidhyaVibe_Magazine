import { getPool, query } from '../db';

const ALREADY_PURCHASED_MESSAGE =
  'You have already purchased or subscribed to this magazine with this email or mobile number.';

export class AlreadyPurchasedError extends Error {
  code = 'already_purchased_magazine';
  constructor(message = ALREADY_PURCHASED_MESSAGE) {
    super(message);
    this.name = 'AlreadyPurchasedError';
  }
}

function normalizeEmail(email?: string | null): string {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** Last 10 digits — Indian mobile style */
export function normalizePhone(phone?: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function phoneSqlExpr(columnSql: string): string {
  // Strip common separators then take last 10 digits
  return `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${columnSql}, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 10)`;
}

/**
 * Block repurchase when email OR mobile already has a PAID order
 * or an ACTIVE subscription for the same magazine.
 */
export async function assertMagazineNotAlreadyPurchased(params: {
  magazineId: number;
  email?: string | null;
  phone?: string | null;
  userId?: number | null;
}): Promise<void> {
  const magazineId = Number(params.magazineId);
  if (!magazineId) return;

  let email = normalizeEmail(params.email);
  let phone = normalizePhone(params.phone);
  const userId = params.userId != null ? Number(params.userId) : null;

  // Logged-in checkout may omit guest contact — load from users
  if (userId && (!email || !phone)) {
    const [rows]: any = await query('SELECT email, phone FROM users WHERE id = ? LIMIT 1', [
      userId,
    ]);
    if (rows?.[0]) {
      if (!email) email = normalizeEmail(rows[0].email);
      if (!phone) phone = normalizePhone(rows[0].phone);
    }
  }

  if (!email && !phone && !userId) return;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // 1) Active subscription for this magazine (by user id / email / phone)
    const subParams: any[] = [magazineId];
    const subConds: string[] = [];

    if (userId) {
      subConds.push('us.userId = ?');
      subParams.push(userId);
    }
    if (email) {
      subConds.push('LOWER(u.email) = ?');
      subParams.push(email);
    }
    if (phone && phone.length === 10) {
      subConds.push(`${phoneSqlExpr('u.phone')} = ?`);
      subParams.push(phone);
    }

    if (subConds.length > 0) {
      const [subs]: any = await conn.query(
        `SELECT us.id
         FROM user_subscriptions us
         JOIN users u ON u.id = us.userId
         WHERE us.magazineId = ?
           AND us.status = 'ACTIVE'
           AND (us.endsAt IS NULL OR us.endsAt > NOW())
           AND (${subConds.join(' OR ')})
         LIMIT 1`,
        subParams,
      );
      if (subs?.[0]) {
        throw new AlreadyPurchasedError();
      }
    }

    // 2) Paid order for this magazine (guest snapshot or linked user)
    const orderParams: any[] = [magazineId];
    const orderConds: string[] = [];

    if (userId) {
      orderConds.push('o.user_id = ?');
      orderParams.push(userId);
    }
    if (email) {
      orderConds.push('LOWER(COALESCE(o.guest_email, "")) = ?');
      orderParams.push(email);
      orderConds.push('LOWER(u.email) = ?');
      orderParams.push(email);
    }
    if (phone && phone.length === 10) {
      orderConds.push(`${phoneSqlExpr('o.guest_phone')} = ?`);
      orderParams.push(phone);
      orderConds.push(`${phoneSqlExpr('u.phone')} = ?`);
      orderParams.push(phone);
    }

    if (orderConds.length > 0) {
      const [orders]: any = await conn.query(
        `SELECT o.id
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.magazine_id = ?
           AND UPPER(COALESCE(o.status, '')) = 'PAID'
           AND (${orderConds.join(' OR ')})
         LIMIT 1`,
        orderParams,
      );
      if (orders?.[0]) {
        throw new AlreadyPurchasedError();
      }
    }
  } finally {
    conn.release();
  }
}

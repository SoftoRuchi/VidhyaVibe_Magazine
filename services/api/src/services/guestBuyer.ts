import crypto from 'crypto';
import { hashPassword } from '../auth/password';
import { getPool } from '../db';

/** 6-digit numeric password for guest checkout (emailed as login OTP). */
export function generateOtpPassword(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export type UpsertGuestBuyerResult = {
  userId: number;
  created: boolean;
  /** Fresh 6-digit password — only for newly created accounts (existing emails keep their password) */
  temporaryPassword?: string;
};

/**
 * Upsert a buyer by email for guest checkout.
 * New email → create account + 6-digit OTP password.
 * Existing email → update profile only; do NOT reset password.
 * Does NOT create a session/token.
 */
export async function upsertGuestBuyer(params: {
  name: string;
  email: string;
  phone: string;
  deliveryAddress?: string;
}): Promise<UpsertGuestBuyerResult> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phoneDigits = params.phone.replace(/\D/g, '');
  const phone = phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10);
  const deliveryAddress = params.deliveryAddress?.trim() || null;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'CREATE TABLE IF NOT EXISTS user_auth (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNIQUE, password_hash VARCHAR(255), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      [],
    );

    const [existing]: any = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [
      email,
    ]);
    let userId: number;
    let created = false;
    let temporaryPassword: string | undefined;

    if (existing?.[0]) {
      userId = Number(existing[0].id);
      await conn.query(
        'UPDATE users SET name = ?, phone = ?, deliveryAddress = COALESCE(?, deliveryAddress), updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [name, phone, deliveryAddress, userId],
      );
      // Existing account: keep current password — no OTP reset
    } else {
      const [uRes]: any = await conn.query(
        'INSERT INTO users (email, name, phone, deliveryAddress, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))',
        [email, name, phone, deliveryAddress],
      );
      userId = Number(uRes.insertId);
      created = true;

      temporaryPassword = generateOtpPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await conn.query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [
        userId,
        passwordHash,
      ]);
    }

    await conn.commit();
    return { userId, created, temporaryPassword };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Create (or reuse) a shipping address row for physical / both delivery. */
export async function ensureShippingAddress(params: {
  userId: number;
  line1: string;
  city: string;
  state?: string;
  pincode: string;
  country?: string;
}): Promise<number> {
  const line1 = params.line1.trim();
  const city = params.city.trim();
  const state = params.state?.trim() || null;
  const postalCode = params.pincode.trim();
  const country = (params.country || 'India').trim() || 'India';
  if (!line1 || line1.length < 8) throw new Error('delivery_address_required');
  if (!city) throw new Error('city_required');
  if (!/^\d{6}$/.test(postalCode)) throw new Error('pincode_required');

  const pool = getPool();
  const [existing]: any = await pool.query(
    `SELECT id FROM addresses
     WHERE userId = ? AND line1 = ? AND city = ? AND postalCode = ?
     ORDER BY id DESC LIMIT 1`,
    [params.userId, line1, city, postalCode],
  );
  if (existing?.[0]?.id) return Number(existing[0].id);

  const [ins]: any = await pool.query(
    `INSERT INTO addresses (userId, line1, line2, city, state, postalCode, country, createdAt)
     VALUES (?, ?, NULL, ?, ?, ?, ?, NOW(3))`,
    [params.userId, line1, city, state, postalCode, country],
  );
  return Number(ins.insertId);
}

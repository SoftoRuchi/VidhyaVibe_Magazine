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
  /** Fresh 6-digit password — always set so guest checkout can email login OTP */
  temporaryPassword: string;
};

/**
 * Upsert a buyer by email for guest checkout.
 * Always resets login password to a new 6-digit OTP (new or existing email).
 * Does NOT create a session/token.
 */
export async function upsertGuestBuyer(params: {
  name: string;
  email: string;
  phone: string;
}): Promise<UpsertGuestBuyerResult> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phoneDigits = params.phone.replace(/\D/g, '');
  const phone = phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10);

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

    // Always issue a fresh 6-digit OTP password (create or reset)
    const temporaryPassword = generateOtpPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    if (existing?.[0]) {
      userId = Number(existing[0].id);
      await conn.query(
        'UPDATE users SET name = ?, phone = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [name, phone, userId],
      );
    } else {
      const [uRes]: any = await conn.query(
        'INSERT INTO users (email, name, phone, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP(3))',
        [email, name, phone],
      );
      userId = Number(uRes.insertId);
      created = true;
    }

    const [authRows]: any = await conn.query(
      'SELECT user_id FROM user_auth WHERE user_id = ? LIMIT 1',
      [userId],
    );
    if (authRows?.[0]) {
      await conn.query('UPDATE user_auth SET password_hash = ? WHERE user_id = ?', [
        passwordHash,
        userId,
      ]);
    } else {
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

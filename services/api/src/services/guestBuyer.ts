import crypto from 'crypto';
import { hashPassword } from '../auth/password';
import { getPool } from '../db';

/** 6-digit numeric password for new guest accounts (also emailed as login OTP). */
export function generateOtpPassword(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export type UpsertGuestBuyerResult = {
  userId: number;
  created: boolean;
  /** Plain 6-digit password — only set when a new account (or missing auth) was created */
  temporaryPassword?: string;
};

/** Upsert a buyer by email for guest checkout. Does NOT create a session/token. */
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
    let temporaryPassword: string | undefined;

    if (existing?.[0]) {
      userId = Number(existing[0].id);
      await conn.query(
        'UPDATE users SET name = ?, phone = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [name, phone, userId],
      );
    } else {
      temporaryPassword = generateOtpPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const [uRes]: any = await conn.query(
        'INSERT INTO users (email, name, phone, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP(3))',
        [email, name, phone],
      );
      userId = Number(uRes.insertId);
      created = true;
      await conn.query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [
        userId,
        passwordHash,
      ]);
    }

    const [authRows]: any = await conn.query(
      'SELECT user_id FROM user_auth WHERE user_id = ? LIMIT 1',
      [userId],
    );
    if (!authRows?.[0]) {
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

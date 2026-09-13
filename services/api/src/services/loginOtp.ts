import { hashPassword, comparePassword } from '../auth/password';
import { query } from '../db';
import { generateOtpPassword } from './guestBuyer';

async function ensureLoginOtpTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS login_otps (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_login_otps_email (email),
      INDEX idx_login_otps_user (user_id)
    )
  `);
}

export type LoginUserRow = {
  id: number;
  email: string;
  name?: string | null;
  isAdmin?: number | boolean;
};

/** Find a user by email or by unique display name (username). */
export async function findUserByLoginIdentifier(raw: string): Promise<LoginUserRow | null> {
  const identifier = String(raw || '').trim();
  if (!identifier) return null;

  if (identifier.includes('@')) {
    const email = identifier.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const [rows]: any = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows?.[0] || null;
  }

  const [rows]: any = await query(
    'SELECT * FROM users WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 2',
    [identifier],
  );
  if (!rows || rows.length !== 1) return null;
  return rows[0];
}

/** Create a 6-digit login OTP. Does not change the account password. */
export async function createLoginOtp(identifier: string): Promise<{
  otp: string | null;
  user: LoginUserRow | null;
}> {
  await ensureLoginOtpTable();
  const user = await findUserByLoginIdentifier(identifier);
  if (!user?.id || !user.email) {
    return { otp: null, user: null };
  }

  const otp = generateOtpPassword();
  const otpHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    'UPDATE login_otps SET used_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND used_at IS NULL',
    [user.id],
  );
  await query('INSERT INTO login_otps (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)', [
    user.id,
    String(user.email).toLowerCase(),
    otpHash,
    expiresAt,
  ]);

  return { otp, user };
}

/** Verify a login OTP. Password is never modified. */
export async function verifyLoginOtp(params: {
  identifier: string;
  otp: string;
}): Promise<LoginUserRow> {
  await ensureLoginOtpTable();
  const otp = String(params.otp || '').trim();
  if (!/^\d{6}$/.test(otp)) {
    throw Object.assign(new Error('OTP must be a 6-digit code'), { code: 'invalid_otp' });
  }

  const user = await findUserByLoginIdentifier(params.identifier);
  if (!user?.id) {
    throw Object.assign(new Error('Invalid or expired OTP'), { code: 'invalid_or_expired_otp' });
  }

  const [rows]: any = await query(
    `SELECT id, otp_hash, expires_at FROM login_otps
     WHERE user_id = ? AND used_at IS NULL
     ORDER BY id DESC LIMIT 5`,
    [user.id],
  );

  let matchedId: number | null = null;
  for (const row of rows || []) {
    if (new Date(row.expires_at).getTime() < Date.now()) continue;
    const match = await comparePassword(otp, row.otp_hash);
    if (match) {
      matchedId = Number(row.id);
      break;
    }
  }

  if (!matchedId) {
    throw Object.assign(new Error('Invalid or expired OTP'), { code: 'invalid_or_expired_otp' });
  }

  await query('UPDATE login_otps SET used_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [matchedId]);
  await query(
    'UPDATE login_otps SET used_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND used_at IS NULL',
    [user.id],
  );

  return user;
}

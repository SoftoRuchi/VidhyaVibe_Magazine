import { hashPassword, comparePassword } from '../auth/password';
import { getPool, query } from '../db';
import { generateOtpPassword } from './guestBuyer';

async function ensurePasswordResetTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_password_resets_email (email)
    )
  `);
}

export async function changePassword(params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  const newPassword = String(params.newPassword || '');
  if (newPassword.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), {
      code: 'password_too_short',
    });
  }

  const [authRows]: any = await query(
    'SELECT password_hash FROM user_auth WHERE user_id = ? LIMIT 1',
    [params.userId],
  );
  const auth = authRows?.[0];
  if (!auth) {
    throw Object.assign(new Error('No password set for this account'), { code: 'no_auth' });
  }

  const ok = await comparePassword(params.currentPassword, auth.password_hash);
  if (!ok) {
    throw Object.assign(new Error('Current password is incorrect'), {
      code: 'invalid_current_password',
    });
  }

  // Replace hash — old 6-digit password can no longer be used to log in
  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE user_auth SET password_hash = ? WHERE user_id = ?', [
    passwordHash,
    params.userId,
  ]);

  // Invalidate any pending forgot-password OTPs for this user
  try {
    await ensurePasswordResetTable();
    const [users]: any = await query('SELECT email FROM users WHERE id = ? LIMIT 1', [
      params.userId,
    ]);
    const email = users?.[0]?.email;
    if (email) {
      await query(
        'UPDATE password_resets SET used_at = CURRENT_TIMESTAMP(3) WHERE email = ? AND used_at IS NULL',
        [email],
      );
    }
  } catch (e) {
    console.warn('[changePassword] could not invalidate reset OTPs', (e as Error)?.message || e);
  }

  return { ok: true };
}

/** Create a 6-digit reset OTP for email. Returns plaintext OTP to email. */
export async function createPasswordResetOtp(emailRaw: string): Promise<{
  otp: string | null;
  userExists: boolean;
}> {
  await ensurePasswordResetTable();
  const email = emailRaw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Invalid email'), { code: 'invalid_email' });
  }

  const [users]: any = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (!users?.[0]) {
    // Do not reveal whether the email exists
    return { otp: null, userExists: false };
  }

  const otp = generateOtpPassword();
  const otpHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Invalidate previous unused OTPs for this email
  await query(
    'UPDATE password_resets SET used_at = CURRENT_TIMESTAMP(3) WHERE email = ? AND used_at IS NULL',
    [email],
  );
  await query('INSERT INTO password_resets (email, otp_hash, expires_at) VALUES (?, ?, ?)', [
    email,
    otpHash,
    expiresAt,
  ]);

  return { otp, userExists: true };
}

export async function resetPasswordWithOtp(params: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  await ensurePasswordResetTable();
  const email = params.email.trim().toLowerCase();
  const otp = String(params.otp || '').trim();
  const newPassword = String(params.newPassword || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Invalid email'), { code: 'invalid_email' });
  }
  if (!/^\d{6}$/.test(otp)) {
    throw Object.assign(new Error('OTP must be a 6-digit code'), { code: 'invalid_otp' });
  }
  if (newPassword.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), {
      code: 'password_too_short',
    });
  }

  const [rows]: any = await query(
    `SELECT id, otp_hash, expires_at FROM password_resets
     WHERE email = ? AND used_at IS NULL
     ORDER BY id DESC LIMIT 5`,
    [email],
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

  const [users]: any = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  const user = users?.[0];
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'user_not_found' });
  }

  const passwordHash = await hashPassword(newPassword);
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'CREATE TABLE IF NOT EXISTS user_auth (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNIQUE, password_hash VARCHAR(255), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      [],
    );
    const [authRows]: any = await conn.query(
      'SELECT user_id FROM user_auth WHERE user_id = ? LIMIT 1',
      [user.id],
    );
    if (authRows?.[0]) {
      await conn.query('UPDATE user_auth SET password_hash = ? WHERE user_id = ?', [
        passwordHash,
        user.id,
      ]);
    } else {
      await conn.query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [
        user.id,
        passwordHash,
      ]);
    }
    await conn.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [
      matchedId,
    ]);
    await conn.query(
      'UPDATE password_resets SET used_at = CURRENT_TIMESTAMP(3) WHERE email = ? AND used_at IS NULL',
      [email],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { ok: true };
}

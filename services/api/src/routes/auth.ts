import { getEnv } from '@magazine/config';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
} from '../auth/jwt';
import { hashPassword, comparePassword } from '../auth/password';
import { rowIsAdmin } from '../auth/userFlags';
import { getPool, query } from '../db';
import { loginRateLimiter } from '../middleware/rateLimiter';

const env = getEnv();
const router = Router();

// Sessions table may use snake_case (user_id, refresh_jti) or camelCase (userId, refreshJti)
let sessionsSnakeCase: boolean | null = null;

async function isSessionsSnakeCase(): Promise<boolean> {
  if (sessionsSnakeCase === true) return true;
  if (sessionsSnakeCase === false) return false;
  const [cols]: any = await query('SHOW COLUMNS FROM sessions');
  const names = (cols || []).map((c: any) => c.Field);
  const snake = names.includes('refresh_jti') || names.includes('user_id');
  sessionsSnakeCase = snake;
  return snake;
}

async function loadUserWithGuardians(conn: any, userId: number) {
  const [rows]: any = await conn.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  const u = rows[0];
  if (!u) return null;
  const [gRows]: any = await conn.query(
    'SELECT id, name, phone, relation FROM guardians WHERE userId = ? ORDER BY id ASC',
    [u.id],
  );
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    deliveryAddress: u.deliveryAddress,
    isAdmin: rowIsAdmin(u),
    guardians: gRows || [],
  };
}

/** Resolve user id from refresh cookie; optionally mint a fresh access token. */
async function resolveSessionFromRefreshCookie(
  conn: any,
  refreshToken: string,
): Promise<{ userId: number; accessToken?: string } | null> {
  try {
    const payload: any = verifyRefreshToken(refreshToken);
    const jti = payload.jti;
    const snake = await isSessionsSnakeCase();
    const [sessions]: any = await conn.query(
      snake
        ? 'SELECT user_id AS userId FROM sessions WHERE refresh_jti = ? LIMIT 1'
        : 'SELECT userId FROM sessions WHERE refreshJti = ? LIMIT 1',
      [jti],
    );
    const session = sessions[0];
    if (!session) return null;
    const userId = Number(session.userId);
    const [userRows]: any = await conn.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const role = rowIsAdmin(userRows[0]) ? 'admin' : 'user';
    const accessToken = signAccessToken({ sub: userId, role });
    return { userId, accessToken };
  } catch {
    return null;
  }
}

router.use(cookieParser());

// Parent registration: create user + at least one guardian (child info added after login)
router.post('/register', async (req, res) => {
  const { email, password, name, phone, guardians, relation, deliveryAddress } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' });
  }

  let guardianList: { name: string; phone?: string | null; relation?: string | null }[] = [];
  if (Array.isArray(guardians) && guardians.length > 0) {
    guardianList = guardians;
  } else {
    if (!name || !phone || !relation || !deliveryAddress) {
      return res.status(400).json({
        error: 'required_fields_missing',
        message: 'name, email, phone, relation, deliveryAddress and password are required',
      });
    }
    const parentName = typeof name === 'string' ? name.trim() : '';
    if (!parentName) {
      return res.status(400).json({
        error: 'parent_name_required',
        message: 'Please enter the parent or guardian full name.',
      });
    }
    guardianList = [
      {
        name: parentName,
        phone: phone || null,
        relation: relation || 'Parent',
      },
    ];
  }

  for (const g of guardianList) {
    if (!g?.name || !String(g.name).trim()) {
      return res.status(400).json({ error: 'guardian_name_required' });
    }
  }

  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const primaryParentName = guardianList[0]?.name?.trim() || null;
    const [uRes]: any = await conn.query(
      'INSERT INTO users (email, name, phone, deliveryAddress, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))',
      [
        email,
        name?.trim() || primaryParentName,
        phone || null,
        deliveryAddress ? String(deliveryAddress).trim() : null,
      ],
    );
    const userId = uRes.insertId;
    let primaryGuardianId: number | null = null;
    for (let i = 0; i < guardianList.length; i++) {
      const g = guardianList[i];
      const [gRes]: any = await conn.query(
        'INSERT INTO guardians (userId, name, phone, relation) VALUES (?, ?, ?, ?)',
        [userId, g.name.trim(), g.phone || null, g.relation || null],
      );
      if (i === 0) primaryGuardianId = gRes.insertId;
    }
    // set primary guardian
    if (primaryGuardianId) {
      await conn.query('UPDATE users SET primaryGuardianId = ? WHERE id = ?', [
        primaryGuardianId,
        userId,
      ]);
    }
    // store password hash in a separate auth table (simple)
    const passwordHash = await hashPassword(password);
    await conn.query(
      'CREATE TABLE IF NOT EXISTS user_auth (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNIQUE, password_hash VARCHAR(255), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      [],
    );
    await conn.query('INSERT INTO user_auth (user_id, password_hash) VALUES (?, ?)', [
      userId,
      passwordHash,
    ]);

    await conn.commit();
    res.status(201).json({ id: userId, email });
  } catch (e: any) {
    try {
      await conn?.rollback?.();
    } catch {
      // ignore rollback errors
    }
    console.error(e);
    res.status(500).json({ error: 'registration_failed', details: e.message });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// Login
router.post('/login', loginRateLimiter, async (req, res) => {
  const { email, password, deviceName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const [rows]: any = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const [authRows]: any = await query(
      'SELECT password_hash FROM user_auth WHERE user_id = ? LIMIT 1',
      [user.id],
    );
    const auth = authRows[0];
    if (!auth) return res.status(401).json({ error: 'invalid_credentials' });

    // Do not hold a DB connection during bcrypt — remote MySQL may close idle connections.
    const ok = await comparePassword(password, auth.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const ua = req.headers['user-agent'];
    const userAgent = ua ? String(ua).substring(0, 1000) : null;
    const snake = await isSessionsSnakeCase();
    const isAdmin = rowIsAdmin(user);
    const role = isAdmin ? 'admin' : 'user';
    const access = signAccessToken({ sub: user.id, role });
    const { token: refreshToken, jti } = signRefreshToken({ sub: user.id });

    if (snake) {
      await query(
        'INSERT INTO sessions (user_id, device_name, ip_address, user_agent, refresh_jti, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, deviceName || null, req.ip || null, userAgent, jti],
      );
    } else {
      await query(
        'INSERT INTO sessions (userId, deviceName, ipAddress, userAgent, refreshJti, createdAt) VALUES (?, ?, ?, ?, ?, NOW(3))',
        [user.id, deviceName || null, req.ip || null, userAgent, jti],
      );
    }

    // set refresh token cookie (httpOnly)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    res.json({
      access_token: access,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 15 * 60,
      user: { id: user.id, email: user.email, isAdmin },
    });
  } catch (e: any) {
    console.error('Login error:', e);
    res.status(500).json({
      error: 'login_failed',
      details: e?.message || String(e),
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    const refreshToken =
      req.cookies['refresh_token'] ||
      req.body.refresh_token ||
      (typeof req.headers['x-refresh-token'] === 'string'
        ? req.headers['x-refresh-token']
        : undefined);
    if (!refreshToken) return res.status(401).json({ error: 'missing_refresh' });
    const payload: any = verifyRefreshToken(refreshToken);
    const jti = payload.jti;
    const snake = await isSessionsSnakeCase();
    const [rows]: any = await conn.query(
      snake
        ? 'SELECT id, user_id AS userId FROM sessions WHERE refresh_jti = ? LIMIT 1'
        : 'SELECT id, userId FROM sessions WHERE refreshJti = ? LIMIT 1',
      [jti],
    );
    const session = rows[0];
    if (!session) return res.status(401).json({ error: 'invalid_session' });

    // Fetch user role so the refreshed access token carries the correct role
    const [userRows]: any = await conn.query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      session.userId,
    ]);
    const user = userRows[0];
    const role = rowIsAdmin(user) ? 'admin' : 'user';

    const access = signAccessToken({ sub: session.userId, role });
    res.json({
      access_token: access,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 15 * 60,
    });
  } catch (e: any) {
    console.error(e);
    res.status(401).json({ error: 'invalid_refresh' });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// logout
router.post('/logout', async (req, res) => {
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    const refreshToken = req.cookies['refresh_token'] || req.body.refresh_token;
    if (refreshToken) {
      try {
        const payload: any = verifyRefreshToken(refreshToken);
        const jti = payload.jti;
        const snake = await isSessionsSnakeCase();
        await conn.query(
          snake
            ? 'DELETE FROM sessions WHERE refresh_jti = ?'
            : 'DELETE FROM sessions WHERE refreshJti = ?',
          [jti],
        );
      } catch (e) {
        // ignore invalid token
      }
    }
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'logout_failed' });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// current user - accepts Bearer access token OR refresh cookie
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();

    if (auth) {
      const parts = auth.split(' ');
      if (parts.length === 2) {
        const token = parts[1];
        try {
          const payload: any = verifyAccessToken(token);
          const userId = Number(payload.sub);
          const profile = await loadUserWithGuardians(conn, userId);
          if (profile) return res.json(profile);
        } catch {
          // Access token expired or invalid — fall through to refresh cookie below.
        }
      }
    }

    const refreshToken =
      req.cookies['refresh_token'] ||
      (typeof req.headers['x-refresh-token'] === 'string'
        ? req.headers['x-refresh-token']
        : undefined);
    if (!refreshToken) return res.status(401).json({ error: 'missing_auth' });

    const session = await resolveSessionFromRefreshCookie(conn, refreshToken);
    if (!session) return res.status(401).json({ error: 'invalid_session' });

    const profile = await loadUserWithGuardians(conn, session.userId);
    if (!profile) return res.status(404).json({ error: 'user_not_found' });

    return res.json({
      ...profile,
      ...(session.accessToken ? { access_token: session.accessToken } : {}),
    });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

// Update current user profile (name, phone, deliveryAddress)
router.put('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing_auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid_auth' });
  const token = parts[1];
  let conn: any;
  try {
    const pool = getPool();
    conn = await pool.getConnection();
    const payload: any = verifyAccessToken(token);
    const userId = Number(payload?.sub);
    if (!userId) return res.status(401).json({ error: 'invalid_token' });
    const { name, phone, deliveryAddress } = req.body;
    const hasDeliveryAddress = Object.prototype.hasOwnProperty.call(
      req.body || {},
      'deliveryAddress',
    );
    if (hasDeliveryAddress) {
      await conn.query('UPDATE users SET name = ?, phone = ?, deliveryAddress = ? WHERE id = ?', [
        name ?? null,
        phone ?? null,
        deliveryAddress ?? null,
        userId,
      ]);
    } else {
      await conn.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [
        name ?? null,
        phone ?? null,
        userId,
      ]);
    }
    const [prow]: any = await conn.query(
      'SELECT primaryGuardianId FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    const pgId = prow[0]?.primaryGuardianId;
    if (pgId) {
      await conn.query('UPDATE guardians SET name = ?, phone = ? WHERE id = ? AND userId = ?', [
        name ?? null,
        phone ?? null,
        pgId,
        userId,
      ]);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(401).json({ error: 'invalid_token' });
  } finally {
    try {
      conn?.release?.();
    } catch {
      // ignore release errors
    }
  }
});

export default router;

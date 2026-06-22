import { getEnv } from '@magazine/config';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const env = getEnv();
const accessSecret = env.JWT_ACCESS_SECRET || 'dev_access_secret';
const refreshSecret = env.JWT_REFRESH_SECRET || 'dev_refresh_secret';

/** Bare numbers in env (e.g. "2" or "15") are minutes — jwt treats raw numbers as seconds. */
function normalizeAccessExpires(raw: string | undefined): string {
  const v = (raw || '15m').trim();
  if (/^\d+$/.test(v)) return `${v}m`;
  return v;
}

const accessExpires = normalizeAccessExpires(env.JWT_ACCESS_EXPIRES);
const refreshExpires = env.JWT_REFRESH_EXPIRES || '7d';

export function signAccessToken(payload: object) {
  return jwt.sign({ ...payload }, accessSecret, { expiresIn: accessExpires });
}

export function signRefreshToken(payload: object) {
  // include a jti for session tracking
  const jti = uuidv4();
  return {
    token: jwt.sign({ ...payload, jti }, refreshSecret, { expiresIn: refreshExpires }),
    jti,
  };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret) as any;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret) as any;
}

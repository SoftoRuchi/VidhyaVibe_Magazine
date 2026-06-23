import { getEnv } from '@magazine/config';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/** Bare numbers in env (e.g. "2") mean minutes — jwt treats raw numbers as seconds. */
function normalizeAccessExpires(raw: string | undefined): string {
  const v = (raw || '15m').trim();
  if (/^\d+$/.test(v)) return `${v}m`;
  return v;
}

function accessSecret(): string {
  return getEnv().JWT_ACCESS_SECRET || 'dev_access_secret';
}

function refreshSecret(): string {
  return getEnv().JWT_REFRESH_SECRET || 'dev_refresh_secret';
}

function accessExpires(): string {
  return normalizeAccessExpires(getEnv().JWT_ACCESS_EXPIRES);
}

export function signAccessToken(payload: object) {
  return jwt.sign({ ...payload }, accessSecret(), { expiresIn: accessExpires() });
}

export function signRefreshToken(payload: object) {
  const jti = uuidv4();
  return {
    token: jwt.sign({ ...payload, jti }, refreshSecret(), {
      expiresIn: getEnv().JWT_REFRESH_EXPIRES || '7d',
    }),
    jti,
  };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret()) as { sub?: string | number; role?: string };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret()) as { sub?: string | number; jti?: string };
}

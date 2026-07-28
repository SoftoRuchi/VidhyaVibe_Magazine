import { getEnv } from '@magazine/config';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/** Bare numbers in env (e.g. "2") mean minutes — jwt treats raw numbers as seconds. */
function normalizeAccessExpires(raw: string | undefined): string {
  const v = (raw || '30d').trim();
  if (/^\d+$/.test(v)) return `${v}m`;
  return v;
}

/** Parse jwt-style duration (15m, 12h, 30d) to milliseconds. */
export function durationToMs(raw: string | undefined, fallbackMs: number): number {
  const v = (raw || '').trim();
  if (!v) return fallbackMs;
  if (/^\d+$/.test(v)) return Number(v) * 60 * 1000; // bare number = minutes
  const m = v.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 60 * 60 * 1000;
    case 'd':
      return n * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
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

function refreshExpires(): string {
  return (getEnv().JWT_REFRESH_EXPIRES || '30d').trim();
}

export function getAccessExpiresSeconds(): number {
  return Math.floor(durationToMs(accessExpires(), 30 * 24 * 60 * 60 * 1000) / 1000);
}

export function getRefreshCookieMaxAgeMs(): number {
  return durationToMs(refreshExpires(), 30 * 24 * 60 * 60 * 1000);
}

export function signAccessToken(payload: object) {
  return jwt.sign({ ...payload }, accessSecret(), { expiresIn: accessExpires() });
}

export function signRefreshToken(payload: object) {
  const jti = uuidv4();
  return {
    token: jwt.sign({ ...payload, jti }, refreshSecret(), {
      expiresIn: refreshExpires(),
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

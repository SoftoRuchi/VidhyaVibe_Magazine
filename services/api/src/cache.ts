import { getEnv } from '@magazine/config';
import Redis from 'ioredis';

const env = getEnv();
let client: Redis | null = null;
/** When Redis is down, skip it for the rest of this process (in-memory cache still works). */
let redisUsable = true;

export function getRedis() {
  if (!redisUsable) return null;
  if (client) return client;
  const url = process.env.REDIS_URL || env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  client.on('error', (err) => {
    console.warn('[cache] Redis unavailable:', err.message);
    redisUsable = false;
  });
  return client;
}

export async function cacheGet(key: string) {
  const r = getRedis();
  if (!r || !redisUsable) return null;
  try {
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    redisUsable = false;
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSec?: number) {
  const r = getRedis();
  if (!r || !redisUsable) return;
  try {
    const s = JSON.stringify(value);
    if (ttlSec) await r.set(key, s, 'EX', ttlSec);
    else await r.set(key, s);
  } catch {
    redisUsable = false;
  }
}

export async function cacheDelete(key: string) {
  const r = getRedis();
  if (!r || !redisUsable) return;
  try {
    await r.del(key);
  } catch {
    redisUsable = false;
  }
}

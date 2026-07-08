import { cacheGet, cacheSet } from './cache';
import { memCacheGet, memCacheSet } from './memoryCache';

export async function getCached<T>(key: string): Promise<T | null> {
  const fromRedis = await cacheGet(key);
  if (fromRedis != null) return fromRedis as T;
  return memCacheGet<T>(key);
}

export async function setCached(key: string, value: unknown, ttlSec = 120): Promise<void> {
  memCacheSet(key, value, ttlSec);
  await cacheSet(key, value, ttlSec);
}

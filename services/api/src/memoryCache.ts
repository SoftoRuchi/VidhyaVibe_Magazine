import { BoundedTTLCache } from './utils/boundedCache';

const MAX_KEYS = Number(process.env.MEM_CACHE_MAX_KEYS || 300);
const cache = new BoundedTTLCache<unknown>(MAX_KEYS);

export function memCacheGet<T>(key: string): T | null {
  return cache.get(key) as T | null;
}

export function memCacheSet(key: string, value: unknown, ttlSec: number): void {
  cache.set(key, value, ttlSec * 1000);
}

export function memCacheDelete(key: string): void {
  cache.delete(key);
}

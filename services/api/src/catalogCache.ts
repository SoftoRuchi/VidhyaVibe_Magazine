import { cacheDelete, cacheGet, cacheSet } from './cache';
import { memCacheDelete, memCacheGet, memCacheSet } from './memoryCache';

export async function getCached<T>(key: string): Promise<T | null> {
  const fromRedis = await cacheGet(key);
  if (fromRedis != null) return fromRedis as T;
  return memCacheGet<T>(key);
}

export async function setCached(key: string, value: unknown, ttlSec = 120): Promise<void> {
  memCacheSet(key, value, ttlSec);
  await cacheSet(key, value, ttlSec);
}

export async function deleteCached(key: string): Promise<void> {
  memCacheDelete(key);
  await cacheDelete(key);
}

/** Clear public catalog cache after edition publish/create/update. */
export async function invalidateMagazineCatalog(
  magazineId: number,
  slug?: string | null,
): Promise<void> {
  const keys = [
    `magazines:editions:${magazineId}`,
    `magazines:one:${magazineId}`,
    'magazines:list:all',
  ];
  if (slug) {
    keys.push(`magazines:editions:${slug}`, `magazines:one:${slug}`);
  }
  await Promise.all(keys.map((k) => deleteCached(k)));
}

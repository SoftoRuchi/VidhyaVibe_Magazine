import type { AxiosInstance, AxiosRequestConfig } from 'axios';

interface CacheEntry<T> {
  expires: number;
  data?: T;
  promise?: Promise<{ data: T }>;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

export function cachedGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
  ttlMs = DEFAULT_TTL_MS,
): Promise<{ data: T }> {
  const key = `${url}:${JSON.stringify(config?.params ?? {})}`;
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expires > now) {
    if (hit.data !== undefined) {
      return Promise.resolve({ data: hit.data as T });
    }
    if (hit.promise) {
      return hit.promise as Promise<{ data: T }>;
    }
  }

  const promise = client.get<T>(url, config).then((response) => {
    cache.set(key, {
      expires: Date.now() + ttlMs,
      data: response.data,
    });
    return response;
  });

  cache.set(key, { expires: now + ttlMs, promise });
  return promise;
}

export function invalidateCachedGet(urlPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}

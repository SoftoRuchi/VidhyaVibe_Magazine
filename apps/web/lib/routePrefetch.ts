import type { AxiosInstance } from 'axios';
import { cachedGet } from './requestCache';

const MAGAZINES_TTL = 120_000;
const STATIC_TTL = 120_000;
const POSTS_TTL = 60_000;

const ROUTE_APIS: Record<string, Array<{ url: string; ttl?: number }>> = {
  '/': [
    { url: '/api/posts', ttl: POSTS_TTL },
    { url: '/api/magazines', ttl: MAGAZINES_TTL },
    { url: '/api/age-groups', ttl: STATIC_TTL },
  ],
  '/magazines': [
    { url: '/api/age-groups', ttl: STATIC_TTL },
    { url: '/api/magazines', ttl: MAGAZINES_TTL },
  ],
  '/sales': [
    { url: '/api/age-groups', ttl: STATIC_TTL },
    { url: '/api/sales', ttl: POSTS_TTL },
    { url: '/api/magazines', ttl: MAGAZINES_TTL },
  ],
  '/posts': [{ url: '/api/posts', ttl: POSTS_TTL }],
  '/dashboard': [{ url: '/api/posts', ttl: POSTS_TTL }],
};

export function prefetchRouteData(client: AxiosInstance, href: string) {
  const path = href.split('?')[0];
  const endpoints = ROUTE_APIS[path];
  if (!endpoints) return;

  endpoints.forEach(({ url, ttl }) => {
    cachedGet(client, url, undefined, ttl).catch(() => {});
  });
}

export function prefetchCommonData(client: AxiosInstance) {
  prefetchRouteData(client, '/magazines');
  prefetchRouteData(client, '/posts');
}

/**
 * API base for browser requests.
 *
 * Split deploy (admin on readeradmin.*, API on readerapi.*): set at **build** time:
 *   NEXT_PUBLIC_API_BASE_URL=https://readerapi.vidhyavibe.in
 *
 * Same-server compose / local dev: omit it and use `/api` (Next.js rewrite proxy).
 */
export function getApiOrigin(): string {
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (publicBase) return publicBase.replace(/\/$/, '');
  return '';
}

export function getApiBaseUrl(): string {
  const origin = getApiOrigin();
  if (origin) return `${origin}/api`;
  return '/api';
}

/** e.g. apiUrl('/auth/login') → https://readerapi.../api/auth/login or /api/auth/login */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Cover / asset images served by the API. */
export function assetUrl(coverKey: string): string {
  return apiUrl(`/assets/serve?key=${encodeURIComponent(coverKey)}`);
}

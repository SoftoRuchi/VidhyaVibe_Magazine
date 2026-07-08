/**
 * Backend API origin for browser requests.
 *
 * Split deploy: set at **build** time:
 *   NEXT_PUBLIC_API_BASE_URL=https://readerapi.vidhyavibe.in
 *
 * Local dev: omit — axios uses same-origin `/api/*` (Next.js rewrite).
 */
export function getApiOrigin(): string {
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (publicBase) return publicBase.replace(/\/$/, '');
  return '';
}

/** Full URL for a backend path (path must start with /api). */
export function apiUrl(path: string): string {
  const origin = getApiOrigin();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
}

/** Cover / asset images served by the API. */
export function assetUrl(coverKey: string): string {
  return apiUrl(`/api/assets/serve?key=${encodeURIComponent(coverKey)}`);
}

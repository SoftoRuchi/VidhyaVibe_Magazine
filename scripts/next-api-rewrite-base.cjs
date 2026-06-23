/**
 * Base URL for Next.js `/api/*` rewrites (evaluated at build time).
 *
 * - Set NEXT_PUBLIC_API_BASE_URL for split deploy (e.g. https://readerapi.vidhyavibe.in)
 * - Set INTERNAL_API_URL for Docker Compose (e.g. http://api:2034)
 * - Local dev default: http://127.0.0.1:2034 (match PORT in root .env)
 */
function getApiRewriteBase() {
  const internal = process.env.INTERNAL_API_URL;
  if (internal) return internal.replace(/\/$/, '');

  const fromPublic = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromPublic) return fromPublic.replace(/\/$/, '');

  return 'http://127.0.0.1:2034';
}

module.exports = { getApiRewriteBase };

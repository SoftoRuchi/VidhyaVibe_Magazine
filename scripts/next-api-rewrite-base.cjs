/**
 * Base URL for Next.js `/api/*` rewrites (evaluated at build time).
 *
 * - Set NEXT_PUBLIC_API_BASE_URL for split deploy (e.g. https://readerapi.vidhyavibe.in)
 * - Set INTERNAL_API_URL for Docker Compose (e.g. http://api:2034)
 * - Local dev default: http://127.0.0.1:4001
 */
function getApiRewriteBase() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.INTERNAL_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    return 'https://readerapi.vidhyavibe.in';
  }
  return 'http://127.0.0.1:4001';
}

module.exports = { getApiRewriteBase };

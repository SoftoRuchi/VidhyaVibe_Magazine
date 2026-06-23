const { getApiRewriteBase } = require('../../scripts/next-api-rewrite-base.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magazine/ui'],
  // Proxy /api/* to the Express API (baked at build time via INTERNAL_API_URL).
  // app/api/[...path]/route.ts is a fallback when present; rewrites fix login when
  // that folder is missing after FTP upload (brackets in [...path] break some clients).
  async rewrites() {
    const apiBase = getApiRewriteBase();
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;

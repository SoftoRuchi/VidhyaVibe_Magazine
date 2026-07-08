const { getApiRewriteBase } = require('../../scripts/next-api-rewrite-base.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magazine/ui'],
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'readerapi.vidhyavibe.in', pathname: '/api/assets/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '2034', pathname: '/api/assets/**' },
    ],
  },
  // Proxy /api/* to the Express API (baked at build time via INTERNAL_API_URL).
  // app/api/[...path]/route.ts is a fallback when present; rewrites fix login when
  // that folder is missing after FTP upload (brackets in [...path] break some clients).
  async rewrites() {
    const apiBase = getApiRewriteBase();
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;

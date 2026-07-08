const { getApiRewriteBase } = require('../../scripts/next-api-rewrite-base.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    remotePatterns: [
      { protocol: 'https', hostname: 'readerapi.vidhyavibe.in', pathname: '/api/assets/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '2034', pathname: '/api/assets/**' },
      { protocol: 'http', hostname: 'localhost', port: '2034', pathname: '/api/assets/**' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  async rewrites() {
    const apiBase = getApiRewriteBase();
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;

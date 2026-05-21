const { getApiRewriteBase } = require('../../scripts/next-api-rewrite-base.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
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

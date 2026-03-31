/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  async rewrites() {
    // In production we run API as a docker service (`api:2034`).
    // For local dev, you can set NEXT_PUBLIC_API_BASE_URL or run API on 4001.
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://api:2034' : 'http://127.0.0.1:4001');

    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;

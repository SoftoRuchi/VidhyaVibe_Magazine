/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magazine/ui'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:4001/api/:path*' }];
  },
};

module.exports = nextConfig;

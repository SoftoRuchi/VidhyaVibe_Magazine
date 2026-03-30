/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magazine/ui'],
  async rewrites() {
    // In Docker, reach the API via the compose service name.
    return [{ source: '/api/:path*', destination: 'http://api:2034/api/:path*' }];
  },
};

module.exports = nextConfig;

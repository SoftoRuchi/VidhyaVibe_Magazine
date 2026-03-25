/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  async rewrites() {
    return [
      // Use 127.0.0.1 (not localhost) so Node resolves IPv4; on Windows, localhost → ::1
      // while the API often listens on 0.0.0.0 only → ECONNREFUSED to ::1:4001.
      { source: '/api/:path*', destination: 'http://127.0.0.1:4001/api/:path*' },
    ];
  },
};

module.exports = nextConfig;

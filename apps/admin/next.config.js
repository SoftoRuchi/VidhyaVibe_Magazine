/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magazine/ui'],
  async rewrites() {
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://api:2034' : 'http://127.0.0.1:4001');

    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;

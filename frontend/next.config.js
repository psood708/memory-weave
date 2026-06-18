/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy all backend API calls through Next.js so the browser makes same-origin
    // requests. This avoids cross-origin SameSite cookie issues on Railway where the
    // frontend and API are on different subdomains.
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [{ source: '/proxy/:path*', destination: `${api}/:path*` }];
  },
};
module.exports = nextConfig;

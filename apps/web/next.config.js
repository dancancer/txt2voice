/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Optimize for production
  swcMinify: true,
  // Configure image optimization
  images: {
    domains: [],
  },
  // Set workspace root for monorepo
  experimental: {
    turbo: {
      root: '../../',
    },
  },
}

module.exports = nextConfig
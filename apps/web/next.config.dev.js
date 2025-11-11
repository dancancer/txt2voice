/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable standalone output in development for hot reload
  // output: 'standalone', // Only use in production
  // Configure image optimization
  images: {
    domains: [],
  },
  // Next.js 16 uses Turbopack by default in dev mode
  // Turbopack has built-in file watching that works in Docker
  // Add empty turbopack config to silence the warning
  turbopack: {},
}

module.exports = nextConfig

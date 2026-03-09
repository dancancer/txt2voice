const path = require('node:path')

const repoRoot = path.join(__dirname, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: [],
  },
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingRoot: repoRoot,
}

module.exports = nextConfig

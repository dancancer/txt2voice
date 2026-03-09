const path = require('node:path')

const repoRoot = path.join(__dirname, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingRoot: repoRoot,
}

module.exports = nextConfig

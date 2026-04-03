const path = require('node:path')

const repoRoot = path.join(__dirname, '../..')
const isDevelopment = process.env.NODE_ENV === 'development'

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
  ...(isDevelopment ? {} : { output: 'standalone' }),
}

module.exports = nextConfig

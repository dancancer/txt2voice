const path = require('node:path')

process.env.BROWSERSLIST_IGNORE_OLD_DATA =
  process.env.BROWSERSLIST_IGNORE_OLD_DATA || 'true'
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA =
  process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA || 'true'

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

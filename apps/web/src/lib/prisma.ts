// If I change, please update my header comment.
// input: function args/external deps
// output: utility/service exports
// pos: shared library
import { PrismaClient } from '@/generated/prisma'

declare global {
  var __prisma: PrismaClient | undefined
}

const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'pretty',
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma

export * from '@/generated/prisma'

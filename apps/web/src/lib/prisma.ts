// If I change, please update my header comment.
// input: function args/external deps
// output: utility/service exports
// pos: shared library
const PrismaGenerated = require('@/generated/prisma') as typeof import('@/generated/prisma')

type PrismaClientInstance = import('@/generated/prisma').PrismaClient

declare global {
  var __prisma: PrismaClientInstance | undefined
}

const prisma =
  globalThis.__prisma ||
  new PrismaGenerated.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'pretty',
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma
export const Decimal = PrismaGenerated.Prisma.Decimal
export type { Prisma, ProcessingTask } from '@/generated/prisma'

// If I change, please update my header comment.
// input: function args/external deps
// output: utility/service exports
// pos: shared library
import * as PrismaGenerated from '@/generated/prisma'

type PrismaClientInstance = InstanceType<typeof PrismaGenerated.PrismaClient>

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

export * from '@/generated/prisma'

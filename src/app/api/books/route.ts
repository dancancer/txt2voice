import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { CreateBookSchema } from '@/lib/validation'
import { parsePaginationParams, createPaginationResponse } from '@/lib/api-utils'
import { withRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

// GET /api/books - 获取书籍列表
export const GET = withRateLimit(withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = parsePaginationParams(searchParams)
  const status = searchParams.get('status')

  const where: any = {}
  if (status) {
    where.status = status
  }

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where,
      include: {
        characterProfiles: {
          where: { isActive: true }
        },
        _count: {
          select: {
            textSegments: true,
            characterProfiles: true,
            audioFiles: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.book.count({ where })
  ])

  logger.info('Books fetched', { count: books.length, page, limit })

  return NextResponse.json({
    success: true,
    ...createPaginationResponse(books, total, page, limit)
  })
}))

// POST /api/books - 创建新书籍
export const POST = withRateLimit(withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  
  // 验证输入
  const validatedData = CreateBookSchema.parse(body)
  const { title, author } = validatedData

  const book = await prisma.book.create({
    data: {
      title,
      author: author || null
    }
  })

  logger.info('Book created', { bookId: book.id, title })

  return NextResponse.json({
    success: true,
    data: book
  }, { status: 201 })
}))
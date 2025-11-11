import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'

// GET /api/books - 获取书籍列表
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const status = searchParams.get('status')

  const where: any = {}
  if (status) {
    where.status = status
  }

  const skip = (page - 1) * limit

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

  return NextResponse.json({
    success: true,
    data: books,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
})

// POST /api/books - 创建新书籍
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { title, author, originalFilename } = body

  if (!title) {
    throw new ValidationError('书籍标题是必需的', 'title')
  }

  const book = await prisma.book.create({
    data: {
      title,
      author: author || null,
      originalFilename: originalFilename || null
    }
  })

  return NextResponse.json({
    success: true,
    data: book
  }, { status: 201 })
})
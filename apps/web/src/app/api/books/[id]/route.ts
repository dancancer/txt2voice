import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { formatProcessingTask } from '@/lib/processing-task-utils'

// GET /api/books/[id] - 获取书籍详情
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characterProfiles: {
        where: { isActive: true },
        include: {
          aliases: true,
          voiceBindings: {
            include: {
              voiceProfile: true
            }
          },
          scriptSentences: true
        }
      },
      textSegments: {
        include: {
          scriptSentences: true,
          audioFiles: true
        },
        orderBy: [
          { orderIndex: 'asc' },
          { segmentIndex: 'asc' },
          { startPosition: 'asc' }
        ]
      },
      scriptSentences: {
        include: {
          character: true,
          segment: {
            select: { id: true, content: true }
          },
          audioFiles: true
        },
        orderBy: [
          { segmentId: 'asc' },
          { orderInSegment: 'asc' }
        ]
      },
      audioFiles: {
        include: {
          scriptSentence: {
            select: { id: true, text: true }
          },
          segment: {
            select: { id: true, content: true }
          },
          voiceProfile: true
        },
        orderBy: { createdAt: 'asc' }
      },
      processingTasks: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const formattedBook = {
    ...book,
    processingTasks: book.processingTasks.map(formatProcessingTask)
  }

  return NextResponse.json({
    success: true,
    data: formattedBook
  })
})

// PUT /api/books/[id] - 更新书籍信息
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const { title, author, status } = body

  const updateData: any = {}
  if (title) updateData.title = title
  if (author !== undefined) updateData.author = author
  if (status) updateData.status = status

  const book = await prisma.book.update({
    where: { id: bookId },
    data: updateData
  })

  return NextResponse.json({
    success: true,
    data: book
  })
})

// DELETE /api/books/[id] - 删除书籍
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  await prisma.book.delete({
    where: { id: bookId }
  })

  return NextResponse.json({
    success: true,
    message: '书籍已删除'
  })
})

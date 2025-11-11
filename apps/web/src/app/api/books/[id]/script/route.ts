import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// 台词更新验证Schema
const scriptUpdateSchema = z.object({
  text: z.string().min(1).optional(),
  emotion: z.string().optional(),
  context: z.string().optional(),
  characterProfileId: z.string().nullable().optional(),
  isNarration: z.boolean().optional()
})

// GET /api/books/[id]/script - 获取台本列表
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const characterId = searchParams.get('characterId')
  const emotion = searchParams.get('emotion')
  const segmentId = searchParams.get('segmentId')
  const isNarration = searchParams.get('isNarration')
  const searchText = searchParams.get('search')

  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const where: any = { bookId: bookId }
  if (characterId) where.characterId = characterId
  if (emotion) where.tone = emotion
  if (segmentId) where.segmentId = segmentId
  if (searchText) {
    where.OR = [
      { text: { contains: searchText, mode: 'insensitive' } }
    ]
  }

  const skip = (page - 1) * limit

  const [scriptSentences, total] = await Promise.all([
    prisma.scriptSentence.findMany({
      where,
      include: {
        character: {
          select: { id: true, canonicalName: true, genderHint: true }
        },
        segment: {
          select: { id: true, content: true, orderIndex: true }
        },
        audioFiles: {
          select: { id: true, voiceProfileId: true, duration: true, status: true }
        }
      },
      orderBy: [
        { segment: { orderIndex: 'asc' } },
        { orderInSegment: 'asc' }
      ],
      skip,
      take: limit
    }),
    prisma.scriptSentence.count({ where })
  ])

  // 获取统计信息
  const statistics = await prisma.scriptSentence.groupBy({
    by: ['tone'],
    where: { bookId: bookId },
    _count: true
  })

  const characterStats = await prisma.scriptSentence.groupBy({
    by: ['characterId'],
    where: {
      bookId: bookId,
      characterId: { not: null }
    },
    _count: true
  })

  return NextResponse.json({
    success: true,
    data: {
      bookId: bookId,
      scriptSentences: scriptSentences.map(sentence => ({
        id: sentence.id,
        characterName: sentence.character?.canonicalName || '旁白',
        character: sentence.character,
        text: sentence.text,
        emotion: sentence.tone,
        orderInSegment: sentence.orderInSegment,
        hasAudio: sentence.audioFiles?.length > 0,
        audioStatus: sentence.audioFiles?.length > 0 ? sentence.audioFiles[0].status : null,
        createdAt: sentence.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      statistics: {
        totalLines: total,
        emotionDistribution: statistics.reduce((acc, stat) => {
          acc[stat.tone || 'unknown'] = Number(stat._count)
          return acc
        }, {} as Record<string, number>),
        characterDistribution: characterStats.reduce((acc, stat) => {
          acc[stat.characterId || 'unknown'] = Number(stat._count)
          return acc
        }, {} as Record<string, number>)
      }
    }
  })
})

// PUT /api/books/[id]/script - 批量更新台词
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const body = await request.json()
  const { scriptSentences } = body

  if (!Array.isArray(scriptSentences) || scriptSentences.length === 0) {
    throw new ValidationError('台词列表不能为空')
  }

  const { id: bookId } = await params
  // 验证书籍是否存在
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const results = []

  for (const sentenceData of scriptSentences) {
    try {
      const validatedData = scriptUpdateSchema.parse(sentenceData)

      const updatedSentence = await prisma.scriptSentence.update({
        where: {
          id: sentenceData.id,
          bookId: bookId
        },
        data: {
          text: validatedData.text,
          tone: validatedData.emotion,
          characterId: validatedData.characterProfileId
        }
      })

      results.push({
        id: updatedSentence.id,
        success: true
      })
    } catch (error) {
      results.push({
        id: sentenceData.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  })
})

// POST /api/books/[id]/script/reorder - 重新排序台词
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await request.json()
  const { segmentId, newOrders } = body

  if (!segmentId || !Array.isArray(newOrders)) {
    throw new ValidationError('请提供段落ID和新的排序')
  }

  const { id: bookId } = await params
  // 验证书籍是否存在
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  // 批量更新排序
  await prisma.$transaction(async (tx) => {
    for (const { sentenceId, orderInSegment } of newOrders) {
      await tx.scriptSentence.update({
        where: {
          id: sentenceId,
          bookId: bookId,
          segmentId
        },
        data: {
          orderInSegment
        }
      })
    }
  })

  return NextResponse.json({
    success: true,
    message: '台词排序已更新'
  })
}

// DELETE /api/books/[id]/script - 批量删除台词
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const sentenceIds = searchParams.get('ids')
  const segmentId = searchParams.get('segmentId')

  const { id: bookId } = await params
  let whereClause: any = { bookId: bookId }

  if (sentenceIds) {
    const ids = sentenceIds.split(',').filter(id => id.trim())
    if (ids.length === 0) {
      throw new ValidationError('台词ID列表不能为空')
    }
    whereClause.id = { in: ids }
  } else if (segmentId) {
    whereClause.segmentId = segmentId
  } else {
    throw new ValidationError('请提供要删除的台词ID或段落ID')
  }

  // 检查是否有关联的音频文件
  const sentencesWithAudio = await prisma.scriptSentence.findMany({
    where: whereClause,
    include: {
      audioFiles: true
    }
  })

  const sentencesWithAudioCount = sentencesWithAudio.filter(s => s.audioFiles.length > 0).length
  if (sentencesWithAudioCount > 0) {
    throw new ValidationError(`有 ${sentencesWithAudioCount} 条台词已生成音频，无法删除`)
  }

  const result = await prisma.scriptSentence.deleteMany({
    where: whereClause
  })

  return NextResponse.json({
    success: true,
    data: {
      deleted: result.count,
      message: `已删除 ${result.count} 条台词`
    }
  })
})

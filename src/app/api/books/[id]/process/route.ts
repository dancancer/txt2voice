import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError, FileProcessingError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { processFileContent, segmentText, createTextSegmentRecords, TextProcessingOptions } from '@/lib/text-processor'
import { readFile, unlink } from 'fs/promises'

// POST /api/books/[id]/process - 处理文件内容
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const { options = {} }: { options?: TextProcessingOptions } = body

  // 验证书籍是否存在且已上传文件
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  if (!book.uploadedFilePath) {
    throw new ValidationError('请先上传文件', 'file')
  }

  if (book.status === 'processing') {
    throw new ValidationError('文件正在处理中，请稍后')
  }

  if (book.status === 'processed') {
    throw new ValidationError('文件已经处理过了')
  }

  try {
    // 更新状态为处理中
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'processing' }
    })

    // 读取文件内容
    const fileBuffer = await readFile(book.uploadedFilePath!)

    // 处理文件内容
    const processedText = processFileContent(
      fileBuffer,
      book.originalFilename || '',
      {
        maxSegmentLength: options.maxSegmentLength || 1000,
        minSegmentLength: options.minSegmentLength || 50,
        preserveFormatting: options.preserveFormatting !== false
      }
    )

    // 智能分割文本
    const segments = segmentText(processedText.content, options)

    if (segments.length === 0) {
      throw new FileProcessingError(
        '文本分割失败',
        'CORRUPTED_FILE',
        { message: '无法将文本分割为有效段落' }
      )
    }

    // 创建数据库记录
    const segmentRecords = createTextSegmentRecords(bookId, segments)

    // 使用事务保存数据
    await prisma.$transaction(async (tx) => {
      // 保存文本段落
      await tx.textSegment.createMany({
        data: segmentRecords
      })

      // 更新书籍信息
      await tx.book.update({
        where: { id: bookId },
        data: {
          status: 'processed',
          totalWords: processedText.wordCount,
          totalCharacters: processedText.characterCount,
          encoding: processedText.encoding,
          fileFormat: processedText.detectedFormat
        }
      })
    })

    // 获取处理结果
    const processedBook = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          select: {
            id: true,
            content: true,
            wordCount: true,
            segmentType: true,
            orderIndex: true,
            metadata: true
          },
          orderBy: { orderIndex: 'asc' }
        },
        _count: {
          select: {
            textSegments: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        book: {
          id: processedBook!.id,
          title: processedBook!.title,
          status: processedBook!.status,
          totalWords: processedBook!.totalWords,
          totalCharacters: processedBook!.totalCharacters,
          encoding: processedBook!.encoding,
          fileFormat: processedBook!.fileFormat
        },
        segments: processedBook!.textSegments,
        statistics: {
          totalSegments: processedBook!._count.textSegments,
          avgWordsPerSegment: Math.round(
            processedText.wordCount / segments.length
          ),
          segmentTypes: segments.reduce((acc, seg) => {
            acc[seg.type] = (acc[seg.type] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      }
    })

  } catch (error) {
    // 处理失败，重置状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'uploaded' }
    })
    throw error
  }
})

// GET /api/books/[id]/process - 获取处理状态
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      textSegments: {
        select: {
          id: true,
          wordCount: true,
          segmentType: true,
          orderIndex: true
        },
        orderBy: { orderIndex: 'asc' }
      },
      _count: {
        select: {
          textSegments: true,
          scriptSentences: true,
          audioFiles: true
        }
      }
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const statistics = {
    totalSegments: book._count.textSegments,
    totalSentences: book._count.scriptSentences,
    totalAudioFiles: book._count.audioFiles,
    totalWords: book.totalWords,
    totalCharacters: book.totalCharacters,
    segmentTypes: book.textSegments.reduce((acc, seg) => {
      const key = seg.segmentType || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return NextResponse.json({
    success: true,
    data: {
      status: book.status,
      statistics,
      hasSegments: book.textSegments.length > 0,
      processingOptions: {
        encoding: book.encoding,
        fileFormat: book.fileFormat
      }
    }
  })
})

// DELETE /api/books/[id]/process - 重新处理文件
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  if (!book.uploadedFilePath) {
    throw new ValidationError('请先上传文件')
  }

  // 删除相关的处理数据
  await prisma.$transaction(async (tx) => {
    // 删除音频文件记录
    await tx.audioFile.deleteMany({
      where: { bookId: bookId }
    })

    // 删除脚本句子记录
    await tx.scriptSentence.deleteMany({
      where: { bookId: bookId }
    })

    // 删除文本段落记录
    await tx.textSegment.deleteMany({
      where: { bookId: bookId }
    })

    // 删除角色配置记录
    await tx.characterProfile.deleteMany({
      where: { bookId: bookId }
    })

    // 删除处理任务记录
    await tx.processingTask.deleteMany({
      where: { bookId: bookId }
    })

    // 重置书籍状态
    await tx.book.update({
      where: { id: bookId },
      data: {
        status: 'uploaded',
        totalWords: null,
        totalCharacters: 0,
        encoding: null,
        fileFormat: null
      }
    })
  })

  return NextResponse.json({
    success: true,
    message: '文件处理数据已清除，可以重新处理'
  })
})

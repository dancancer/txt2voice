// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { getAudioMerger, AudioMergeOptions } from '@/lib/audio-merger'
import { resolveExistingAudioFilePath } from '@/lib/storage-path'

// POST /api/books/[id]/audio/merge - 合并音频
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const {
    type,
    chapterId,
    segmentId,
    options = {}
  }: {
    type: 'chapter' | 'book' | 'segment'
    chapterId?: string
    segmentId?: string
    options?: AudioMergeOptions
  } = body

  // 验证书籍存在
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      _count: {
        select: {
          audioFiles: true
        }
      }
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  if (book._count.audioFiles === 0) {
    throw new ValidationError('该书籍没有音频文件，请先生成音频')
  }

  try {
    const audioMerger = getAudioMerger()
    let result

    switch (type) {
      case 'chapter':
        if (!chapterId) {
          throw new ValidationError('章节ID不能为空')
        }
        result = await audioMerger.mergeChapterAudio(bookId, chapterId, options)
        break

      case 'book':
        result = await audioMerger.mergeBookAudio(bookId, options)
        break

      case 'segment':
        if (!segmentId) {
          throw new ValidationError('段落ID不能为空')
        }
        result = await audioMerger.mergeSegmentAudio(segmentId, options)
        break

      default:
        throw new ValidationError('无效的合并类型')
    }

    if (!result.success) {
      throw new Error(result.error || '音频合并失败')
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '音频合并成功',
        outputPath: result.outputPath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        duration: result.duration,
        metadata: result.metadata
      }
    })

  } catch (error) {
    console.error('音频合并失败:', error)
    throw error
  }
})

// GET /api/books/[id]/audio/merge - 获取合并的音频列表
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as 'chapter' | 'book' | 'all' | null
  const chapterId = searchParams.get('chapterId')

  const { id: bookId } = await params

  // 构建查询条件
  const where: any = {
    bookId,
    provider: 'merged',
    status: 'completed'
  }

  if (type === 'chapter' && chapterId) {
    where.chapterId = chapterId
  } else if (type === 'book') {
    where.chapterId = null
    where.segmentId = null
    where.sentenceId = null
  }

  // 查询合并的音频文件
  const mergedAudioFiles = await prisma.audioFile.findMany({
    where,
    include: {
      chapter: {
        select: {
          id: true,
          title: true,
          chapterIndex: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      audioFiles: mergedAudioFiles.map(af => ({
        id: af.id,
        fileName: af.fileName,
        filePath: af.filePath,
        fileSize: Number(af.fileSize),
        duration: af.duration ? Number(af.duration) : null,
        format: af.format,
        createdAt: af.createdAt,
        chapter: af.chapter ? {
          id: af.chapter.id,
          title: af.chapter.title,
          index: af.chapter.chapterIndex
        } : null
      })),
      count: mergedAudioFiles.length
    }
  })
})

// DELETE /api/books/[id]/audio/merge - 删除合并的音频文件
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const audioFileId = searchParams.get('audioFileId')
  const type = searchParams.get('type') as 'chapter' | 'book' | 'all' | null

  const { id: bookId } = await params

  if (!audioFileId && !type) {
    throw new ValidationError('请提供 audioFileId 或 type 参数')
  }

  try {
    if (audioFileId) {
      // 删除单个音频文件
      const audioFile = await prisma.audioFile.findUnique({
        where: { id: audioFileId }
      })

      if (!audioFile) {
        throw new ValidationError('音频文件不存在')
      }

      if (audioFile.bookId !== bookId) {
        throw new ValidationError('音频文件不属于该书籍')
      }

      // 删除物理文件
      try {
        const fs = await import('fs')
        const resolvedPath = resolveExistingAudioFilePath({
          filePath: audioFile.filePath,
          fileName: audioFile.fileName,
          bookId: audioFile.bookId,
          provider: audioFile.provider
        })

        if (resolvedPath && fs.existsSync(resolvedPath)) {
          await import('fs/promises').then(fsp => fsp.unlink(resolvedPath))
        }
      } catch (error) {
        console.warn('删除物理文件失败:', error)
      }

      // 删除数据库记录
      await prisma.audioFile.delete({
        where: { id: audioFileId }
      })

      return NextResponse.json({
        success: true,
        message: '音频文件已删除'
      })

    } else {
      // 批量删除
      const where: any = {
        bookId,
        provider: 'merged'
      }

      if (type === 'chapter') {
        where.chapterId = { not: null }
      } else if (type === 'book') {
        where.chapterId = null
        where.segmentId = null
        where.sentenceId = null
      }

      const audioFiles = await prisma.audioFile.findMany({ where })

      // 删除物理文件
      for (const af of audioFiles) {
        try {
          const fs = await import('fs')
          const resolvedPath = resolveExistingAudioFilePath({
            filePath: af.filePath,
            fileName: af.fileName,
            bookId: af.bookId,
            provider: af.provider
          })

          if (resolvedPath && fs.existsSync(resolvedPath)) {
            await import('fs/promises').then(fsp => fsp.unlink(resolvedPath))
          }
        } catch (error) {
          console.warn(`删除物理文件失败 ${af.filePath}:`, error)
        }
      }

      // 删除数据库记录
      const result = await prisma.audioFile.deleteMany({ where })

      return NextResponse.json({
        success: true,
        message: `已删除 ${result.count} 个音频文件`
      })
    }

  } catch (error) {
    console.error('删除音频文件失败:', error)
    throw error
  }
})

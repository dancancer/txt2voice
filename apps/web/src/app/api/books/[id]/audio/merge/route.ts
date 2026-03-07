// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { AudioMergeOptions } from '@/lib/audio-merger'
import { resolveExistingAudioFilePath } from '@/lib/storage-path'
import { enqueueAutoPipelineJobInternal } from '@/lib/task-queue/ops/auto-pipeline-enqueue'
import { mergeTaskData } from '@/lib/processing-task-utils'
import { ensureTaskWorkerStarted } from '@/lib/task-queue'

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? {}))

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

  if (type === 'chapter' && !chapterId) {
    throw new ValidationError('章节ID不能为空')
  }
  if (type === 'segment' && !segmentId) {
    throw new ValidationError('段落ID不能为空')
  }

  const existingTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'FINAL_ASSEMBLY',
      status: 'processing'
    },
    select: { id: true }
  })

  if (existingTask) {
    throw new ValidationError('最终合并任务正在执行中，请稍后')
  }

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: 'FINAL_ASSEMBLY',
      status: 'processing',
      progress: 0,
      totalItems: 1,
      taskData: toJson({
        message: '最终合并任务已创建',
        metadata: {
          source: 'final_assembly',
          type,
          chapterId: chapterId || null,
          segmentId: segmentId || null,
          options,
          previousBookStatus: book.status,
        }
      })
    }
  })

  try {
    await ensureTaskWorkerStarted()
    await enqueueAutoPipelineJobInternal(
      {
        taskId: task.id,
        bookId,
        mode: 'final_assembly',
        workflowPayload: {
          source: 'final_assembly',
          type,
          chapterId: chapterId || null,
          segmentId: segmentId || null,
          options,
          previousBookStatus: book.status,
        }
      },
      {
        allowReuse: false,
        reason: 'audio_merge_api'
      }
    )
  } catch (queueError) {
    const message = queueError instanceof Error ? queueError.message : '最终合并任务入队失败'
    const failedTaskData = await mergeTaskData(task.id, {
      message: '最终合并任务入队失败',
      metadata: {
        queueError: message
      }
    })

    await prisma.processingTask.update({
      where: { id: task.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData
      }
    })

    throw queueError
  }

  return NextResponse.json({
    success: true,
    data: {
      taskId: task.id,
      taskType: 'FINAL_ASSEMBLY',
      type,
      message: '最终合并任务已启动'
    }
  })
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
      const audioFile = await prisma.audioFile.findUnique({
        where: { id: audioFileId }
      })

      if (!audioFile) {
        throw new ValidationError('音频文件不存在')
      }

      if (audioFile.bookId !== bookId) {
        throw new ValidationError('音频文件不属于该书籍')
      }

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

      await prisma.audioFile.delete({
        where: { id: audioFileId }
      })

      return NextResponse.json({
        success: true,
        message: '音频文件已删除'
      })

    } else {
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
      for (const audioFile of audioFiles) {
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
      }

      const result = await prisma.audioFile.deleteMany({ where })
      return NextResponse.json({
        success: true,
        data: {
          deletedCount: result.count
        }
      })
    }
  } catch (error) {
    console.error('删除合并音频失败:', error)
    throw error
  }
})

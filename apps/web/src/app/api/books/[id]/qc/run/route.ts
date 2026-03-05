// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma, { Prisma } from '@/lib/prisma'
import { mergeTaskData, formatProcessingTask } from '@/lib/processing-task-utils'
import { enqueueQualityCheckJob } from '@/lib/task-queue'
import type { QualityCheckTaskType } from '@/lib/quality-check-runner'

const isValidQualityType = (value: unknown): value is QualityCheckTaskType => {
  return value === 'book' || value === 'chapter' || value === 'batch'
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
}

const buildAudioFilter = (
  bookId: string,
  type: QualityCheckTaskType,
  chapterId?: string,
  audioFileIds?: string[]
) => {
  if (type === 'batch' && (!audioFileIds || audioFileIds.length === 0)) {
    throw new ValidationError('批量质检必须提供 audioFileIds')
  }

  return {
    bookId,
    status: 'completed',
    ...(type === 'chapter' && chapterId ? { chapterId } : {}),
    ...(type === 'batch' && audioFileIds ? { id: { in: audioFileIds } } : {})
  }
}

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json().catch(() => ({}))

  const type = isValidQualityType(body.type) ? body.type : 'book'
  const chapterId = typeof body.chapterId === 'string' ? body.chapterId : undefined
  const audioFileIds = Array.isArray(body.audioFileIds)
    ? body.audioFileIds.filter((item: unknown): item is string => typeof item === 'string')
    : undefined
  const deepGateThresholdTemplate = asRecord(
    body.deepGateThresholdTemplate || body.thresholdTemplate
  )

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      status: true
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const existingTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'QUALITY_CHECK',
      status: 'processing'
    },
    select: { id: true }
  })

  if (existingTask) {
    throw new ValidationError('质量检查任务正在执行中，请稍后')
  }

  const audioFilter = buildAudioFilter(bookId, type, chapterId, audioFileIds)
  const totalItems = await prisma.audioFile.count({ where: audioFilter })

  if (totalItems === 0) {
    throw new ValidationError('没有可质检的已完成音频')
  }

  const taskMetadata: Record<string, Prisma.InputJsonValue> = {
    type,
    chapterId: chapterId || null,
    audioFileIds: audioFileIds || [],
    totalItems
  }
  if (deepGateThresholdTemplate) {
    taskMetadata.deepGateThresholdTemplate = toInputJsonValue(deepGateThresholdTemplate)
  }

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: 'QUALITY_CHECK',
      status: 'processing',
      progress: 0,
      totalItems,
      taskData: toInputJsonValue({
        message: 'Fast/Deep Gate 质检任务已创建',
        metadata: taskMetadata
      })
    }
  })

  try {
    await enqueueQualityCheckJob({
      taskId: task.id,
      bookId,
      type,
      chapterId,
      audioFileIds
    })
  } catch (queueError) {
    const message = queueError instanceof Error ? queueError.message : '质检任务入队失败'
    const failedTaskData = await mergeTaskData(task.id, {
      message: '质检任务入队失败',
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
      message: '质量检查任务已启动',
      type,
      totalItems
    }
  })
})

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  const [book, latestTask, pendingReviewCount] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        status: true,
        metadata: true,
        _count: {
          select: {
            qualityCheckResults: true
          }
        }
      }
    }),
    prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: 'QUALITY_CHECK'
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.manualReviewItem.count({
      where: {
        bookId,
        status: 'pending'
      }
    })
  ])

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  return NextResponse.json({
    success: true,
    data: {
      bookStatus: book.status,
      qualityCheckCount: book._count.qualityCheckResults,
      pendingReviewCount,
      latestTask: latestTask ? formatProcessingTask(latestTask) : null
    }
  })
})

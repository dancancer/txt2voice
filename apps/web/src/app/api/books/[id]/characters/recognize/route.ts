import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { characterRecognitionClient, CharacterRecognitionError } from '@/lib/character-recognition-client'
import { logger } from '@/lib/logger'
import { markCharacterRecognitionFailed, runCharacterRecognitionJob } from '@/lib/character-recognition-workflow'

/**
 * POST /api/books/[id]/characters/recognize
 * 使用 LLM 执行角色识别
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  // 验证书籍是否存在且已处理
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      textSegments: {
        select: { content: true },
        orderBy: { orderIndex: 'asc' }
      }
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const allowedStatuses = new Set(['processed', 'analyzed', 'script_generated', 'completed'])
  if (!allowedStatuses.has(book.status)) {
    throw new ValidationError('请先处理文件内容')
  }

  if (book.textSegments.length === 0) {
    throw new ValidationError('没有可分析的文本段落')
  }

  // 检查角色识别LLM是否可用
  const isHealthy = await characterRecognitionClient.healthCheck()
  if (!isHealthy) {
    throw new ValidationError('角色识别LLM未就绪，请检查API配置')
  }

  // 检查是否已经在识别中
  const existingTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'CHARACTER_RECOGNITION',
      status: 'processing'
    }
  })

  if (existingTask) {
    throw new ValidationError('角色识别正在进行中，请稍后')
  }

  try {
    // 创建处理任务
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: 'CHARACTER_RECOGNITION',
        status: 'processing',
        progress: 0,
        taskData: {
          message: '开始识别角色'
        }
      }
    })

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'analyzing' }
    })

    // 异步执行识别任务
    runCharacterRecognition(bookId, task.id).catch(error => {
      logger.error('角色识别任务失败', error)
    })

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        message: '角色识别任务已启动'
      }
    })

  } catch (error) {
    throw error
  }
})

/**
 * GET /api/books/[id]/characters/recognize
 * 获取识别状态
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params

  const task = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'CHARACTER_RECOGNITION'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!task) {
    return NextResponse.json({
      success: true,
      data: {
        status: 'not_started',
        progress: 0
      }
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      message: (task.taskData as any)?.message,
      error: task.errorMessage,
      createdAt: task.createdAt,
      completedAt: task.completedAt
    }
  })
})

/**
 * 执行角色识别任务
 */
async function runCharacterRecognition(bookId: string, taskId: string): Promise<void> {
  try {
    await runCharacterRecognitionJob(bookId, taskId)
  } catch (error) {
    logger.error('角色识别任务失败', error)
    const errorMessage = formatRecognitionError(error)
    await markCharacterRecognitionFailed(bookId, taskId, errorMessage)
    throw error
  }
}

function formatRecognitionError(error: unknown): string {
  if (error instanceof CharacterRecognitionError) {
    return `${error.message} (${error.code})`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}

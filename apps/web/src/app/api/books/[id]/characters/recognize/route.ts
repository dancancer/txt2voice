import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { characterRecognitionClient, CharacterRecognitionError } from '@/lib/character-recognition-client'
import { mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from '@/lib/processing-task-utils'
import { logger } from '@/lib/logger'
import { finalizeCharacterRecognition } from '@/lib/character-recognition-workflow'

/**
 * POST /api/books/[id]/characters/recognize
 * 使用character-recognition服务识别角色
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

  // 检查character-recognition服务是否可用
  const isHealthy = await characterRecognitionClient.healthCheck()
  if (!isHealthy) {
    throw new ValidationError('角色识别服务暂时不可用，请稍后重试')
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
    await updateTaskProgress(taskId, 5, '准备文本数据')

    // 获取所有文本段落
    const segments = await prisma.textSegment.findMany({
      where: { bookId },
      select: { content: true },
      orderBy: { orderIndex: 'asc' }
    })

    if (segments.length === 0) {
      throw new Error('没有找到可识别的文本内容')
    }

    // 合并文本
    const fullText = segments.map(s => s.content).join('\n\n')
    logger.info('准备识别角色', {
      bookId,
      textLength: fullText.length,
      segmentCount: segments.length
    })

    await updateTaskProgress(taskId, 20, '提交异步识别任务')

    // 构建回调URL
    const callbackBaseUrl = process.env.CHARACTER_RECOGNITION_CALLBACK_BASE_URL
      || process.env.APP_URL
      || process.env.NEXT_PUBLIC_APP_URL
      || 'http://localhost:3000'
    const callbackUrl = `${callbackBaseUrl}/api/books/${bookId}/characters/recognize/callback`

    // 调用character-recognition服务（异步模式）
    const taskResult = await characterRecognitionClient.recognizeAsync({
      text: fullText,
      book_id: bookId,
      options: {
        enable_coreference: true,
        enable_dialogue: true,
        enable_relations: true,
        similarity_threshold: 0.8
      }
    }, callbackUrl)

    // 保存外部任务ID
    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        externalTaskId: taskResult.task_id,
        taskData: {
          message: '已提交到识别服务，等待处理',
          externalTaskId: taskResult.task_id
        }
      }
    })

    await updateTaskProgress(taskId, 30, '任务已提交，等待识别服务处理')

    // 启动轮询机制，定期检查任务状态
    pollTaskStatus(bookId, taskId, taskResult.task_id).catch(error => {
      logger.error('轮询任务状态失败', error)
    })

    // 注意：实际的识别工作由 character-recognition 服务异步处理
    // 这里只是提交任务，等待回调或轮询结果

  } catch (error) {
    logger.error('提交角色识别任务失败', error)

    // 标记任务失败
    const errorMessage = error instanceof CharacterRecognitionError
      ? `${error.message} (${error.code})`
      : error instanceof Error
        ? error.message
        : 'Unknown error'

    const taskData = await mergeTaskData(taskId, {
      message: '提交识别任务失败',
      error: errorMessage
    })

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        errorMessage,
        taskData
      }
    })

    // 重置书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'processed' }
    })

    throw error
  }
}

/**
 * 轮询外部任务状态
 */
async function pollTaskStatus(bookId: string, taskId: string, externalTaskId: string): Promise<void> {
  const maxAttempts = 120 // 最多轮询 120 次（10 分钟）
  const pollInterval = 5000 // 5秒轮询一次
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++

      // 检查本地任务状态
      const localTask = await prisma.processingTask.findUnique({
        where: { id: taskId }
      })

      // 如果本地任务已经完成或失败，停止轮询
      if (localTask && (localTask.status === 'completed' || localTask.status === 'failed')) {
        logger.info(`任务 ${taskId} 已经完成，停止轮询`)
        return
      }

      // 查询外部任务状态
      const externalTask = await characterRecognitionClient.getTaskStatus(externalTaskId)

      const localProgress = localTask?.progress ?? 0
      const externalProgress = typeof externalTask.progress === 'number'
        ? externalTask.progress
        : undefined
      const hasSentenceCounters = typeof externalTask.processed_sentences === 'number'
        && typeof externalTask.total_sentences === 'number'
        && externalTask.total_sentences > 0
      const sentenceProgress = hasSentenceCounters
        ? 10 + Math.floor((externalTask.processed_sentences / externalTask.total_sentences) * 50)
        : undefined

      const nextProgress = Math.max(localProgress, externalProgress ?? 0, sentenceProgress ?? 0)
      const progressMessage = externalTask.message
        || (hasSentenceCounters
          ? `逐句识别中 (${externalTask.processed_sentences}/${externalTask.total_sentences})`
          : '识别中')

      if (nextProgress > localProgress) {
        await updateTaskProgress(taskId, Math.min(nextProgress, 99), progressMessage)
      }

      if (
        externalTask.result
        || typeof externalTask.processed_sentences === 'number'
        || typeof externalTask.total_sentences === 'number'
      ) {
        const taskData = await mergeTaskData(taskId, {
          metadata: {
            processedSentences: externalTask.processed_sentences ?? null,
            totalSentences: externalTask.total_sentences ?? null
          }
        })

        await prisma.processingTask.update({
          where: { id: taskId },
          data: { taskData }
        })
      }

      // 检查是否完成
      if (externalTask.status === 'completed' && externalTask.result) {
        logger.info(`外部任务 ${externalTaskId} 完成，处理结果`)
        await finalizeCharacterRecognition(bookId, taskId, externalTask.result)
        return
      }

      // 检查是否失败
      if (externalTask.status === 'failed') {
        logger.error(`外部任务 ${externalTaskId} 失败: ${externalTask.error}`)

        const errorMessage = externalTask.error || '识别任务失败'

        await prisma.processingTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            errorMessage,
            taskData: {
              message: '识别失败',
              error: errorMessage
            }
          }
        })

        await prisma.book.update({
          where: { id: bookId },
          data: { status: 'processed' }
        })

        return
      }

    } catch (error) {
      logger.error(`轮询任务状态失败 (attempt ${attempts}/${maxAttempts})`, error)
      
      // 如果是最后一次尝试，标记任务失败
      if (attempts >= maxAttempts) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await prisma.processingTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            errorMessage: `轮询超时: ${errorMessage}`,
            taskData: {
              message: '识别任务超时',
              error: errorMessage
            }
          }
        })
        
        await prisma.book.update({
          where: { id: bookId },
          data: { status: 'processed' }
        })
        
        throw error
      }
    }
  }

  // 超时
  logger.error(`轮询任务 ${taskId} 超时`)
  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      errorMessage: '识别任务超时',
      taskData: {
        message: '识别任务超时，请重试'
      }
    }
  })
  
  await prisma.book.update({
    where: { id: bookId },
    data: { status: 'processed' }
  })
}

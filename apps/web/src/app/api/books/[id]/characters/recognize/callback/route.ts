import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { finalizeCharacterRecognition } from '@/lib/character-recognition-workflow'
import { mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from '@/lib/processing-task-utils'

/**
 * POST /api/books/[id]/characters/recognize/callback
 * character-recognition 服务完成后的回调接口
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()

  const { task_id: externalTaskId, status, result, error, meta = {} } = body

  logger.info('收到识别回调', {
    bookId,
    externalTaskId,
    status,
    hasResult: !!result
  })

  // 查找对应的本地任务
  const task = await prisma.processingTask.findFirst({
    where: {
      bookId,
      externalTaskId,
      taskType: 'CHARACTER_RECOGNITION'
    }
  })

  if (!task) {
    logger.warn('未找到对应的本地任务', { bookId, externalTaskId })
    return NextResponse.json({
      success: false,
      message: '任务不存在'
    }, { status: 404 })
  }

  // 如果任务已经完成，直接返回
  if (task.status === 'completed' || task.status === 'failed') {
    logger.info('任务已经处理过', { taskId: task.id, status: task.status })
    return NextResponse.json({
      success: true,
      message: '任务已处理'
    })
  }

  try {
    const callbackProgress = typeof meta.progress === 'number' ? meta.progress : undefined
    const callbackMessage = typeof meta.message === 'string' ? meta.message : undefined

    if (callbackProgress !== undefined) {
      await updateTaskProgress(task.id, Math.min(callbackProgress, 99), callbackMessage || '识别中')
    }

    if (typeof meta.processed_sentences === 'number' || typeof meta.total_sentences === 'number' || typeof meta.processedSentences === 'number' || typeof meta.totalSentences === 'number') {
      const taskData = await mergeTaskData(task.id, {
        metadata: {
          processedSentences: meta.processed_sentences ?? meta.processedSentences ?? null,
          totalSentences: meta.total_sentences ?? meta.totalSentences ?? null
        }
      })

      await prisma.processingTask.update({
        where: { id: task.id },
        data: { taskData }
      })
    }

    if (status === 'completed' && result) {
      // 处理成功结果
      await finalizeCharacterRecognition(bookId, task.id, result)
      
      return NextResponse.json({
        success: true,
        message: '识别完成'
      })
    } else if (status === 'failed') {
      // 处理失败
      await prisma.processingTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: error || '识别失败',
          taskData: {
            message: '识别失败',
            error
          }
        }
      })

      await prisma.book.update({
        where: { id: bookId },
        data: { status: 'processed' }
      })

      logger.error('识别任务失败', { bookId, taskId: task.id, error })

      return NextResponse.json({
        success: true,
        message: '已记录失败状态'
      })
    }

    return NextResponse.json({
      success: false,
      message: '无效的回调状态'
    }, { status: 400 })

  } catch (error) {
    logger.error('处理回调失败', error)
    throw error
  }
})

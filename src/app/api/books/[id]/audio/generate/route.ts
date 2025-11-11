import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { getAudioGenerator, AudioGenerationRequest, AudioGenerationOptions } from '@/lib/audio-generator'
import {
  formatProcessingTask,
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress
} from '@/lib/processing-task-utils'

// POST /api/books/[id]/audio/generate - 生成音频
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const {
    type,
    scriptSentenceIds,
    voiceProfileId,
    options = {}
  }: {
    type: 'single' | 'batch' | 'book'
    scriptSentenceIds?: string[]
    voiceProfileId?: string
    options?: AudioGenerationOptions
  } = body

  // 验证书籍状态
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characterProfiles: {
        where: { isActive: true },
        include: {
          voiceBindings: true,
        },
      },
      _count: {
        select: {
          scriptSentences: true,
        },
      },
    },
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  if (book.status !== 'script_generated') {
    throw new ValidationError('请先完成台本生成')
  }

  if (book._count.scriptSentences === 0) {
    throw new ValidationError('没有可生成音频的台词')
  }

  // 检查是否有角色配置了声音绑定
  const charactersWithVoice = book.characterProfiles.filter(cp => cp.voiceBindings.length > 0)
  if (charactersWithVoice.length === 0) {
    throw new ValidationError('没有角色配置声音绑定')
  }

  // 检查是否已经在生成中
  const existingTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'AUDIO_GENERATION',
      status: 'processing'
    }
  })

  if (existingTask) {
    throw new ValidationError('音频生成正在进行中，请稍后')
  }

  try {
    // 创建处理任务
    const totalSentences =
      type === 'book' ? book._count.scriptSentences : scriptSentenceIds?.length || 1

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: 'AUDIO_GENERATION',
        status: 'processing',
        progress: 0,
        taskData: {
          message: '开始生成音频',
          metadata: {
            type,
            totalSentences,
            voiceProfileId
          }
        }
      }
    })

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'generating_audio' }
    })

    // 异步执行音频生成任务
    runAudioGeneration(bookId, task.id, type, scriptSentenceIds, voiceProfileId, options)
      .catch(error => {
        console.error('音频生成任务失败:', error)
      })

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        message: '音频生成任务已启动',
        bookStatus: 'generating_audio',
        type,
        totalSentences
      }
    })

  } catch (error) {
    throw error
  }
})

// GET /api/books/[id]/audio/generate - 获取生成状态
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const includeProgress = searchParams.get('includeProgress') === 'true'

  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      processingTasks: {
        where: { taskType: 'AUDIO_GENERATION' },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
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

  const latestTask = book.processingTasks[0]
  const formattedTask = latestTask ? formatProcessingTask(latestTask) : null

  const response: any = {
    success: true,
    data: {
      bookStatus: book.status,
      hasAudio: book._count.audioFiles > 0,
      audioCount: book._count.audioFiles,
      generationStatus: formattedTask?.status || 'not_started',
      lastGenerated: formattedTask?.completedAt,
      generationProgress: formattedTask?.progress || 0,
      latestMessage: formattedTask?.message || null
    }
  }

  if (includeProgress && formattedTask) {
    response.data.taskDetails = {
      id: formattedTask.id,
      status: formattedTask.status,
      progress: formattedTask.progress,
      message: formattedTask.message,
      metadata: formattedTask.metadata,
      createdAt: formattedTask.createdAt,
      completedAt: formattedTask.completedAt,
      error: formattedTask.error
    }
  }

  return NextResponse.json(response)
})

// DELETE /api/books/[id]/audio/generate - 清除音频文件重新生成
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
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

  // 删除音频文件记录
  await prisma.$transaction(async (tx) => {
    // 删除音频文件记录
    await tx.audioFile.deleteMany({
      where: { bookId: bookId }
    })

    // 删除音频生成任务记录
    await tx.processingTask.deleteMany({
      where: {
        bookId: bookId,
        taskType: 'AUDIO_GENERATION'
      }
    })

    // 重置书籍状态
    await tx.book.update({
      where: { id: bookId },
      data: {
        status: 'script_generated',
        metadata: {
          ...jsonObject(book.metadata),
          audioDeletedAt: new Date().toISOString(),
          previousAudioCount: book._count.audioFiles
        }
      }
    })
  })

  return NextResponse.json({
    success: true,
    message: '音频文件已清除，可以重新生成'
  })
})

/**
 * 执行音频生成任务
 */
async function runAudioGeneration(
  bookId: string,
  taskId: string,
  type: 'single' | 'batch' | 'book',
  scriptSentenceIds?: string[],
  voiceProfileId?: string,
  options: AudioGenerationOptions = {}
): Promise<void> {
  try {
    const audioGenerator = getAudioGenerator()

    await updateTaskProgress(taskId, 10, '准备生成音频')

    let results: any[] = []
    let totalSentences = 0

    if (type === 'book') {
      await updateTaskProgress(taskId, 20, '开始生成整书音频')
      const result = await audioGenerator.generateBookAudio(bookId, options)
      results = result.results
      totalSentences = result.total
    } else if (type === 'batch' && scriptSentenceIds) {
      await updateTaskProgress(taskId, 20, '开始批量生成音频')
      const requests: AudioGenerationRequest[] = scriptSentenceIds.map(id => ({
        scriptSentenceId: id,
        voiceProfileId,
        outputFormat: 'mp3'
      }))
      results = await audioGenerator.generateBatchAudio(requests, options)
      totalSentences = requests.length
    } else if (type === 'single' && scriptSentenceIds && scriptSentenceIds.length > 0) {
      await updateTaskProgress(taskId, 20, '开始生成单个音频')
      const request: AudioGenerationRequest = {
        scriptSentenceId: scriptSentenceIds[0],
        voiceProfileId,
        outputFormat: 'mp3'
      }
      const result = await audioGenerator.generateSingleAudio(request, options)
      results = [result]
      totalSentences = 1
    } else {
      throw new Error('无效的生成类型')
    }

    await updateTaskProgress(taskId, 90, '统计生成结果')

    // 统计结果
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    // 更新书籍元数据
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

    await updateTaskProgress(taskId, 100, '音频生成完成')

    // 标记任务完成
    const taskData = await mergeTaskData(taskId, {
      message: `音频生成完成，成功 ${successCount} 个，失败 ${failedCount} 个`,
      metadata: {
        type,
        voiceProfileId,
        totalSentences,
        successCount,
        failedCount,
        results: results.map(r => ({
          success: r.success,
          error: r.error,
          duration: r.duration
        }))
      }
    })

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        taskData
      }
    })

    // 如果全部成功，更新书籍状态
    if (failedCount === 0) {
      await prisma.book.update({
        where: { id: bookId },
        data: {
          status: 'completed',
          metadata: {
            ...jsonObject(book?.metadata),
            audioGenerationCompletedAt: new Date().toISOString(),
            totalAudioFiles: book?._count.audioFiles || 0,
            totalAudioDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
          }
        }
      })
    }

  } catch (error) {
    console.error('音频生成失败:', error)

    // 标记任务失败
    const taskData = await mergeTaskData(taskId, { message: '音频生成失败' })

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        taskData
      }
    })

    // 重置书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'script_generated' }
    })

    throw error
  }
}

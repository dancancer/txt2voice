// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求/路由参数/服务依赖
// output: HTTP 响应/JSON
// pos: API 路由处理器
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import type { AudioGenerationOptions } from '@/lib/audio-generator'
import {
  formatProcessingTask,
  jsonObject,
  mergeTaskData
} from '@/lib/processing-task-utils'
import { enqueueAudioGenerationJob } from '@/lib/task-queue'
import { assertAudioGenerationAllowed } from './route-helpers'

// POST /api/books/[id]/audio/generate - 生成音频
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params
  const body = await request.json()
  const {
    type,
    chapterId,
    scriptSentenceIds,
    voiceProfileId,
    autoMerge = false,
    options: rawOptions = {},
    routerPolicyVersion: routePolicyVersionInput,
    routerDebug: routerDebugInput,
    enableRouterDebug: enableRouterDebugInput
  }: {
    type: 'single' | 'batch' | 'book' | 'chapter'
    chapterId?: string
    scriptSentenceIds?: string[]
    voiceProfileId?: string
    autoMerge?: boolean
    options?: AudioGenerationOptions
    routerPolicyVersion?: string
    routerDebug?: boolean
    enableRouterDebug?: boolean
  } = body

  const normalizedRouterPolicyVersion =
    typeof routePolicyVersionInput === 'string' && routePolicyVersionInput.trim().length > 0
      ? routePolicyVersionInput.trim()
      : undefined
  const normalizedRouterDebug =
    typeof routerDebugInput === 'boolean'
      ? routerDebugInput
      : typeof enableRouterDebugInput === 'boolean'
        ? enableRouterDebugInput
        : undefined
  const options: AudioGenerationOptions = {
    ...(rawOptions || {}),
    ...(normalizedRouterPolicyVersion
      ? {
          routerPolicyVersion: normalizedRouterPolicyVersion,
        }
      : {}),
    ...(typeof normalizedRouterDebug === 'boolean'
      ? {
          enableRouterDebug: normalizedRouterDebug,
        }
      : {}),
  }

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

  assertAudioGenerationAllowed({
    status: book.status,
    scriptSentenceCount: book._count.scriptSentences
  })

  // 检查是否至少存在可用声音（角色绑定或系统默认声线）
  const charactersWithVoice = book.characterProfiles.filter(cp => cp.voiceBindings.length > 0)
  const availableVoiceProfilesCount = await prisma.tTSVoiceProfile.count({
    where: {
      isAvailable: true,
      ...(options.provider ? { provider: options.provider } : {})
    }
  })

  if (charactersWithVoice.length === 0 && availableVoiceProfilesCount === 0) {
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
    let totalSentences = 0

    if (type === 'book') {
      totalSentences = book._count.scriptSentences
    } else if (type === 'chapter' && chapterId) {
      const chapterSentences = await prisma.scriptSentence.count({
        where: { bookId, chapterId }
      })
      totalSentences = chapterSentences
    } else if (scriptSentenceIds) {
      totalSentences = scriptSentenceIds.length
    } else {
      totalSentences = 1
    }

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
            chapterId,
            scriptSentenceIds: scriptSentenceIds || [],
            totalSentences,
            voiceProfileId,
            autoMerge,
            provider: options.provider || null,
            routerPolicyVersion: options.routerPolicyVersion || null,
            enableRouterDebug: options.enableRouterDebug === true,
          }
        }
      }
    })

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'generating_audio' }
    })

    try {
      await enqueueAudioGenerationJob({
        taskId: task.id,
        bookId,
        type,
        chapterId,
        scriptSentenceIds,
        voiceProfileId,
        autoMerge,
        options
      })
    } catch (queueError) {
      const message =
        queueError instanceof Error ? queueError.message : '音频任务入队失败'
      const failedTaskData = await mergeTaskData(task.id, {
        message: '音频任务入队失败',
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

      await prisma.book.update({
        where: { id: bookId },
        data: { status: 'script_generated' }
      })

      throw queueError
    }

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

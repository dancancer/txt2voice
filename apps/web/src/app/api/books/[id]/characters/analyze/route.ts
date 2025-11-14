import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { characterRecognitionClient } from '@/lib/character-recognition-client'
import { mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from '@/lib/processing-task-utils'
import { logger } from '@/lib/logger'

// POST /api/books/[id]/characters/analyze - 使用异步识别服务分析角色
// 此端点已重构为统一使用异步识别服务
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

  if (book.status !== 'processed') {
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

// GET /api/books/[id]/characters/analyze - 获取分析状态
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { searchParams } = new URL(request.url)
  const includeResults = searchParams.get('includeResults') === 'true'

  const { id: bookId } = await params
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characterProfiles: {
        where: { isActive: true },
        include: {
          aliases: true,
          scriptSentences: true
        }
      },
      processingTasks: {
        where: { taskType: 'CHARACTER_ANALYSIS' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!book) {
    throw new ValidationError('书籍不存在')
  }

  const latestTask = book.processingTasks[0]

  const response: any = {
    success: true,
    data: {
      bookStatus: book.status,
      hasCharacters: book.characterProfiles.length > 0,
      characterCount: book.characterProfiles.length,
      mainCharacterCount: book.characterProfiles.filter(c => (c.characteristics as any)?.importance === 'main').length,
      analysisStatus: latestTask?.status || 'not_started',
      lastAnalysis: latestTask?.createdAt,
      analysisProgress: latestTask?.progress || 0
    }
  }

  if (includeResults && book.characterProfiles.length > 0) {
    response.data.characters = book.characterProfiles.map(profile => {
      const characteristics = profile.characteristics as any || {}
      const voicePreferences = profile.voicePreferences as any || {}
      const emotionProfile = profile.emotionProfile as any || {}
      return {
        id: profile.id,
        name: profile.canonicalName,
        description: characteristics.description,
        age: profile.ageHint,
        gender: profile.genderHint,
        personality: characteristics.personality,
        dialogueStyle: voicePreferences.dialogueStyle,
        emotionalTone: emotionProfile.emotionalTone,
        importance: characteristics.importance,
        aliases: profile.aliases.map(a => a.alias),
        dialogueCount: profile.scriptSentences.length
      }
    })
  }

  return NextResponse.json(response)
})

/**
 * 执行角色识别任务（异步模式）
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    const callbackUrl = `${baseUrl}/api/books/${bookId}/characters/recognize/callback`

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
    pollTaskStatus(bookId, taskId, taskResult.task_id).catch((error: Error) => {
      logger.error('轮询任务状态失败', error)
    })

  } catch (error) {
    logger.error('提交角色识别任务失败', error)

    // 标记任务失败
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

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

      // 更新进度
      if (externalTask.progress) {
        const progress = Math.min(30 + Math.floor(externalTask.progress * 0.4), 70)
        await updateTaskProgress(taskId, progress, externalTask.message || '识别中')
      }

      // 检查是否完成
      if (externalTask.status === 'completed' && externalTask.result) {
        logger.info(`外部任务 ${externalTaskId} 完成，处理结果`)
        await handleRecognitionComplete(bookId, taskId, externalTask.result)
        return
      }

      // 检查是否失败
      if (externalTask.status === 'failed') {
        logger.error(`外部任务 ${externalTaskId} 失败: ${externalTask.error}`)
        throw new Error(externalTask.error || '识别任务失败')
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

/**
 * 处理识别完成
 */
async function handleRecognitionComplete(bookId: string, taskId: string, recognitionResult: any): Promise<void> {
  try {
    await updateTaskProgress(taskId, 70, '保存识别结果')

    // 保存识别结果到数据库
    await saveRecognitionResults(bookId, recognitionResult)

    await updateTaskProgress(taskId, 90, '更新书籍状态')

    // 更新书籍状态和元数据
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'analyzed',
        metadata: {
          recognitionCompletedAt: new Date().toISOString(),
          characterCount: recognitionResult.characters.length,
          totalMentions: recognitionResult.statistics.total_mentions,
          totalDialogues: recognitionResult.statistics.total_dialogues,
          processingTime: recognitionResult.statistics.processing_time
        }
      }
    })

    await updateTaskProgress(taskId, 100, '识别完成')

    // 标记任务完成
    const taskData = await mergeTaskData(taskId, {
      message: '角色识别完成',
      result: {
        characterCount: recognitionResult.characters.length,
        statistics: recognitionResult.statistics
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

    logger.info('角色识别完成', {
      bookId,
      characterCount: recognitionResult.characters.length,
      processingTime: recognitionResult.statistics.processing_time
    })
  } catch (error) {
    logger.error('处理识别结果失败', error)
    throw error
  }
}

/**
 * 保存识别结果到数据库
 */
async function saveRecognitionResults(bookId: string, result: any): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 删除旧的角色配置（如果存在）
    await tx.characterProfile.deleteMany({
      where: { bookId }
    })

    // 保存角色配置
    for (const character of result.characters) {
      // 推断重要性
      const importance = character.quotes >= 10 ? 'main' :
        character.quotes >= 5 ? 'supporting' : 'minor'

      const profile = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: character.canonical_name,
          characteristics: {
            description: `提及${character.mentions}次，对话${character.quotes}次`,
            importance,
            firstAppearance: character.first_appearance_idx,
            roles: character.roles || []
          },
          voicePreferences: {},
          emotionProfile: {},
          genderHint: character.gender || 'unknown',
          ageHint: null,
          emotionBaseline: 'neutral',
          isActive: true
        }
      })

      // 保存角色别名
      if (character.aliases && character.aliases.length > 0) {
        await tx.characterAlias.createMany({
          data: character.aliases.map((alias: string) => ({
            characterId: profile.id,
            alias
          })),
          skipDuplicates: true
        })
      }
    }

    // 保存别名映射关系（用于后续查询）
    logger.info('角色识别结果已保存', {
      bookId,
      characterCount: result.characters.length,
      aliasCount: Object.keys(result.alias_map || {}).length
    })
  })
}

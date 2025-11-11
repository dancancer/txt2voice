import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError, TTSError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from '@/lib/processing-task-utils'
import { getLLMService, CharacterInfo, DialogueSegment, EmotionAnalysis } from '@/lib/llm-service'

// POST /api/books/[id]/characters/analyze - 分析文本识别角色
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

  // 检查是否已经在分析中
  const existingTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: 'CHARACTER_ANALYSIS',
      status: 'processing'
    }
  })

  if (existingTask) {
    throw new ValidationError('角色分析正在进行中，请稍后')
  }

  try {
    // 创建处理任务
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: 'CHARACTER_ANALYSIS',
        status: 'processing',
        progress: 0,
        taskData: {
          message: '开始分析角色和情感'
        }
      }
    })

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'analyzing' }
    })

    // 异步执行分析任务
    runCharacterAnalysis(bookId, task.id).catch(error => {
      console.error('角色分析任务失败:', error)
    })

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        message: '角色分析任务已启动'
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
 * 执行角色分析任务
 */
async function runCharacterAnalysis(bookId: string, taskId: string): Promise<void> {
  try {
    // 更新任务进度
    await updateTaskProgress(taskId, 10, '准备分析文本')

    // 获取书籍文本内容
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        textSegments: {
          select: { content: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    })

    if (!book || book.textSegments.length === 0) {
      throw new Error('没有找到可分析的文本内容')
    }

    // 合并所有文本段落
    const fullText = book.textSegments
      .map(segment => segment.content)
      .join('\n\n')

    await updateTaskProgress(taskId, 30, '开始LLM分析')

    // 调用LLM服务进行分析
    const llmService = getLLMService()
    const analysisResult = await llmService.analyzeScript(fullText)

    await updateTaskProgress(taskId, 70, '保存分析结果')

    // 保存分析结果到数据库
    await saveAnalysisResults(bookId, analysisResult)

    await updateTaskProgress(taskId, 90, '更新书籍状态')

    // 更新书籍状态
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'analyzed',
        metadata: {
          analysisCompletedAt: new Date().toISOString(),
          characterCount: analysisResult.characters.length,
          mainCharacterCount: analysisResult.characters.filter(c => c.importance === 'main').length,
          dialogueCount: analysisResult.dialogues.length,
          genre: analysisResult.summary.genre,
          tone: analysisResult.summary.tone
        }
      }
    })

    await updateTaskProgress(taskId, 100, '分析完成')

    // 标记任务完成
    const taskData = await mergeTaskData(taskId, { message: '角色分析完成' })

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        taskData
      }
    })

  } catch (error) {
    console.error('角色分析失败:', error)

    // 标记任务失败
    const taskData = await mergeTaskData(taskId, { message: '角色分析失败' })

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
      data: { status: 'processed' }
    })

    throw error
  }
}

/**
 * 更新任务进度
 */
/**
 * 保存分析结果到数据库
 */
async function saveAnalysisResults(bookId: string, result: any): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 保存角色配置
    for (const character of result.characters) {
      const profile = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: character.name,
          characteristics: {
            description: character.description,
            personality: character.personality,
            importance: character.importance,
            relationships: character.relationships || {}
          },
          voicePreferences: {
            dialogueStyle: character.dialogueStyle
          },
          emotionProfile: {
            emotionalTone: character.emotionalTone
          },
          genderHint: character.gender,
          ageHint: character.age,
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
          }))
        })
      }
    }

    // 这里可以保存对话和情感分析结果
    // 暂时跳过，因为schema中还没有对应的表
  })
}

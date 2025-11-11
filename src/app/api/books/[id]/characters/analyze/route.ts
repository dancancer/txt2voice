import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError, TTSError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { mergeTaskData, updateProcessingTaskProgress as updateTaskProgress } from '@/lib/processing-task-utils'
import { getLLMService, CharacterInfo, DialogueSegment, EmotionAnalysis, ScriptAnalysisResult } from '@/lib/llm-service'

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
      console.error('Error stack:', error.stack)
      console.error('Error details:', JSON.stringify(error, null, 2))
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
 * 合并分析结果
 */
function mergeAnalysisResults(
  allCharacters: any[],
  allDialogues: any[],
  allEmotions: any[],
  result: ScriptAnalysisResult
): void {
  // 合并角色信息
  for (const newChar of result.characters) {
    const existingChar = allCharacters.find(c =>
      c.name === newChar.name ||
      (c.aliases && newChar.aliases && (
        c.aliases.some((alias: string) => newChar.aliases.includes(alias)) ||
        newChar.aliases.some((alias: string) => c.aliases.includes(alias))
      ))
    )

    if (existingChar) {
      // 合并已存在角色的信息
      existingChar.aliases = [...new Set([...(existingChar.aliases || []), ...(newChar.aliases || [])])]
      existingChar.description = existingChar.description || newChar.description
      existingChar.age = existingChar.age || newChar.age
      existingChar.gender = existingChar.gender !== 'unknown' ? existingChar.gender : newChar.gender
      existingChar.personality = [...new Set([...(existingChar.personality || []), ...(newChar.personality || [])])]
      existingChar.emotionalTone = [...new Set([...(existingChar.emotionalTone || []), ...(newChar.emotionalTone || [])])]
      existingChar.frequency = (existingChar.frequency || 0) + (newChar.frequency || 0)
      if (existingChar.importance === 'minor' && newChar.importance !== 'minor') {
        existingChar.importance = newChar.importance
      }
    } else {
      // 添加新角色
      allCharacters.push(newChar)
    }
  }

  // 合并对话和情感
  allDialogues.push(...result.dialogues)
  allEmotions.push(...result.emotions)
}

/**
 * 执行角色分析任务
 */
async function runCharacterAnalysis(bookId: string, taskId: string): Promise<void> {
  try {
    // 更新任务进度
    await updateTaskProgress(taskId, 5, '准备分析文本')

    // 获取书籍基本信息和文本段落数量
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        _count: {
          select: { textSegments: true }
        }
      }
    })

    if (!book || book._count.textSegments === 0) {
      throw new Error('没有找到可分析的文本内容')
    }

    const totalSegments = book._count.textSegments
    console.log(`开始分析书籍 "${book.title}"，共 ${totalSegments} 个文本段落`)

    // 分批处理文本段落，每批处理一定数量的段落
    const BATCH_SIZE = 5 // 每批处理5个段落
    const CHARS_PER_BATCH = 10000 // 每批最多10000字符
    
    const llmService = getLLMService()
    const allCharacters: any[] = []
    const allDialogues: any[] = []
    const allEmotions: any[] = []
    let genre: string | undefined
    let tone = ''
    
    let processedSegments = 0
    let currentBatch: string[] = []
    let currentBatchChars = 0
    
    await updateTaskProgress(taskId, 10, '开始分段分析')

    // 使用游标分页逐批获取文本段落
    let cursor: string | undefined = undefined
    let hasMore = true
    
    while (hasMore) {
      // 获取下一批文本段落
      const segments: Array<{ id: string; content: string; orderIndex: number }> = await prisma.textSegment.findMany({
        where: { bookId },
        select: { id: true, content: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
      })

      if (segments.length === 0) {
        hasMore = false
        break
      }

      // 处理当前批次的段落
      for (const segment of segments) {
        currentBatch.push(segment.content)
        currentBatchChars += segment.content.length
        processedSegments++

        // 如果达到批次大小或字符限制，进行分析
        if (currentBatch.length >= BATCH_SIZE || currentBatchChars >= CHARS_PER_BATCH) {
          const batchText = currentBatch.join('\n\n')
          const progress = 10 + Math.floor((processedSegments / totalSegments) * 60)
          
          await updateTaskProgress(
            taskId, 
            progress, 
            `分析进度: ${processedSegments}/${totalSegments} 段落 (${Math.floor(batchText.length / 1000)}K字符)`
          )
          
          console.log(`处理批次: 段落 ${processedSegments - currentBatch.length + 1}-${processedSegments}, ${batchText.length} 字符`)
          
          // 调用LLM分析
          const result = await llmService.analyzeScript(batchText)
          
          // 合并结果
          mergeAnalysisResults(allCharacters, allDialogues, allEmotions, result)
          
          if (!genre && result.summary.genre) {
            genre = result.summary.genre
          }
          if (!tone && result.summary.tone) {
            tone = result.summary.tone
          }
          
          // 重置批次
          currentBatch = []
          currentBatchChars = 0
        }
      }

      // 更新游标
      cursor = segments[segments.length - 1].id
      
      // 如果返回的段落数少于请求数，说明已经到达末尾
      if (segments.length < BATCH_SIZE) {
        hasMore = false
      }
    }

    // 处理剩余的段落
    if (currentBatch.length > 0) {
      const batchText = currentBatch.join('\n\n')
      await updateTaskProgress(taskId, 70, `分析最后批次: ${currentBatch.length} 段落`)
      
      console.log(`处理最后批次: ${currentBatch.length} 段落, ${batchText.length} 字符`)
      
      const result = await llmService.analyzeScript(batchText)
      mergeAnalysisResults(allCharacters, allDialogues, allEmotions, result)
      
      if (!genre && result.summary.genre) {
        genre = result.summary.genre
      }
      if (!tone && result.summary.tone) {
        tone = result.summary.tone
      }
    }

    // 构建最终分析结果
    const analysisResult = {
      characters: allCharacters,
      dialogues: allDialogues,
      emotions: allEmotions,
      summary: {
        totalCharacters: allCharacters.length,
        mainCharacters: allCharacters.filter((c: any) => c.importance === 'main').length,
        dialogueCount: allDialogues.length,
        emotionTypes: [...new Set(allEmotions.map((e: any) => e.emotion))],
        genre,
        tone: tone || '中性'
      }
    }

    console.log(`分析完成: ${allCharacters.length} 个角色, ${allDialogues.length} 段对话`)

    await updateTaskProgress(taskId, 80, '保存分析结果')

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
      // 确保 age 是整数或 null
      let ageHint: number | null = null
      if (character.age !== undefined && character.age !== null) {
        const parsedAge = typeof character.age === 'number' ? character.age : parseInt(character.age, 10)
        ageHint = !isNaN(parsedAge) ? parsedAge : null
      }

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
          ageHint: ageHint,
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

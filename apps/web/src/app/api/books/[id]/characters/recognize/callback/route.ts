import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ValidationError } from '@/lib/error-handler'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

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

  const { task_id: externalTaskId, status, result, error } = body

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
    if (status === 'completed' && result) {
      // 处理成功结果
      await handleRecognitionComplete(bookId, task.id, result)
      
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

/**
 * 处理识别完成（复用 recognize/route.ts 中的逻辑）
 */
async function handleRecognitionComplete(bookId: string, taskId: string, recognitionResult: any): Promise<void> {
  try {
    // 保存识别结果到数据库
    await saveRecognitionResults(bookId, recognitionResult)

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

    // 标记任务完成
    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        taskData: {
          message: '角色识别完成',
          result: {
            characterCount: recognitionResult.characters.length,
            statistics: recognitionResult.statistics
          }
        }
      }
    })

    logger.info('角色识别完成（回调）', {
      bookId,
      characterCount: recognitionResult.characters.length
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
          canonicalName: character.name,
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

    logger.info('角色识别结果已保存', {
      bookId,
      characterCount: result.characters.length,
      aliasCount: Object.keys(result.alias_map).length
    })
  })
}

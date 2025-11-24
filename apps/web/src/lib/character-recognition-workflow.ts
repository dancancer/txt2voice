import prisma from '@/lib/prisma'
import { mergeTaskData, updateProcessingTaskProgress } from './processing-task-utils'
import { saveRecognitionResults } from './character-recognition-persistence'
import { characterRecognitionClient } from './character-recognition-client'

type RecognitionResult = {
  characters: unknown[]
  statistics: {
    total_mentions: number
    total_dialogues: number
    processing_time?: number
  }
}

async function fetchTextSegments(bookId: string): Promise<string[]> {
  const segments = await prisma.textSegment.findMany({
    where: { bookId },
    select: { content: true },
    orderBy: { orderIndex: 'asc' }
  })

  if (segments.length === 0) {
    throw new Error('没有找到可识别的文本内容')
  }

  return segments.map((segment) => segment.content)
}

// ======================== LLM 识别任务执行 ========================
export async function runCharacterRecognitionJob(
  bookId: string,
  taskId: string
): Promise<void> {
  await updateProcessingTaskProgress(taskId, 5, '准备文本数据')

  const fullText = (await fetchTextSegments(bookId)).join('\n\n')
  await updateProcessingTaskProgress(taskId, 25, '调用LLM识别角色')

  const recognitionResult = await characterRecognitionClient.recognize({
    text: fullText,
    book_id: bookId
  })

  await finalizeCharacterRecognition(bookId, taskId, recognitionResult)
}

// ======================== 识别完成统一处理 ========================
export async function finalizeCharacterRecognition(
  bookId: string,
  taskId: string,
  recognitionResult: RecognitionResult,
  message = '角色识别完成'
) {
  await updateProcessingTaskProgress(taskId, 70, '保存识别结果')
  await saveRecognitionResults(bookId, recognitionResult)

  await updateProcessingTaskProgress(taskId, 90, '更新书籍状态')

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: 'analyzed',
      metadata: {
        recognitionCompletedAt: new Date().toISOString(),
        characterCount: recognitionResult.characters.length,
        totalMentions: recognitionResult.statistics.total_mentions,
        totalDialogues: recognitionResult.statistics.total_dialogues,
        processingTime: recognitionResult.statistics.processing_time,
      },
    },
  })

  const taskData = await mergeTaskData(taskId, {
    message,
    result: {
      characterCount: recognitionResult.characters.length,
      statistics: recognitionResult.statistics,
    },
  })

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      taskData,
    },
  })
}

export async function markCharacterRecognitionFailed(
  bookId: string,
  taskId: string,
  errorMessage: string,
  message = '角色识别失败'
): Promise<void> {
  const taskData = await mergeTaskData(taskId, { message, error: errorMessage })
  await prisma.processingTask.update({
    where: { id: taskId },
    data: { status: 'failed', errorMessage, taskData },
  })
  await prisma.book.update({ where: { id: bookId }, data: { status: 'processed' } })
}

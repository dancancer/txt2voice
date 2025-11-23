import prisma from '@/lib/prisma'
import { mergeTaskData, updateProcessingTaskProgress } from './processing-task-utils'
import { saveRecognitionResults } from './character-recognition-persistence'

type RecognitionResult = {
  characters: unknown[]
  statistics: {
    total_mentions: number
    total_dialogues: number
    processing_time?: number
  }
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

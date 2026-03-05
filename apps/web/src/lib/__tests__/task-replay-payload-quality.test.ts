// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 模拟数据
// output: 质检任务重放载荷断言
// pos: 队列辅助模块测试
import { extractPayloadFromTask, isRecoverableTask } from '@/lib/task-queue/replay-payload'

describe('quality replay payload', () => {
  const baseTask = {
    id: 'task-qc-1',
    bookId: 'book-1',
    taskType: 'QUALITY_CHECK',
    status: 'failed',
    progress: 20,
    totalItems: 0,
    processedItems: 0,
    taskData: {},
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-03-05T04:00:00.000Z'),
    updatedAt: new Date('2026-03-05T04:10:00.000Z'),
    externalTaskId: null
  }

  it('should extract quality payload from queue metadata', () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          queuePayload: {
            type: 'chapter',
            chapterId: 'chapter-1',
            audioFileIds: ['audio-1', 'audio-2']
          }
        }
      }
    } as any)

    expect(payload).toEqual({
      kind: 'quality',
      input: {
        taskId: 'task-qc-1',
        bookId: 'book-1',
        type: 'chapter',
        chapterId: 'chapter-1',
        audioFileIds: ['audio-1', 'audio-2']
      }
    })
  })

  it('should fallback to metadata payload when queue payload missing', () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          type: 'batch',
          audioFileIds: ['audio-9']
        }
      }
    } as any)

    expect(payload).toEqual({
      kind: 'quality',
      input: {
        taskId: 'task-qc-1',
        bookId: 'book-1',
        type: 'batch',
        chapterId: undefined,
        audioFileIds: ['audio-9']
      }
    })
  })

  it('should treat quality check as recoverable task', () => {
    expect(isRecoverableTask('QUALITY_CHECK')).toBe(true)
    expect(isRecoverableTask('UNKNOWN_TASK')).toBe(false)
  })
})

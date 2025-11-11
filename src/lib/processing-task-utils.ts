import prisma, { Prisma, ProcessingTask } from '@/lib/prisma'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const jsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  isRecord(value) ? (value as Record<string, unknown>) : {}

export const jsonMetadata = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? (value as Record<string, unknown>) : null

export const mergeTaskData = async (
  taskId: string,
  updates: Record<string, unknown>
): Promise<Prisma.InputJsonValue> => {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: { taskData: true }
  })

  const current = jsonObject(task?.taskData)
  const next = { ...current, ...updates }

  if (updates.metadata !== undefined) {
    const previousMetadata = jsonMetadata(current.metadata)
    const nextMetadata = jsonMetadata(updates.metadata) ?? updates.metadata

    if (isRecord(previousMetadata) && isRecord(nextMetadata)) {
      next.metadata = { ...previousMetadata, ...nextMetadata }
    }
  }

  return next as Prisma.InputJsonValue
}

export const updateProcessingTaskProgress = async (
  taskId: string,
  progress: number,
  message: string
): Promise<void> => {
  const taskData = await mergeTaskData(taskId, { message })

  await prisma.processingTask.update({
    where: { id: taskId },
    data: { progress, taskData }
  })
}

export type FormattedProcessingTask = ProcessingTask & {
  message: string | null
  metadata: Record<string, unknown> | null
  error: string | null
}

export const formatProcessingTask = (task: ProcessingTask): FormattedProcessingTask => {
  const taskData = jsonObject(task.taskData)

  return {
    ...task,
    message: typeof taskData.message === 'string' ? taskData.message : null,
    metadata: jsonMetadata(taskData.metadata),
    error: task.errorMessage ?? null
  }
}

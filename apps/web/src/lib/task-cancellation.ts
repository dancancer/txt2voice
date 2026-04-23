// 一旦我被更新，请更新我的开头注释
// input: taskId/任务记录/取消元数据
// output: 任务取消判定、异常与落库工具
// pos: 任务取消共享模块
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";

export const CANCELED_TASK_STATUS = "canceled";

export class TaskCanceledError extends Error {
  constructor(
    public taskId: string,
    message = "任务已取消"
  ) {
    super(message);
    this.name = "TaskCanceledError";
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const isTaskCanceledError = (error: unknown): error is TaskCanceledError =>
  error instanceof TaskCanceledError;

export async function isProcessingTaskCanceled(taskId: string): Promise<boolean> {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      status: true,
      taskData: true,
    },
  });

  if (!task) {
    return false;
  }

  if (task.status === CANCELED_TASK_STATUS) {
    return true;
  }

  const metadata = asRecord(asRecord(task.taskData)?.metadata);
  return typeof metadata?.cancelRequestedAt === "string";
}

export async function throwIfTaskCanceled(
  taskId: string,
  message = "任务已取消"
): Promise<void> {
  if (await isProcessingTaskCanceled(taskId)) {
    throw new TaskCanceledError(taskId, message);
  }
}

export async function markProcessingTaskCanceled(params: {
  taskId: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const canceledAt = new Date();
  const taskData = await mergeTaskData(params.taskId, {
    message: params.message,
    metadata: {
      cancelRequestedAt: canceledAt.toISOString(),
      canceledAt: canceledAt.toISOString(),
      ...(params.metadata || {}),
    },
  });

  await prisma.processingTask.update({
    where: { id: params.taskId },
    data: {
      status: CANCELED_TASK_STATUS,
      completedAt: canceledAt,
      errorMessage: null,
      taskData,
    },
  });
}

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { mergeTaskData } from "@/lib/processing-task-utils";

export const resolveUpdatedStatus = (
  action: "approve" | "reject" | "regenerate"
): "resolved" | "rejected" => {
  return action === "approve" ? "resolved" : "rejected";
};

export const resolveResolutionType = (
  action: "approve" | "reject" | "regenerate"
): string => {
  return action === "approve" ? "approved" : "rejected";
};

export const ensureNoActiveAudioTask = async (bookId: string): Promise<void> => {
  const activeAudioTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
    },
    select: { id: true },
  });

  if (activeAudioTask) {
    throw new ValidationError("当前存在执行中的音频任务，请稍后重试");
  }
};

export const ensureNoActiveScriptTask = async (bookId: string): Promise<void> => {
  const activeScriptTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: "SCRIPT_GENERATION",
      status: "processing",
    },
    select: { id: true },
  });

  if (activeScriptTask) {
    throw new ValidationError("当前存在执行中的台本任务，请稍后重试");
  }
};

export const handleTaskEnqueueFailure = async ({
  taskId,
  queueError,
  message,
}: {
  taskId: string;
  queueError: unknown;
  message: string;
}) => {
  const errorMessage =
    queueError instanceof Error ? queueError.message : message;
  const failedTaskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      queueError: errorMessage,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
      taskData: failedTaskData,
    },
  });
};

export const markTaskRolledBack = async ({
  taskId,
  message,
}: {
  taskId: string;
  message: string;
}) => {
  const failedTaskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      compensation: "rolled_back_before_execution",
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      taskData: failedTaskData,
    },
  });
};

export const resetPendingReviewItemState = async (itemIds: string[]): Promise<void> => {
  for (const itemId of itemIds) {
    await prisma.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: "pending",
        resolutionType: null,
        resolutionNote: null,
        resolvedAt: null,
      },
    });
  }
};

export const markReprocessingReviewItems = async (params: {
  items: Array<{ id: string }>;
  resolutionType: string;
  resolutionNote: string;
}) => {
  for (const item of params.items) {
    await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "reprocessing",
        resolutionType: params.resolutionType,
        resolutionNote: params.resolutionNote,
        resolvedAt: null,
      },
    });
  }
};

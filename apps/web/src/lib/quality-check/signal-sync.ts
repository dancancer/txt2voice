import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { runQualitySignalSyncTask } from "@/lib/quality-signal-sync-runner";
import type { SignalSyncTaskContext } from "@/lib/quality-check/task-context";
import type { QualityCheckTaskType } from "@/lib/quality-check/shared-types";

const toInputJsonValue = (value: unknown) => {
  return JSON.parse(JSON.stringify(value ?? {}));
};

export const runSignalSyncBeforeQualityCheck = async ({
  parentTaskId,
  bookId,
  type,
  chapterId,
  audioFileIds,
  totalItems,
  signalSync,
}: {
  parentTaskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  totalItems: number;
  signalSync: SignalSyncTaskContext;
}): Promise<string | null> => {
  if (!signalSync.enabled || totalItems <= 0) {
    return null;
  }

  const childTask = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "QUALITY_SIGNAL_SYNC",
      status: "processing",
      progress: 0,
      totalItems,
      taskData: toInputJsonValue({
        message: "质量检查前置信号生产任务已创建",
        metadata: {
          source: "quality_signal_sync",
          parentQualityCheckTaskId: parentTaskId,
          type,
          chapterId: chapterId || null,
          audioFileIds: audioFileIds || [],
          totalItems,
          forceResync: signalSync.forceResync,
          signalPayloadByAudioFileId: signalSync.signalPayloadByAudioFileId,
          signalPayloadBySentenceId: signalSync.signalPayloadBySentenceId,
          signalModelRuntime: signalSync.signalModelRuntime,
        },
      }),
    },
  });

  try {
    await runQualitySignalSyncTask({
      taskId: childTask.id,
      bookId,
      type,
      chapterId,
      audioFileIds,
      forceResync: signalSync.forceResync,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "质量检查前置信号生产失败";
    const failedTaskData = await mergeTaskData(childTask.id, {
      message: "质量检查前置信号生产失败",
      metadata: {
        source: "quality_signal_sync",
        parentQualityCheckTaskId: parentTaskId,
        lastError: message,
      },
    });

    await prisma.processingTask.update({
      where: { id: childTask.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    throw error;
  }

  return childTask.id;
};

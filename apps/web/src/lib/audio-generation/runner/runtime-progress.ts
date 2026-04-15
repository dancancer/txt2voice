import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  buildAudioBatchPassRuntimeEvent,
  buildTaskStageRuntimeEvent,
} from "@/lib/script-generation/runner/runtime-events";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

export const createAudioTaskRuntimeUpdater = (params: {
  taskId: string;
  metadata: unknown;
}) => {
  let metadata = { ...asRecord(params.metadata) };
  let progress = 0;
  let message = "";
  let queue = Promise.resolve();

  const persist = async () => {
    const taskData = await mergeTaskData(params.taskId, {
      message,
      metadata,
    });

    await prisma.processingTask.update({
      where: { id: params.taskId },
      data: {
        progress,
        taskData,
      },
    });
  };

  const enqueue = (runner: () => void) => {
    queue = queue.catch(() => undefined).then(async () => {
      runner();
      await persist();
    });
    return queue;
  };

  return {
    getMetadata() {
      return metadata;
    },
    async setStage(input: {
      progress: number;
      message: string;
      title: string;
      detail?: string;
      stage: string;
      status?: "info" | "success" | "warning" | "error";
    }) {
      progress = input.progress;
      message = input.message;
      return enqueue(() => {
        metadata = buildTaskStageRuntimeEvent({
          metadata,
          title: input.title,
          detail: input.detail,
          progress,
          stage: input.stage,
          status: input.status,
        }).metadata;
      });
    },
    async recordBatchPass(input: {
      passName: string;
      requestCount: number;
      successCount: number;
      failedCount: number;
      concurrency: number;
      durationMs: number;
      progress: number;
    }) {
      progress = input.progress;
      return enqueue(() => {
        metadata = buildAudioBatchPassRuntimeEvent({
          metadata,
          ...input,
        }).metadata;
      });
    },
  };
};

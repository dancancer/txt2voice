// 一旦我被更新，请更新我的开头注释
// input: 书籍ID/自动编排参数/触发上下文
// output: 自动编排任务创建结果
// pos: 自动编排触发服务
import { ValidationError } from "@/lib/error-handler";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import prisma, { Prisma } from "@/lib/prisma";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAutoPipelineJob } from "@/lib/task-queue";

const PIPELINE_STAGE_TASK_TYPES = [
  "TEXT_PROCESSING",
  "SCRIPT_GENERATION",
  "AUDIO_GENERATION",
  "QUALITY_CHECK",
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

const isQualityCheckEnabled = (options: AutoPipelineOptions): boolean => {
  return options.qualityCheck?.enabled !== false;
};

const readTotalStagesFromTask = (
  taskData: Prisma.JsonValue | null | undefined
): number | null => {
  const root = jsonObject(taskData);
  const metadata = asRecord(root.metadata);
  if (!metadata) {
    return null;
  }

  const totalStages = metadata.totalStages;
  if (typeof totalStages !== "number" || !Number.isFinite(totalStages)) {
    return null;
  }

  return Math.max(3, Math.floor(totalStages));
};

const buildBookStatusUpdatePayload = (
  metadata: Prisma.JsonValue | null | undefined,
  nextLastTrigger: Record<string, unknown>
): Prisma.InputJsonValue => {
  const root = jsonObject(metadata);
  const autoPipeline = asRecord(root.autoPipeline) || {};

  return toInputJsonValue({
    ...root,
    autoPipeline: {
      ...autoPipeline,
      lastTrigger: nextLastTrigger,
    },
  });
};

export interface StartAutoPipelineTaskInput {
  bookId: string;
  options?: AutoPipelineOptions;
  triggerSource: string;
  triggerMetadata?: Record<string, unknown>;
  allowReuseRunningTask?: boolean;
}

export interface StartAutoPipelineTaskResult {
  taskId: string;
  reused: boolean;
  totalStages: number;
  qualityCheckEnabled: boolean;
}

export async function startAutoPipelineTask({
  bookId,
  options = {},
  triggerSource,
  triggerMetadata,
  allowReuseRunningTask = true,
}: StartAutoPipelineTaskInput): Promise<StartAutoPipelineTaskResult> {
  const [book, existingAutoPipelineTask, existingStageTask] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        status: true,
        uploadedFilePath: true,
        metadata: true,
      },
    }),
    prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: "AUTO_PIPELINE",
        status: "processing",
      },
      select: {
        id: true,
        taskData: true,
      },
    }),
    prisma.processingTask.findFirst({
      where: {
        bookId,
        taskType: {
          in: [...PIPELINE_STAGE_TASK_TYPES],
        },
        status: "processing",
      },
      select: { id: true, taskType: true },
    }),
  ]);

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  if (!book.uploadedFilePath) {
    throw new ValidationError("请先上传文本文件");
  }

  const qualityCheckEnabled = isQualityCheckEnabled(options);
  const computedTotalStages = qualityCheckEnabled ? 4 : 3;

  if (existingAutoPipelineTask) {
    if (!allowReuseRunningTask) {
      throw new ValidationError("自动编排任务正在执行中，请稍后");
    }

    const existingTotalStages =
      readTotalStagesFromTask(existingAutoPipelineTask.taskData) ?? computedTotalStages;

    return {
      taskId: existingAutoPipelineTask.id,
      reused: true,
      totalStages: existingTotalStages,
      qualityCheckEnabled: existingTotalStages === 4,
    };
  }

  if (existingStageTask) {
    throw new ValidationError(
      `当前存在执行中的${existingStageTask.taskType}任务，请稍后重试`
    );
  }

  const triggerTime = new Date().toISOString();
  const optionsJson = toInputJsonValue(options);
  const triggerMetadataJson = toInputJsonValue(triggerMetadata || {});

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUTO_PIPELINE",
      status: "processing",
      progress: 0,
      totalItems: computedTotalStages,
      taskData: {
        message: "Auto Pipeline 任务已创建",
        metadata: {
          source: "auto_pipeline",
          triggerSource,
          triggerMetadata: triggerMetadataJson,
          triggeredAt: triggerTime,
          currentStage: "init",
          totalStages: computedTotalStages,
          options: optionsJson,
        },
      },
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "processing",
      metadata: buildBookStatusUpdatePayload(book.metadata, {
        taskId: task.id,
        source: triggerSource,
        triggeredAt: triggerTime,
        reused: false,
      }),
    },
  });

  try {
    await enqueueAutoPipelineJob(
      {
        taskId: task.id,
        bookId,
        options,
      },
      {
        reason: triggerSource || "pipeline_auto_api",
      }
    );
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "自动编排任务入队失败";
    const failedTaskData = await mergeTaskData(task.id, {
      message: "Auto Pipeline 入队失败",
      metadata: {
        queueError: message,
      },
    });

    await prisma.processingTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: book.status,
      },
    });

    throw queueError;
  }

  return {
    taskId: task.id,
    reused: false,
    totalStages: computedTotalStages,
    qualityCheckEnabled,
  };
}

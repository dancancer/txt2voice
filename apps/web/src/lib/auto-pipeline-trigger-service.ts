// 一旦我被更新，请更新我的开头注释
// input: 书籍ID/自动编排参数/触发上下文
// output: 自动编排任务创建与补偿调度结果
// pos: 自动编排触发服务
import { ValidationError } from "@/lib/error-handler";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import {
  buildAutoPipelineBookMetadata,
} from "@/lib/auto-pipeline-trigger-metadata";
import prisma, { Prisma } from "@/lib/prisma";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";

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

const requiresQualityCheckChapter = (options: AutoPipelineOptions): boolean => {
  return isQualityCheckEnabled(options) && options.qualityCheck?.type === "chapter";
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

const buildCompensationState = ({
  taskId,
  status,
  triggerSource,
  triggerMetadata,
  lastError,
  linkedTaskId,
  reused,
}: {
  taskId: string;
  status: "scheduled" | "processing" | "completed" | "failed";
  triggerSource: string;
  triggerMetadata: Record<string, unknown>;
  lastError?: string | null;
  linkedTaskId?: string | null;
  reused?: boolean;
}) => {
  const timestamp = new Date().toISOString();
  return {
    taskId,
    status,
    triggerSource,
    triggerMetadata,
    ...(status === "scheduled" ? { scheduledAt: timestamp } : {}),
    ...(status === "processing" ? { startedAt: timestamp } : {}),
    ...(status === "completed"
      ? {
          completedAt: timestamp,
          linkedTaskId: linkedTaskId || null,
          reused: Boolean(reused),
          lastError: null,
        }
      : {}),
    ...(status === "failed"
      ? {
          failedAt: timestamp,
          lastError: lastError || "未知错误",
        }
      : {}),
    ...(status !== "failed" && lastError ? { lastError } : {}),
  };
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

export interface ScheduleAutoPipelineCompensationTaskInput {
  bookId: string;
  options?: AutoPipelineOptions;
  originalTriggerSource: string;
  triggerMetadata?: Record<string, unknown>;
  triggerFailure: string;
}

export interface ScheduleAutoPipelineCompensationTaskResult {
  taskId: string;
  status: "scheduled" | "failed";
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

  if (requiresQualityCheckChapter(options) && !options.qualityCheck?.chapterId) {
    throw new ValidationError("自动编排章节质检必须提供 qualityCheck.chapterId");
  }

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
      metadata: buildAutoPipelineBookMetadata({
        metadata: book.metadata,
        lastTrigger: {
          taskId: task.id,
          source: triggerSource,
          triggeredAt: triggerTime,
          reused: false,
        },
        compensation: null,
      }),
    },
  });

  try {
    await enqueueAutoPipelineJobInternal(
      {
        taskId: task.id,
        bookId,
        options,
        mode: "pipeline",
        triggerSource,
        triggerMetadata: triggerMetadata || {},
        allowReuseRunningTask,
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

export async function scheduleAutoPipelineCompensationTask({
  bookId,
  options = {},
  originalTriggerSource,
  triggerMetadata,
  triggerFailure,
}: ScheduleAutoPipelineCompensationTaskInput): Promise<ScheduleAutoPipelineCompensationTaskResult> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      status: true,
      uploadedFilePath: true,
      metadata: true,
    },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  if (!book.uploadedFilePath) {
    throw new ValidationError("请先上传文本文件");
  }

  const triggerSource = "upload_compensation";
  const triggerTime = new Date().toISOString();
  const triggerPayload = {
    ...(triggerMetadata || {}),
    originalTriggerSource,
    compensationScheduledAt: triggerTime,
  };
  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUTO_PIPELINE_COMPENSATION",
      status: "processing",
      progress: 0,
      totalItems: 1,
      taskData: {
        message: "上传自动触发补偿任务已创建",
        metadata: {
          source: "upload_compensation",
          mode: "trigger_compensation",
          triggerSource,
          originalTriggerSource,
          triggerMetadata: toInputJsonValue(triggerPayload),
          allowReuseRunningTask: true,
          scheduledAt: triggerTime,
          triggerFailure,
          options: toInputJsonValue(options),
        },
      },
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: buildAutoPipelineBookMetadata({
        metadata: book.metadata,
        compensation: buildCompensationState({
          taskId: task.id,
          status: "scheduled",
          triggerSource,
          triggerMetadata: triggerPayload,
          lastError: triggerFailure,
        }),
      }),
    },
  });

  try {
    await enqueueAutoPipelineJobInternal(
      {
        taskId: task.id,
        bookId,
        options,
        mode: "trigger_compensation",
        triggerSource,
        triggerMetadata: {
          ...triggerPayload,
          compensationTaskId: task.id,
        },
        allowReuseRunningTask: true,
      },
      {
        allowReuse: false,
        reason: "upload_trigger_compensation",
      }
    );
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "上传补偿任务入队失败";
    const failedTaskData = await mergeTaskData(task.id, {
      message: "上传自动触发补偿任务入队失败",
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
        metadata: buildAutoPipelineBookMetadata({
          metadata: book.metadata,
          compensation: buildCompensationState({
            taskId: task.id,
            status: "failed",
            triggerSource,
            triggerMetadata: triggerPayload,
            lastError: message,
          }),
        }),
      },
    });

    return {
      taskId: task.id,
      status: "failed",
    };
  }

  return {
    taskId: task.id,
    status: "scheduled",
  };
}

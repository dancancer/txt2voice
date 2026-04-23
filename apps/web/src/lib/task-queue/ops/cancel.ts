// 一旦我被更新，请更新我的开头注释
// input: taskId/取消原因
// output: 任务取消结果
// pos: 任务取消执行器
import prisma from "@/lib/prisma";
import { jsonObject } from "@/lib/processing-task-utils";
import {
  CANCELED_TASK_STATUS,
  markProcessingTaskCanceled,
} from "@/lib/task-cancellation";
import { cancelProcessingTaskJob, getQueueJobState } from "@/lib/task-queue/core/runtime";
import type { QueueTaskType } from "@/lib/task-queue/replay-payload";

type CancelableTaskType = QueueTaskType | "TEXT_PROCESSING";

export interface CancelProcessingTaskResult {
  taskId: string;
  taskType: CancelableTaskType;
  bookId: string;
  status: typeof CANCELED_TASK_STATUS;
  queueState: string | null;
  queueCanceled: boolean;
  cancellationMode: "already_canceled" | "queue_remove" | "hard_cancel";
  propagatedTaskIds: string[];
}

const CANCELABLE_TASK_TYPES = new Set<CancelableTaskType>([
  "TEXT_PROCESSING",
  "SCRIPT_GENERATION",
  "AUDIO_GENERATION",
  "QUALITY_CHECK",
  "QUALITY_SIGNAL_SYNC",
  "AUTO_PIPELINE",
  "AUTO_PIPELINE_COMPENSATION",
  "FINAL_ASSEMBLY",
  "MANUAL_REVIEW_SYNC",
]);

const QUEUE_BACKED_TASK_TYPES = new Set<QueueTaskType>([
  "SCRIPT_GENERATION",
  "AUDIO_GENERATION",
  "QUALITY_CHECK",
  "QUALITY_SIGNAL_SYNC",
  "AUTO_PIPELINE",
  "AUTO_PIPELINE_COMPENSATION",
  "FINAL_ASSEMBLY",
  "MANUAL_REVIEW_SYNC",
]);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isCancelableTaskType = (taskType: string): taskType is CancelableTaskType =>
  CANCELABLE_TASK_TYPES.has(taskType as CancelableTaskType);

const isQueueBackedTaskType = (taskType: string): taskType is QueueTaskType =>
  QUEUE_BACKED_TASK_TYPES.has(taskType as QueueTaskType);

const STAGE_BOOK_STATUS_FALLBACK: Record<string, string> = {
  text_processing: "uploaded",
  script_generation: "processed",
  audio_generation: "script_generated",
  quality_check: "script_generated",
  quality_signal_sync: "script_generated",
  final_assembly: "manual_review_pending",
  manual_review_sync: "manual_review_pending",
};

const TASK_BOOK_STATUS_FALLBACK: Record<CancelableTaskType, string> = {
  TEXT_PROCESSING: "uploaded",
  SCRIPT_GENERATION: "processed",
  AUDIO_GENERATION: "script_generated",
  QUALITY_CHECK: "script_generated",
  QUALITY_SIGNAL_SYNC: "script_generated",
  AUTO_PIPELINE: "uploaded",
  AUTO_PIPELINE_COMPENSATION: "uploaded",
  FINAL_ASSEMBLY: "manual_review_pending",
  MANUAL_REVIEW_SYNC: "manual_review_pending",
};

const readRelatedTaskIds = (params: {
  taskId: string;
  taskType: CancelableTaskType;
  taskData: unknown;
}): string[] => {
  const metadata = asRecord(asRecord(params.taskData)?.metadata);
  const relatedTaskIds = new Set<string>();

  if (params.taskType === "AUTO_PIPELINE") {
    const stages = asRecord(metadata?.stages);
    if (stages) {
      for (const stageValue of Object.values(stages)) {
        const stageRecord = asRecord(stageValue);
        const stageTaskId = asString(stageRecord?.taskId);
        if (stageTaskId && stageTaskId !== params.taskId) {
          relatedTaskIds.add(stageTaskId);
        }
      }
    }
  }

  const source = asString(metadata?.source);
  const pipelineTaskId = asString(metadata?.pipelineTaskId);
  if (source === "auto_pipeline" && pipelineTaskId && pipelineTaskId !== params.taskId) {
    relatedTaskIds.add(pipelineTaskId);
  }

  return [...relatedTaskIds];
};

const resolveBookStatusAfterCancel = (params: {
  taskType: CancelableTaskType;
  taskData: unknown;
}): string => {
  const metadata = asRecord(asRecord(params.taskData)?.metadata);
  const previousBookStatus = asString(metadata?.previousBookStatus);
  if (previousBookStatus) {
    return previousBookStatus;
  }

  const currentStage = asString(metadata?.currentStage);
  if (currentStage && STAGE_BOOK_STATUS_FALLBACK[currentStage]) {
    return STAGE_BOOK_STATUS_FALLBACK[currentStage];
  }

  const stage = asString(metadata?.stage);
  if (stage && STAGE_BOOK_STATUS_FALLBACK[stage]) {
    return STAGE_BOOK_STATUS_FALLBACK[stage];
  }

  return TASK_BOOK_STATUS_FALLBACK[params.taskType];
};

const markWorkflowCanceled = async (taskId: string): Promise<void> => {
  const workflowRuns = await prisma.workflowRun.findMany({
    where: {
      processingTaskId: taskId,
      status: "processing",
    },
    select: { id: true },
  });

  if (workflowRuns.length === 0) {
    return;
  }

  const workflowRunIds = workflowRuns.map((item) => item.id);
  const canceledAt = new Date();

  await prisma.workflowRun.updateMany({
    where: { id: { in: workflowRunIds } },
    data: {
      status: CANCELED_TASK_STATUS,
      completedAt: canceledAt,
    },
  });

  await prisma.stageRun.updateMany({
    where: {
      workflowRunId: { in: workflowRunIds },
      status: "processing",
    },
    data: {
      status: CANCELED_TASK_STATUS,
      completedAt: canceledAt,
    },
  });

  const stageRuns = await prisma.stageRun.findMany({
    where: { workflowRunId: { in: workflowRunIds } },
    select: { id: true },
  });

  if (stageRuns.length === 0) {
    return;
  }

  const stageRunIds = stageRuns.map((item) => item.id);

  await prisma.agentRun.updateMany({
    where: {
      stageRunId: { in: stageRunIds },
      status: "processing",
    },
    data: {
      status: CANCELED_TASK_STATUS,
      completedAt: canceledAt,
    },
  });

  const agentRuns = await prisma.agentRun.findMany({
    where: { stageRunId: { in: stageRunIds } },
    select: { id: true },
  });

  if (agentRuns.length === 0) {
    return;
  }

  await prisma.toolCall.updateMany({
    where: {
      agentRunId: { in: agentRuns.map((item) => item.id) },
      status: "processing",
    },
    data: {
      status: CANCELED_TASK_STATUS,
      completedAt: canceledAt,
    },
  });
};

const markSingleTaskCanceled = async (params: {
  taskId: string;
  taskType: CancelableTaskType;
  bookId: string;
  bookStatus: string;
  reason: string;
  queueState: string | null;
  queueCanceled: boolean;
  cancellationMode: CancelProcessingTaskResult["cancellationMode"];
}): Promise<void> => {
  await markProcessingTaskCanceled({
    taskId: params.taskId,
    message: "任务已取消",
    metadata: {
      cancellationReason: params.reason,
      cancellationMode: params.cancellationMode,
      queueState: params.queueState,
      queueCanceled: params.queueCanceled,
    },
  });

  await markWorkflowCanceled(params.taskId);

  await prisma.book.update({
    where: { id: params.bookId },
    data: {
      status: params.bookStatus,
    },
  });
};

export async function cancelProcessingTask(
  taskId: string,
  options: { reason?: string } = {}
): Promise<CancelProcessingTaskResult> {
  const reason = options.reason || "manual_api_cancel";
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      bookId: true,
      taskType: true,
      status: true,
      taskData: true,
    },
  });

  if (!task) {
    throw new Error("任务不存在");
  }

  if (!isCancelableTaskType(task.taskType)) {
    throw new Error("当前任务类型不支持取消");
  }

  const relatedTaskIds = readRelatedTaskIds({
    taskId: task.id,
    taskType: task.taskType,
    taskData: task.taskData,
  });

  if (task.status === CANCELED_TASK_STATUS) {
    return {
      taskId: task.id,
      taskType: task.taskType,
      bookId: task.bookId,
      status: CANCELED_TASK_STATUS,
      queueState: null,
      queueCanceled: false,
      cancellationMode: "already_canceled",
      propagatedTaskIds: relatedTaskIds,
    };
  }

  let queueState: string | null = null;
  let queueCanceled = false;
  let cancellationMode: CancelProcessingTaskResult["cancellationMode"] = "hard_cancel";

  if (isQueueBackedTaskType(task.taskType)) {
    const queueResult = await cancelProcessingTaskJob(task.taskType, task.id);
    queueState = queueResult.state;
    queueCanceled = queueResult.canceled;
    cancellationMode = queueCanceled ? "queue_remove" : "hard_cancel";

    if (!queueResult.exists) {
      const stateResult = await getQueueJobState(task.taskType, task.id);
      queueState = stateResult.state;
    }
  }

  await markSingleTaskCanceled({
    taskId: task.id,
    taskType: task.taskType,
    bookId: task.bookId,
    bookStatus: resolveBookStatusAfterCancel({
      taskType: task.taskType,
      taskData: task.taskData,
    }),
    reason,
    queueState,
    queueCanceled,
    cancellationMode,
  });

  if (relatedTaskIds.length > 0) {
    const relatedTasks = await prisma.processingTask.findMany({
      where: {
        id: { in: relatedTaskIds },
        status: {
          in: ["pending", "processing"],
        },
      },
      select: {
        id: true,
        taskType: true,
      },
    });

    for (const relatedTask of relatedTasks) {
      if (!isCancelableTaskType(relatedTask.taskType)) {
        continue;
      }

      let relatedQueueState: string | null = null;
      let relatedQueueCanceled = false;
      let relatedMode: CancelProcessingTaskResult["cancellationMode"] = "hard_cancel";

      if (isQueueBackedTaskType(relatedTask.taskType)) {
        const relatedQueueResult = await cancelProcessingTaskJob(
          relatedTask.taskType,
          relatedTask.id
        );
        relatedQueueState = relatedQueueResult.state;
        relatedQueueCanceled = relatedQueueResult.canceled;
        relatedMode = relatedQueueCanceled ? "queue_remove" : "hard_cancel";
      }

      await markSingleTaskCanceled({
        taskId: relatedTask.id,
        taskType: relatedTask.taskType,
        bookId: task.bookId,
        bookStatus: resolveBookStatusAfterCancel({
          taskType: relatedTask.taskType,
          taskData: jsonObject(task.taskData),
        }),
        reason: `${reason}:propagated`,
        queueState: relatedQueueState,
        queueCanceled: relatedQueueCanceled,
        cancellationMode: relatedMode,
      });
    }
  }

  return {
    taskId: task.id,
    taskType: task.taskType,
    bookId: task.bookId,
    status: CANCELED_TASK_STATUS,
    queueState,
    queueCanceled,
    cancellationMode,
    propagatedTaskIds: relatedTaskIds,
  };
}

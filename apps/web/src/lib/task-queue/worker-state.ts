import type Bull from "bull";
import { buildAutoPipelineBookMetadata, readAutoPipelineCompensationTaskId } from "@/lib/auto-pipeline-trigger-metadata";
import prisma from "@/lib/prisma";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";
import {
  CANCELED_TASK_STATUS,
  TaskCanceledError,
} from "@/lib/task-cancellation";
import { readGovernanceState } from "@/lib/deep-gate-calibration-governance/parsers";
import type { QueueTaskType } from "./replay-payload";

export type BookFallbackStatus =
  | "uploaded"
  | "completed"
  | "processed"
  | "script_generated"
  | "manual_review_pending"
  | "assembling_audio"
  | "completed_with_errors"
  | "error";

export interface DeadLetterInput {
  taskId: string;
  taskType: QueueTaskType;
  bookId: string;
  queueJobId: string;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
}

const extractBackoffDelay = (job: Bull.Job<unknown>): number | null => {
  if (typeof job.opts.backoff === "number") {
    return job.opts.backoff;
  }

  if (
    job.opts.backoff &&
    typeof job.opts.backoff === "object" &&
    "delay" in job.opts.backoff &&
    typeof job.opts.backoff.delay === "number"
  ) {
    return job.opts.backoff.delay;
  }

  return null;
};

export async function markTaskAttemptStart(
  taskId: string,
  job: Bull.Job<unknown>
): Promise<void> {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

  if (task?.status === CANCELED_TASK_STATUS) {
    throw new TaskCanceledError(taskId);
  }

  const taskData = await mergeTaskData(taskId, {
    message: "任务已进入执行队列",
    metadata: {
      queueJobId: String(job.id || taskId),
      queueAttempt: job.attemptsMade + 1,
      heartbeatAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "processing",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      taskData,
    },
  });
}

async function touchTaskHeartbeat(
  taskId: string,
  job: Bull.Job<unknown>
): Promise<void> {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

  if (task?.status === CANCELED_TASK_STATUS) {
    return;
  }

  const taskData = await mergeTaskData(taskId, {
    metadata: {
      queueJobId: String(job.id || taskId),
      queueAttempt: job.attemptsMade + 1,
      heartbeatAt: new Date().toISOString(),
      workerPid: process.pid,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      taskData,
    },
  });
}

export async function withTaskHeartbeat<T>(
  taskId: string,
  job: Bull.Job<unknown>,
  heartbeatIntervalMs: number,
  run: () => Promise<T>
): Promise<T> {
  await touchTaskHeartbeat(taskId, job);

  const timer = setInterval(() => {
    void touchTaskHeartbeat(taskId, job).catch((error) => {
      console.error("[task-queue] heartbeat update failed", {
        taskId,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, heartbeatIntervalMs);

  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }

  try {
    return await run();
  } finally {
    clearInterval(timer);
  }
}

export async function markTaskFailed(
  taskId: string,
  bookId: string,
  fallbackStatus: BookFallbackStatus,
  message: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: { taskData: true, status: true },
  });

  if (taskSnapshot?.status === CANCELED_TASK_STATUS) {
    return;
  }

  const taskRoot = jsonObject(taskSnapshot?.taskData);
  const taskMetadata =
    taskRoot.metadata && typeof taskRoot.metadata === "object" && !Array.isArray(taskRoot.metadata)
      ? (taskRoot.metadata as Record<string, unknown>)
      : {};
  const isCalibrationEval = taskMetadata.source === "calibration_eval";
  const isUploadCompensation = taskMetadata.source === "upload_compensation";
  const isQualitySignalSync = taskMetadata.source === "quality_signal_sync";
  const isFinalAssembly = taskMetadata.source === "final_assembly";
  const isManualReviewSync = taskMetadata.source === "manual_review_sync";
  const calibrationEval =
    taskMetadata.calibrationEval &&
    typeof taskMetadata.calibrationEval === "object" &&
    !Array.isArray(taskMetadata.calibrationEval)
      ? (taskMetadata.calibrationEval as Record<string, unknown>)
      : null;
  const reportId =
    calibrationEval && typeof calibrationEval.reportId === "string"
      ? calibrationEval.reportId
      : null;

  const taskData = await mergeTaskData(taskId, {
    message: "任务执行失败",
    metadata,
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      taskData,
    },
  });

  if (isCalibrationEval) {
    if (reportId) {
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { metadata: true },
      });
      const { rootMetadata, qualityCheckMetadata, governance } = readGovernanceState(
        book?.metadata
      );
      const nextReports = governance.reports.map((report) =>
        report.id === reportId
          ? {
              ...report,
              replayTaskId: taskId,
              replayTaskStatus: "failed",
            }
          : report
      );
      const targetSampleSetId = nextReports.find((report) => report.id === reportId)?.sampleSetId;
      const nextSampleSets = governance.sampleSets.map((sampleSet) =>
        sampleSet.id === targetSampleSetId
          ? {
              ...sampleSet,
              latestReplayTaskId: taskId,
            }
          : sampleSet
      );

      await prisma.book.update({
        where: { id: bookId },
        data: {
          metadata: JSON.parse(
            JSON.stringify({
              ...rootMetadata,
              qualityCheck: {
                ...qualityCheckMetadata,
                deepGateThresholdGovernance: {
                  reports: nextReports,
                  releases: governance.releases,
                  sampleSets: nextSampleSets,
                  activeVersion: governance.activeVersion,
                  activeReleaseId: governance.activeReleaseId,
                  updatedAt: new Date().toISOString(),
                  lastEvaluatedReportId: governance.lastEvaluatedReportId,
                },
              },
            })
          ),
        },
      });
    }
    return;
  }

  if (isQualitySignalSync) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { metadata: true, status: true },
    });
    const rootMetadata = jsonObject(book?.metadata);
    const qualityCheck =
      rootMetadata.qualityCheck &&
      typeof rootMetadata.qualityCheck === "object" &&
      !Array.isArray(rootMetadata.qualityCheck)
        ? (rootMetadata.qualityCheck as Record<string, unknown>)
        : {};

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: book?.status || fallbackStatus,
        metadata: JSON.parse(
          JSON.stringify({
            ...rootMetadata,
            qualityCheck: {
              ...qualityCheck,
              signalSupply: {
                ...(qualityCheck.signalSupply &&
                typeof qualityCheck.signalSupply === "object" &&
                !Array.isArray(qualityCheck.signalSupply)
                  ? qualityCheck.signalSupply
                  : {}),
                taskId,
                status: "failed",
                failedAt: new Date().toISOString(),
                lastError: message,
              },
            },
          })
        ),
      },
    });
    return;
  }

  if (isFinalAssembly || isManualReviewSync) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { metadata: true, status: true },
    });
    const rootMetadata = jsonObject(book?.metadata);
    const key = isFinalAssembly ? "finalAssembly" : "manualReviewSync";
    const previousBookStatus =
      typeof taskMetadata.previousBookStatus === "string"
        ? taskMetadata.previousBookStatus
        : book?.status || fallbackStatus;
    const currentSection =
      rootMetadata[key] && typeof rootMetadata[key] === "object" && !Array.isArray(rootMetadata[key])
        ? (rootMetadata[key] as Record<string, unknown>)
        : {};

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: previousBookStatus,
        metadata: JSON.parse(
          JSON.stringify({
            ...rootMetadata,
            [key]: {
              ...currentSection,
              taskId,
              status: "failed",
              failedAt: new Date().toISOString(),
              lastError: message,
            },
          })
        ),
      },
    });
    return;
  }

  if (isUploadCompensation) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { metadata: true },
    });
    const activeCompensationTaskId = readAutoPipelineCompensationTaskId(book?.metadata);

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: fallbackStatus,
        ...(activeCompensationTaskId === taskId
          ? {
              metadata: buildAutoPipelineBookMetadata({
                metadata: book?.metadata,
                compensation: {
                  taskId,
                  status: "failed",
                  failedAt: new Date().toISOString(),
                  lastError: message,
                },
              }),
            }
          : {}),
      },
    });
    return;
  }

  await prisma.book.update({
    where: { id: bookId },
    data: { status: fallbackStatus },
  });
}

async function handleRetryState(
  job: Bull.Job<unknown>,
  taskId: string,
  errorMessage: string
): Promise<void> {
  const maxAttempts = job.opts.attempts ?? 1;
  const currentAttempt = job.attemptsMade + 1;
  const remaining = Math.max(maxAttempts - currentAttempt, 0);
  const retryDelayMs = extractBackoffDelay(job);

  const taskData = await mergeTaskData(taskId, {
    message: `任务执行失败，准备重试（剩余 ${remaining} 次）`,
    metadata: {
      retryAttempt: currentAttempt,
      retryRemaining: remaining,
      retryDelayMs,
      lastError: errorMessage,
      queueJobId: String(job.id),
      heartbeatAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "processing",
      errorMessage: null,
      taskData,
    },
  });
}

export async function handleWorkerFailure(params: {
  taskType: QueueTaskType;
  job: Bull.Job<unknown>;
  taskId: string;
  bookId: string;
  fallbackStatus: BookFallbackStatus;
  error: unknown;
  payload: Record<string, unknown>;
  addDeadLetter: (params: DeadLetterInput) => Promise<void>;
}): Promise<void> {
  const { taskType, job, taskId, bookId, fallbackStatus, error, payload, addDeadLetter } = params;
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const maxAttempts = job.opts.attempts ?? 1;
  const currentAttempt = job.attemptsMade + 1;
  const isLastAttempt = currentAttempt >= maxAttempts;

  if (!isLastAttempt) {
    await handleRetryState(job, taskId, errorMessage);
    return;
  }

  await addDeadLetter({
    taskId,
    taskType,
    bookId,
    queueJobId: String(job.id),
    errorMessage,
    attempt: currentAttempt,
    maxAttempts,
    payload,
  });

  await markTaskFailed(taskId, bookId, fallbackStatus, errorMessage, {
    retryAttempt: currentAttempt,
    retryMaxAttempts: maxAttempts,
    queueJobId: String(job.id),
    lastError: errorMessage,
    pushedToDeadLetter: true,
  });
}

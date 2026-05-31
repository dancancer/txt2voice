import prisma, { Prisma } from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueQualityCheckJob } from "@/lib/task-queue";
import { rejectManualReviewReprocessingItem, rejectQcRetryReprocessingItems } from "@/lib/audio-generation/runner/reprocessing";
import { toJsonQcRetryDispatchPolicy } from "@/lib/audio-generation/runner/task-context";
import type {
  FollowupQcResult,
  QcRetryDispatchPolicy,
} from "@/lib/audio-generation/runner/types";

const markQcTaskFailed = async ({
  taskId,
  audioTaskId,
  message,
  failedMessage,
}: {
  taskId: string;
  audioTaskId: string;
  message: string;
  failedMessage: string;
}): Promise<string> => {
  const failedTaskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      queueError: failedMessage,
      triggeredByTaskId: audioTaskId,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: failedMessage,
      taskData: failedTaskData,
    },
  });

  return failedMessage;
};

export const enqueueManualReviewFollowupQualityCheck = async ({
  bookId,
  audioTaskId,
  manualReviewItemId,
  audioFileIds,
}: {
  bookId: string;
  audioTaskId: string;
  manualReviewItemId: string;
  audioFileIds: string[];
}): Promise<FollowupQcResult> => {
  const qcTask = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "QUALITY_CHECK",
      status: "processing",
      progress: 0,
      totalItems: audioFileIds.length,
      taskData: {
        message: "人工复核重生后自动触发 Fast/Deep Gate 质检",
        metadata: {
          source: "manual_review",
          manualReviewItemId,
          type: "batch",
          audioFileIds,
          triggeredByTaskId: audioTaskId,
          totalItems: audioFileIds.length,
        },
      },
    },
  });

  try {
    await enqueueQualityCheckJob({
      taskId: qcTask.id,
      bookId,
      type: "batch",
      audioFileIds,
    });

    return {
      taskId: qcTask.id,
      status: "processing",
    };
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "人工复核后置质检入队失败";
    await markQcTaskFailed({
      taskId: qcTask.id,
      audioTaskId,
      message: "人工复核后置质检入队失败",
      failedMessage: message,
    });

    await rejectManualReviewReprocessingItem({
      bookId,
      manualReviewItemId,
      resolutionType: "hard_failure",
      note: `auto_reject:后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

export const enqueueManualReviewBatchFollowupQualityCheck = async ({
  bookId,
  audioTaskId,
  reviewItemIds,
  audioFileIds,
}: {
  bookId: string;
  audioTaskId: string;
  reviewItemIds: string[];
  audioFileIds: string[];
}): Promise<FollowupQcResult> => {
  const qcTask = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "QUALITY_CHECK",
      status: "processing",
      progress: 0,
      totalItems: audioFileIds.length,
      taskData: {
        message: "人工复核批量重生后自动触发 Fast/Deep Gate 质检",
        metadata: {
          source: "manual_review_batch",
          type: "batch",
          audioFileIds,
          retryReviewItemIds: reviewItemIds,
          triggeredByTaskId: audioTaskId,
          autoCreatePendingOnReject: false,
          totalItems: audioFileIds.length,
        },
      },
    },
  });

  try {
    await enqueueQualityCheckJob({
      taskId: qcTask.id,
      bookId,
      type: "batch",
      audioFileIds,
    });

    return {
      taskId: qcTask.id,
      status: "processing",
    };
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "人工复核批量后置质检入队失败";
    await markQcTaskFailed({
      taskId: qcTask.id,
      audioTaskId,
      message: "人工复核批量后置质检入队失败",
      failedMessage: message,
    });

    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:manual_review_batch后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

export const enqueueQcRetryFollowupQualityCheck = async ({
  bookId,
  audioTaskId,
  reviewItemIds,
  audioFileIds,
  dispatchPolicy,
}: {
  bookId: string;
  audioTaskId: string;
  reviewItemIds: string[];
  audioFileIds: string[];
  dispatchPolicy: QcRetryDispatchPolicy;
}): Promise<FollowupQcResult> => {
  const dispatchPolicyMetadata = toJsonQcRetryDispatchPolicy(dispatchPolicy) as Record<
    string,
    Prisma.InputJsonValue
  >;

  const qcTask = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "QUALITY_CHECK",
      status: "processing",
      progress: 0,
      totalItems: audioFileIds.length,
      taskData: {
        message: "质量返工后自动触发 Fast/Deep Gate 质检",
        metadata: {
          source: "qc_retry",
          type: "batch",
          audioFileIds,
          retryReviewItemIds: reviewItemIds,
          triggeredByTaskId: audioTaskId,
          autoCreatePendingOnReject: dispatchPolicy.autoCreatePendingOnReject,
          maxAutoRejectedCount: dispatchPolicy.maxAutoRejectedCount,
          issueTypePolicies: dispatchPolicyMetadata.issueTypePolicies || {},
          dispatchPolicy: dispatchPolicyMetadata,
          totalItems: audioFileIds.length,
        },
      },
    },
  });

  try {
    await enqueueQualityCheckJob({
      taskId: qcTask.id,
      bookId,
      type: "batch",
      audioFileIds,
    });

    return {
      taskId: qcTask.id,
      status: "processing",
    };
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "质量返工后置质检入队失败";
    await markQcTaskFailed({
      taskId: qcTask.id,
      audioTaskId,
      message: "质量返工后置质检入队失败",
      failedMessage: message,
    });

    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:qc_retry后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

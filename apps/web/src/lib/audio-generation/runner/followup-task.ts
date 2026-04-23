import prisma from "@/lib/prisma";
import {
  enqueueManualReviewBatchFollowupQualityCheck,
  enqueueManualReviewFollowupQualityCheck,
  enqueueQcRetryFollowupQualityCheck,
} from "@/lib/audio-generation/runner/followup-quality-check";
import type {
  ManualReviewBatchTaskContext,
  ManualReviewTaskContext,
  QcRetryTaskContext,
} from "@/lib/audio-generation/runner/types";
import { mergeTaskData } from "@/lib/processing-task-utils";

export const attachManualReviewFollowup = async (params: {
  bookId: string;
  taskId: string;
  audioFileIds: string[];
  manualReviewContext: ManualReviewTaskContext;
}) => {
  const followupQc = await enqueueManualReviewFollowupQualityCheck({
    bookId: params.bookId,
    audioTaskId: params.taskId,
    manualReviewItemId: params.manualReviewContext.manualReviewItemId,
    audioFileIds: params.audioFileIds,
  });

  const taskDataWithFollowup = await mergeTaskData(params.taskId, {
    metadata: {
      manualReviewFollowup: {
        qualityTaskId: followupQc.taskId,
        qualityTaskStatus: followupQc.status,
        qualityTaskError: followupQc.error || null,
      },
    },
  });

  await prisma.processingTask.update({
    where: { id: params.taskId },
    data: {
      taskData: taskDataWithFollowup,
    },
  });
};

export const attachQcRetryFollowup = async (params: {
  bookId: string;
  taskId: string;
  audioFileIds: string[];
  qcRetryContext: QcRetryTaskContext;
}) => {
  const followupQc = await enqueueQcRetryFollowupQualityCheck({
    bookId: params.bookId,
    audioTaskId: params.taskId,
    reviewItemIds: params.qcRetryContext.selectedReviewItemIds,
    audioFileIds: params.audioFileIds,
    dispatchPolicy: params.qcRetryContext.dispatchPolicy,
  });

  const taskDataWithFollowup = await mergeTaskData(params.taskId, {
    metadata: {
      qcRetryFollowup: {
        qualityTaskId: followupQc.taskId,
        qualityTaskStatus: followupQc.status,
        qualityTaskError: followupQc.error || null,
        targetReviewItemCount: params.qcRetryContext.selectedReviewItemIds.length,
      },
    },
  });

  await prisma.processingTask.update({
    where: { id: params.taskId },
    data: {
      taskData: taskDataWithFollowup,
    },
  });
};

export const attachManualReviewBatchFollowup = async (params: {
  bookId: string;
  taskId: string;
  audioFileIds: string[];
  manualReviewBatchContext: ManualReviewBatchTaskContext;
}) => {
  const followupQc = await enqueueManualReviewBatchFollowupQualityCheck({
    bookId: params.bookId,
    audioTaskId: params.taskId,
    reviewItemIds: params.manualReviewBatchContext.selectedReviewItemIds,
    audioFileIds: params.audioFileIds,
  });

  const taskDataWithFollowup = await mergeTaskData(params.taskId, {
    metadata: {
      manualReviewBatchFollowup: {
        qualityTaskId: followupQc.taskId,
        qualityTaskStatus: followupQc.status,
        qualityTaskError: followupQc.error || null,
        targetReviewItemCount: params.manualReviewBatchContext.selectedReviewItemIds.length,
      },
    },
  });

  await prisma.processingTask.update({
    where: { id: params.taskId },
    data: {
      taskData: taskDataWithFollowup,
    },
  });
};

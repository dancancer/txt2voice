import prisma from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";
import {
  attachManualReviewBatchFollowup,
  attachManualReviewFollowup,
  attachQcRetryFollowup,
} from "@/lib/audio-generation/runner/followup-task";
import {
  collectFailedBatchSentenceIds,
  rejectManualReviewReprocessingItem,
  rejectQcRetryReprocessingItems,
  rejectQcRetryReprocessingItemsBySentenceIds,
} from "@/lib/audio-generation/runner/reprocessing";
import type {
  AudioGenerationTaskType,
  ManualReviewBatchTaskContext,
  ManualReviewTaskContext,
  QcRetryTaskContext,
} from "@/lib/audio-generation/runner/types";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";

type AudioGenerationResultLike = {
  success: boolean;
  audioFileId?: string;
  duration?: number;
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

interface FinalizeAudioTaskParams {
  bookId: string;
  taskId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  results: AudioGenerationResultLike[];
  successCount: number;
  failedCount: number;
  totalAudioFiles: number;
  generatedDuration: number;
  taskData: unknown;
  bookMetadata: unknown;
  manualReviewContext: ManualReviewTaskContext | null;
  manualReviewBatchContext: ManualReviewBatchTaskContext | null;
  qcRetryContext: QcRetryTaskContext | null;
}

const collectGeneratedAudioFileIds = (results: AudioGenerationResultLike[]) => {
  return Array.from(
    new Set(
      results
        .filter((result): result is AudioGenerationResultLike & { audioFileId: string } => {
          return result.success && typeof result.audioFileId === "string";
        })
        .map((result) => result.audioFileId)
    )
  );
};

const rejectAllReprocessingContexts = async (params: {
  bookId: string;
  taskId: string;
  manualReviewContext: ManualReviewTaskContext | null;
  manualReviewBatchContext: ManualReviewBatchTaskContext | null;
  qcRetryContext: QcRetryTaskContext | null;
}) => {
  const {
    bookId,
    taskId,
    manualReviewContext,
    manualReviewBatchContext,
    qcRetryContext,
  } = params;

  if (manualReviewContext) {
    await rejectManualReviewReprocessingItem({
      bookId,
      manualReviewItemId: manualReviewContext.manualReviewItemId,
      resolutionType: "hard_failure",
      note: `auto_reject:音频重生失败:task=${taskId}`,
    });
  }

  if (qcRetryContext) {
    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds: qcRetryContext.selectedReviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:qc_retry音频返工失败:task=${taskId}`,
    });
  }

  if (manualReviewBatchContext) {
    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:manual_review_batch音频重生失败:task=${taskId}`,
    });
  }
};

const rejectMissingAudioReferenceContexts = async (params: {
  bookId: string;
  taskId: string;
  manualReviewContext: ManualReviewTaskContext | null;
  manualReviewBatchContext: ManualReviewBatchTaskContext | null;
  qcRetryContext: QcRetryTaskContext | null;
}) => {
  const {
    bookId,
    taskId,
    manualReviewContext,
    manualReviewBatchContext,
    qcRetryContext,
  } = params;

  if (manualReviewContext) {
    await rejectManualReviewReprocessingItem({
      bookId,
      manualReviewItemId: manualReviewContext.manualReviewItemId,
      resolutionType: "hard_failure",
      note: `auto_reject:重生无有效音频引用:task=${taskId}`,
    });
  }
  if (qcRetryContext) {
    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds: qcRetryContext.selectedReviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:qc_retry重生无有效音频引用:task=${taskId}`,
    });
  }
  if (manualReviewBatchContext) {
    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
      resolutionType: "hard_failure",
      note: `auto_reject:manual_review_batch重生无有效音频引用:task=${taskId}`,
    });
  }
};

const rejectPartialBatchFailures = async (params: {
  bookId: string;
  taskId: string;
  type: AudioGenerationTaskType;
  scriptSentenceIds?: string[];
  results: AudioGenerationResultLike[];
  manualReviewBatchContext: ManualReviewBatchTaskContext | null;
  qcRetryContext: QcRetryTaskContext | null;
}) => {
  const {
    bookId,
    taskId,
    type,
    scriptSentenceIds,
    results,
    manualReviewBatchContext,
    qcRetryContext,
  } = params;
  const failedBatchSentenceIds = collectFailedBatchSentenceIds({
    type,
    scriptSentenceIds,
    results,
  });

  if (failedBatchSentenceIds.length === 0) {
    return;
  }

  if (qcRetryContext) {
    await rejectQcRetryReprocessingItemsBySentenceIds({
      bookId,
      reviewItemIds: qcRetryContext.selectedReviewItemIds,
      sentenceIds: failedBatchSentenceIds,
      resolutionType: "hard_failure",
      note: `auto_reject:qc_retry部分返工失败:task=${taskId};failedSentences=${failedBatchSentenceIds.length}`,
    });
  }

  if (manualReviewBatchContext) {
    await rejectQcRetryReprocessingItemsBySentenceIds({
      bookId,
      reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
      sentenceIds: failedBatchSentenceIds,
      resolutionType: "hard_failure",
      note: `auto_reject:manual_review_batch部分重生失败:task=${taskId};failedSentences=${failedBatchSentenceIds.length}`,
    });
  }
};

export const finalizeAudioGenerationTask = async (
  params: FinalizeAudioTaskParams
) => {
  const {
    bookId,
    taskId,
    type,
    scriptSentenceIds,
    results,
    successCount,
    failedCount,
    totalAudioFiles,
    generatedDuration,
    taskData,
    bookMetadata,
    manualReviewContext,
    manualReviewBatchContext,
    qcRetryContext,
  } = params;

  if (successCount === 0) {
    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "音频生成失败：全部句子生成失败",
        taskData: toInputJsonValue(taskData),
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "script_generated",
        metadata: {
          ...jsonObject(bookMetadata as any),
          audioGenerationFailedAt: new Date().toISOString(),
          audioGenerationFailedCount: failedCount,
        },
      },
    });

    await rejectAllReprocessingContexts({
      bookId,
      taskId,
      manualReviewContext,
      manualReviewBatchContext,
      qcRetryContext,
    });
    return;
  }

  const bookStatus = failedCount === 0 ? "completed" : "completed_with_errors";

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
        status: "completed",
        completedAt: new Date(),
        taskData: toInputJsonValue(taskData),
      },
    });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: bookStatus,
      metadata: {
        ...jsonObject(bookMetadata as any),
        audioGenerationCompletedAt: new Date().toISOString(),
        audioGenerationStatus: bookStatus,
        totalAudioFiles,
        totalAudioDuration: generatedDuration,
        lastAudioFailureCount: failedCount,
      },
    },
  });

  if (!manualReviewContext && !manualReviewBatchContext && !qcRetryContext) {
    return;
  }

  await rejectPartialBatchFailures({
    bookId,
    taskId,
    type,
    scriptSentenceIds,
    results,
    manualReviewBatchContext,
    qcRetryContext,
  });

  const generatedAudioFileIds = collectGeneratedAudioFileIds(results);
  if (generatedAudioFileIds.length === 0) {
    await rejectMissingAudioReferenceContexts({
      bookId,
      taskId,
      manualReviewContext,
      manualReviewBatchContext,
      qcRetryContext,
    });
    return;
  }

  if (manualReviewContext) {
    await attachManualReviewFollowup({
      bookId,
      taskId,
      audioFileIds: generatedAudioFileIds,
      manualReviewContext,
    });
  }

  if (qcRetryContext) {
    await attachQcRetryFollowup({
      bookId,
      taskId,
      audioFileIds: generatedAudioFileIds,
      qcRetryContext,
    });
  }

  if (manualReviewBatchContext) {
    await attachManualReviewBatchFollowup({
      bookId,
      taskId,
      audioFileIds: generatedAudioFileIds,
      manualReviewBatchContext,
    });
  }
};

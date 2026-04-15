// 一旦我被更新，请更新我的开头注释
// input: 音频任务参数
// output: 音频任务执行器导出
// pos: 任务执行入口
import { getAudioGenerator } from "@/lib/audio-generator";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import prisma from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import {
  enqueueManualReviewBatchFollowupQualityCheck,
  enqueueManualReviewFollowupQualityCheck,
  enqueueQcRetryFollowupQualityCheck,
} from "@/lib/audio-generation/runner/followup-quality-check";
import {
  collectFailedBatchSentenceIds,
  rejectManualReviewReprocessingItem,
  rejectQcRetryReprocessingItems,
  rejectQcRetryReprocessingItemsBySentenceIds,
} from "@/lib/audio-generation/runner/reprocessing";
import {
  extractManualReviewBatchTaskContext,
  extractManualReviewTaskContext,
  extractQcRetryTaskContext,
} from "@/lib/audio-generation/runner/task-context";
import {
  extractRouterDecisionField,
  summarizeAudioChildJobs,
  summarizeRouterDecisions,
} from "@/lib/audio-generation/runner/summaries";
import { executeAudioGeneration } from "@/lib/audio-generation/runner/execute";
import type {
  AudioGenerationRunParams,
  AudioGenerationTaskType,
} from "@/lib/audio-generation/runner/types";

export type { AudioGenerationTaskType } from "@/lib/audio-generation/runner/types";

/**
 * 执行音频生成任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runAudioGenerationTask({
  bookId,
  taskId,
  type,
  chapterId,
  scriptSentenceIds,
  voiceProfileId,
  autoMerge = false,
  options = {},
}: AudioGenerationRunParams): Promise<void> {
  const audioGenerator = getAudioGenerator();
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      taskData: true,
    },
  });
  const manualReviewContext = extractManualReviewTaskContext(taskSnapshot?.taskData);
  const manualReviewBatchContext = extractManualReviewBatchTaskContext(
    taskSnapshot?.taskData
  );
  const qcRetryContext = extractQcRetryTaskContext(taskSnapshot?.taskData);

  await updateTaskProgress(taskId, 10, "准备生成音频");

  const startMessage =
    type === "book"
      ? "开始生成整书音频"
      : type === "chapter"
        ? "开始生成章节音频"
        : type === "batch"
          ? "开始批量生成音频"
          : "开始生成单个音频";
  await updateTaskProgress(taskId, 20, startMessage);

  const { results, totalSentences, audioReliability } = await executeAudioGeneration({
    audioGenerator,
    bookId,
    type,
    chapterId,
    scriptSentenceIds,
    voiceProfileId,
    options,
  });

  await updateTaskProgress(taskId, 80, "统计生成结果");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const routerDecisionSummary = summarizeRouterDecisions(results);
  const audioChildJobMetrics = summarizeAudioChildJobs(
    results,
    typeof options.provider === "string" ? options.provider : null
  );

  let mergeResult = null;
  if (autoMerge && successCount > 0) {
    await updateTaskProgress(taskId, 85, "正在合并音频文件");

    const { getAudioMerger } = await import("@/lib/audio-merger");
    const audioMerger = getAudioMerger();

    if (type === "chapter" && chapterId) {
      mergeResult = await audioMerger.mergeChapterAudio(bookId, chapterId);
    } else if (type === "book") {
      mergeResult = await audioMerger.mergeBookAudio(bookId);
    }

    if (mergeResult && !mergeResult.success) {
      console.warn("音频合并失败:", mergeResult.error);
    }
  }

  const [book, totalAudioFiles] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        metadata: true,
      },
    }),
    prisma.audioFile.count({
      where: { bookId },
    }),
  ]);

  await updateTaskProgress(taskId, 100, "音频生成完成");

  const message = `音频生成完成，成功 ${successCount} 个，失败 ${failedCount} 个${mergeResult?.success ? "，已合并音频" : ""}`;

  const taskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      type,
      chapterId,
      voiceProfileId,
      provider: options.provider || null,
      routerPolicyVersion: options.routerPolicyVersion || null,
      enableRouterDebug: options.enableRouterDebug === true,
      audioReliability,
      audioChildJobMetrics,
      totalSentences,
      successCount,
      failedCount,
      routerDecisionSummary,
      autoMerge,
      mergeResult: mergeResult
        ? {
            success: mergeResult.success,
            fileName: mergeResult.fileName,
            fileSize: mergeResult.fileSize,
            duration: mergeResult.duration,
          }
        : null,
      results: results.map((r) => ({
        success: r.success,
        error: r.error,
        duration: r.duration,
        audioFileId: typeof r.audioFileId === "string" ? r.audioFileId : null,
        selectedEngine: extractRouterDecisionField(r.metadata, "selectedEngine"),
        selectedSource: extractRouterDecisionField(r.metadata, "selectedSource"),
      })),
    },
  });

  const generatedDuration = Number(
    results.reduce((sum, result) => sum + (result.duration || 0), 0).toFixed(2)
  );

  if (successCount === 0) {
    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "音频生成失败：全部句子生成失败",
        taskData,
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: "script_generated",
        metadata: {
          ...jsonObject(book?.metadata),
          audioGenerationFailedAt: new Date().toISOString(),
          audioGenerationFailedCount: failedCount,
        },
      },
    });

    if (manualReviewContext) {
      await rejectManualReviewReprocessingItem({
        bookId,
        manualReviewItemId: manualReviewContext.manualReviewItemId,
        resolutionType: "regenerate_failed",
        note: `auto_reject:音频重生失败:task=${taskId}`,
      });
    }

    if (qcRetryContext) {
      await rejectQcRetryReprocessingItems({
        bookId,
        reviewItemIds: qcRetryContext.selectedReviewItemIds,
        resolutionType: "batch_regenerate_failed",
        note: `auto_reject:qc_retry音频返工失败:task=${taskId}`,
      });
    }

    if (manualReviewBatchContext) {
      await rejectQcRetryReprocessingItems({
        bookId,
        reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
        resolutionType: "batch_regenerate_failed",
        note: `auto_reject:manual_review_batch音频重生失败:task=${taskId}`,
      });
    }
    return;
  }

  const bookStatus = failedCount === 0 ? "completed" : "completed_with_errors";

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      completedAt: new Date(),
      taskData,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: bookStatus,
      metadata: {
        ...jsonObject(book?.metadata),
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

  const failedBatchSentenceIds = collectFailedBatchSentenceIds({
    type,
    scriptSentenceIds,
    results,
  });

  if (failedBatchSentenceIds.length > 0) {
    if (qcRetryContext) {
      await rejectQcRetryReprocessingItemsBySentenceIds({
        bookId,
        reviewItemIds: qcRetryContext.selectedReviewItemIds,
        sentenceIds: failedBatchSentenceIds,
        resolutionType: "batch_regenerate_failed",
        note: `auto_reject:qc_retry部分返工失败:task=${taskId};failedSentences=${failedBatchSentenceIds.length}`,
      });
    }

    if (manualReviewBatchContext) {
      await rejectQcRetryReprocessingItemsBySentenceIds({
        bookId,
        reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
        sentenceIds: failedBatchSentenceIds,
        resolutionType: "batch_regenerate_failed",
        note: `auto_reject:manual_review_batch部分重生失败:task=${taskId};failedSentences=${failedBatchSentenceIds.length}`,
      });
    }
  }

  const generatedAudioFileIds = Array.from(
    new Set(
      results
        .filter((result) => result.success && typeof result.audioFileId === "string")
      .map((result) => result.audioFileId as string)
    )
  );

  if (generatedAudioFileIds.length === 0) {
    if (manualReviewContext) {
      await rejectManualReviewReprocessingItem({
        bookId,
        manualReviewItemId: manualReviewContext.manualReviewItemId,
        resolutionType: "regenerate_missing_audio_ref",
        note: `auto_reject:重生无有效音频引用:task=${taskId}`,
      });
    }
    if (qcRetryContext) {
      await rejectQcRetryReprocessingItems({
        bookId,
        reviewItemIds: qcRetryContext.selectedReviewItemIds,
        resolutionType: "batch_regenerate_missing_audio_ref",
        note: `auto_reject:qc_retry重生无有效音频引用:task=${taskId}`,
      });
    }
    if (manualReviewBatchContext) {
      await rejectQcRetryReprocessingItems({
        bookId,
        reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
        resolutionType: "batch_regenerate_missing_audio_ref",
        note: `auto_reject:manual_review_batch重生无有效音频引用:task=${taskId}`,
      });
    }
    return;
  }

  if (manualReviewContext) {
    const followupQc = await enqueueManualReviewFollowupQualityCheck({
      bookId,
      audioTaskId: taskId,
      manualReviewItemId: manualReviewContext.manualReviewItemId,
      audioFileIds: generatedAudioFileIds,
    });

    const taskDataWithFollowup = await mergeTaskData(taskId, {
      metadata: {
        manualReviewFollowup: {
          qualityTaskId: followupQc.taskId,
          qualityTaskStatus: followupQc.status,
          qualityTaskError: followupQc.error || null,
        },
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        taskData: taskDataWithFollowup,
      },
    });
  }

  if (qcRetryContext) {
    const followupQc = await enqueueQcRetryFollowupQualityCheck({
      bookId,
      audioTaskId: taskId,
      reviewItemIds: qcRetryContext.selectedReviewItemIds,
      audioFileIds: generatedAudioFileIds,
      dispatchPolicy: qcRetryContext.dispatchPolicy,
    });

    const taskDataWithFollowup = await mergeTaskData(taskId, {
      metadata: {
        qcRetryFollowup: {
          qualityTaskId: followupQc.taskId,
          qualityTaskStatus: followupQc.status,
          qualityTaskError: followupQc.error || null,
          targetReviewItemCount: qcRetryContext.selectedReviewItemIds.length,
        },
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        taskData: taskDataWithFollowup,
      },
    });
  }

  if (manualReviewBatchContext) {
    const followupQc = await enqueueManualReviewBatchFollowupQualityCheck({
      bookId,
      audioTaskId: taskId,
      reviewItemIds: manualReviewBatchContext.selectedReviewItemIds,
      audioFileIds: generatedAudioFileIds,
    });

    const taskDataWithFollowup = await mergeTaskData(taskId, {
      metadata: {
        manualReviewBatchFollowup: {
          qualityTaskId: followupQc.taskId,
          qualityTaskStatus: followupQc.status,
          qualityTaskError: followupQc.error || null,
          targetReviewItemCount: manualReviewBatchContext.selectedReviewItemIds.length,
        },
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        taskData: taskDataWithFollowup,
      },
    });
  }
}

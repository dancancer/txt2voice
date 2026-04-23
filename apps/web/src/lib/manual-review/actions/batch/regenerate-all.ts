import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  cancelProcessingTaskJob,
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type {
  RegenerateAllPendingManualReviewInput,
  RegenerateAllPendingManualReviewResult,
} from "@/lib/manual-review/types";
import {
  buildAllPendingRegenerateNote,
  MANUAL_REVIEW_INCLUDE,
  toUniqueValues,
} from "@/lib/manual-review/utils";
import {
  ensureNoActiveAudioTask,
  ensureNoActiveScriptTask,
  handleTaskEnqueueFailure,
  markReprocessingReviewItems,
  markTaskRolledBack,
  resetPendingReviewItemState,
} from "@/lib/manual-review/actions/shared";

export const regenerateAllPendingManualReviewItems = async ({
  bookId,
}: RegenerateAllPendingManualReviewInput): Promise<RegenerateAllPendingManualReviewResult> => {
  const rows = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      status: "pending",
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (rows.length === 0) {
    throw new ValidationError("当前没有待复核项可重生");
  }

  const scriptItems = rows.filter(
    (item) => item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
  );
  const audioItems = rows.filter(
    (item) => item.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE
  );

  const missingScriptSegmentIds = scriptItems
    .filter((item) => !item.segmentId)
    .map((item) => item.id);
  if (missingScriptSegmentIds.length > 0) {
    throw new ValidationError(
      `全量重生失败：以下脚本复核项缺少 segmentId：${missingScriptSegmentIds.join(", ")}`
    );
  }

  const missingAudioSentenceIds = audioItems
    .filter((item) => !item.sentenceId)
    .map((item) => item.id);
  if (missingAudioSentenceIds.length > 0) {
    throw new ValidationError(
      `全量重生失败：以下音频复核项缺少 sentenceId：${missingAudioSentenceIds.join(", ")}`
    );
  }

  const scriptSegmentIds = toUniqueValues(scriptItems.map((item) => item.segmentId));
  const scriptReviewItemIds = scriptItems.map((item) => item.id);
  const audioSentenceIds = toUniqueValues(audioItems.map((item) => item.sentenceId));
  const audioReviewItemIds = audioItems.map((item) => item.id);

  if (scriptSegmentIds.length > 0) await ensureNoActiveScriptTask(bookId);
  if (audioSentenceIds.length > 0) await ensureNoActiveAudioTask(bookId);

  let scriptTask = null;
  let audioTask = null;
  let processedCount = 0;
  const warnings: string[] = [];
  let scriptTaskId: string | null = null;
  let scriptStatusesMarked = false;

  if (scriptSegmentIds.length > 0) {
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "pending",
        progress: 0,
        totalItems: scriptSegmentIds.length,
        taskData: {
          message: "人工复核触发全部待复核台本重跑",
          metadata: {
            source: "manual_review_bulk_pending",
            type: "all_pending",
            segmentIds: scriptSegmentIds,
            selectedReviewItemIds: scriptReviewItemIds,
            regenerateSegments: true,
          },
        },
      },
    });

    try {
      await enqueueScriptGenerationJob({
        taskId: task.id,
        bookId,
        options: {},
        extraParams: {
          regenerateSegments: true,
          segmentIds: scriptSegmentIds,
        },
      });
    } catch (queueError) {
      await handleTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核全量台本重跑任务入队失败",
      });
      throw queueError;
    }

    scriptTaskId = task.id;
    scriptTask = {
      taskId: task.id,
      taskType: "SCRIPT_GENERATION" as const,
      status: "processing",
    };
  }

  if (audioSentenceIds.length > 0) {
    const isBatchAudio = audioSentenceIds.length > 1;
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "AUDIO_GENERATION",
        status: "pending",
        progress: 0,
        totalItems: audioSentenceIds.length,
        taskData: {
          message: "人工复核触发全部待复核音频重生",
          metadata: {
            source: "manual_review_bulk_pending",
            type: "all_pending",
            scriptSentenceIds: audioSentenceIds,
            selectedReviewItemIds: audioReviewItemIds,
            autoMerge: false,
            skipExisting: false,
            overwriteExisting: true,
          },
        },
      },
    });

    try {
      await enqueueAudioGenerationJob({
        taskId: task.id,
        bookId,
        type: isBatchAudio ? "batch" : "single",
        scriptSentenceIds: audioSentenceIds,
        voiceProfileId: undefined,
        autoMerge: false,
        options: {
          provider: undefined,
          skipExisting: false,
          overwriteExisting: true,
        },
      });
    } catch (queueError) {
      await handleTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核全量音频重生任务入队失败",
      });

      if (scriptTaskId) {
        const cancelResult = await cancelProcessingTaskJob(
          "SCRIPT_GENERATION",
          scriptTaskId
        );

        if (cancelResult.canceled) {
          await markTaskRolledBack({
            taskId: scriptTaskId,
            message: "人工复核全量台本重跑任务已回滚：音频任务入队失败",
          });
          if (scriptStatusesMarked) {
            await resetPendingReviewItemState(scriptReviewItemIds);
          }
          throw queueError;
        }

        if (!scriptStatusesMarked) {
          await prisma.book.update({
            where: { id: bookId },
            data: { status: "generating_script" },
          });
          await markReprocessingReviewItems({
            items: scriptItems,
            resolutionType: "bulk_regenerate_pending",
            resolutionNote: buildAllPendingRegenerateNote(scriptTaskId),
          });
          processedCount += scriptItems.length;
          scriptStatusesMarked = true;
        }

        warnings.push(
          "音频任务入队失败，但台本任务已经开始执行；音频复核项仍保持待复核。"
        );
        return {
          reviewItemCount: rows.length,
          processedCount,
          scriptTask,
          audioTask: null,
          warnings,
        };
      }

      throw queueError;
    }

    audioTask = {
      taskId: task.id,
      taskType: "AUDIO_GENERATION" as const,
      status: "processing",
    };
  }

  if (scriptTaskId && !scriptStatusesMarked) {
    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });
    await markReprocessingReviewItems({
      items: scriptItems,
      resolutionType: "bulk_regenerate_pending",
      resolutionNote: buildAllPendingRegenerateNote(scriptTaskId),
    });
    processedCount += scriptItems.length;
  }

  if (audioTask) {
    await markReprocessingReviewItems({
      items: audioItems,
      resolutionType: "bulk_regenerate_pending",
      resolutionNote: buildAllPendingRegenerateNote(audioTask.taskId),
    });
    processedCount += audioItems.length;
  }

  return {
    reviewItemCount: rows.length,
    processedCount,
    scriptTask,
    audioTask,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

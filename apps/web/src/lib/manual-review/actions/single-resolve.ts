import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type {
  ManualReviewResolveResult,
  ResolveManualReviewInput,
} from "@/lib/manual-review/types";
import {
  buildRegenerateNote,
  formatManualReviewItem,
  MANUAL_REVIEW_INCLUDE,
} from "@/lib/manual-review/utils";
import {
  ensureNoActiveAudioTask,
  ensureNoActiveScriptTask,
  handleTaskEnqueueFailure,
  resolveResolutionType,
  resolveUpdatedStatus,
} from "@/lib/manual-review/actions/shared";

export const resolveManualReviewItem = async ({
  bookId,
  itemId,
  payload,
}: ResolveManualReviewInput): Promise<ManualReviewResolveResult> => {
  const item = await prisma.manualReviewItem.findUnique({
    where: { id: itemId },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (!item || item.bookId !== bookId) {
    throw new ValidationError("复核项不存在");
  }
  if (item.status !== "pending") {
    throw new ValidationError("仅 pending 状态的复核项支持处理");
  }

  if (payload.action === "approve" || payload.action === "reject") {
    const updated = await prisma.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: resolveUpdatedStatus(payload.action),
        resolutionType: resolveResolutionType(payload.action),
        resolutionNote: payload.note || null,
        assignedTo: payload.assignedTo ?? item.assignedTo,
        resolvedAt: new Date(),
      },
      include: MANUAL_REVIEW_INCLUDE,
    });

    return {
      item: formatManualReviewItem(updated),
      retryTask: null,
    };
  }

  if (item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE) {
    if (!item.segmentId) {
      throw new ValidationError("当前脚本复核项缺少 segmentId，无法触发台本重跑");
    }

    await ensureNoActiveScriptTask(bookId);

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
        progress: 0,
        totalItems: 1,
        taskData: {
          message: "人工复核触发段落台本重跑",
          metadata: {
            source: "manual_review",
            manualReviewItemId: itemId,
            type: "segment",
            segmentIds: [item.segmentId],
            note: payload.note || null,
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
          segmentIds: [item.segmentId],
        },
      });
    } catch (queueError) {
      await handleTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核台本重跑任务入队失败",
      });
      throw queueError;
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });

    const updated = await prisma.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: "reprocessing",
        resolutionType: "retry_requested",
        resolutionNote: buildRegenerateNote(payload.note, task.id),
        assignedTo: payload.assignedTo ?? item.assignedTo,
        resolvedAt: null,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });

    return {
      item: formatManualReviewItem(updated),
      retryTask: {
        taskId: task.id,
        taskType: "SCRIPT_GENERATION",
        status: task.status,
      },
    };
  }

  if (!item.sentenceId) {
    throw new ValidationError("当前复核项缺少 sentenceId，无法触发重生");
  }

  await ensureNoActiveAudioTask(bookId);

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
      progress: 0,
      totalItems: 1,
      taskData: {
        message: "人工复核触发音频重生",
        metadata: {
          source: "manual_review",
          manualReviewItemId: itemId,
          type: "single",
          scriptSentenceIds: [item.sentenceId],
          voiceProfileId: payload.voiceProfileId || null,
          autoMerge: payload.autoMerge,
          preferredProvider: payload.preferredProvider || null,
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
      type: "single",
      scriptSentenceIds: [item.sentenceId],
      voiceProfileId: payload.voiceProfileId,
      autoMerge: payload.autoMerge,
      options: {
        preferredProvider: payload.preferredProvider,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
  } catch (queueError) {
    await handleTaskEnqueueFailure({
      taskId: task.id,
      queueError,
      message: "人工复核重生任务入队失败",
    });
    throw queueError;
  }

  const updated = await prisma.manualReviewItem.update({
    where: { id: itemId },
    data: {
      status: "reprocessing",
      resolutionType: "retry_requested",
      resolutionNote: buildRegenerateNote(payload.note, task.id),
      assignedTo: payload.assignedTo ?? item.assignedTo,
      resolvedAt: null,
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  return {
    item: formatManualReviewItem(updated),
    retryTask: {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: task.status,
    },
  };
};

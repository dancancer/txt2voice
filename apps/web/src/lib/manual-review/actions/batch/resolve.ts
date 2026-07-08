import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type {
  ManualReviewBatchResolveResult,
  ResolveManualReviewBatchInput,
} from "@/lib/manual-review/types";
import {
  buildBatchRegenerateNote,
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

export const resolveManualReviewItemsInBatch = async ({
  bookId,
  payload,
}: ResolveManualReviewBatchInput): Promise<ManualReviewBatchResolveResult> => {
  const rows = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      id: { in: payload.itemIds },
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const orderedItems = payload.itemIds
    .map((itemId) => rowMap.get(itemId))
    .filter((item): item is (typeof rows)[number] => Boolean(item));

  if (orderedItems.length !== payload.itemIds.length) {
    const missingItemIds = payload.itemIds.filter((itemId) => !rowMap.has(itemId));
    throw new ValidationError(`复核项不存在: ${missingItemIds.join(", ")}`);
  }

  const nonPendingItems = orderedItems.filter((item) => item.status !== "pending");
  if (nonPendingItems.length > 0) {
    throw new ValidationError("仅 pending 状态的复核项支持批量处理");
  }

  if (payload.action === "approve" || payload.action === "reject") {
    const updatedItems = [];
    for (const item of orderedItems) {
      const updated = await prisma.manualReviewItem.update({
        where: { id: item.id },
        data: {
          status: resolveUpdatedStatus(payload.action),
          resolutionType: resolveResolutionType(payload.action),
          resolutionNote: payload.note || null,
          assignedTo: payload.assignedTo ?? item.assignedTo,
          resolvedAt: new Date(),
        },
        include: MANUAL_REVIEW_INCLUDE,
      });
      updatedItems.push(formatManualReviewItem(updated));
    }

    return {
      action: payload.action,
      processedCount: updatedItems.length,
      items: updatedItems,
      retryTask: null,
    };
  }

  const scriptValidationItems = orderedItems.filter(
    (item) => item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
  );

  if (scriptValidationItems.length > 0) {
    if (scriptValidationItems.length !== orderedItems.length) {
      throw new ValidationError(
        "批量重生暂不支持同时包含脚本复核项和音频复核项，请分开处理"
      );
    }

    const segmentIds = Array.from(
      new Set(
        orderedItems
          .map((item) => item.segmentId)
          .filter((segmentId): segmentId is string => Boolean(segmentId))
      )
    );
    const missingSegmentItemIds = orderedItems
      .filter((item) => !item.segmentId)
      .map((item) => item.id);

    if (missingSegmentItemIds.length > 0) {
      throw new ValidationError(
        `批量台本重跑失败：以下复核项缺少 segmentId：${missingSegmentItemIds.join(", ")}`
      );
    }

    await ensureNoActiveScriptTask(bookId);

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
        progress: 0,
        totalItems: segmentIds.length,
        taskData: {
          message: "人工复核批量触发段落台本重跑",
          metadata: {
            source: "manual_review_batch",
            type: "batch",
            segmentIds,
            selectedReviewItemIds: orderedItems.map((item) => item.id),
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
          segmentIds,
        },
      });
    } catch (queueError) {
      await handleTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核批量台本重跑任务入队失败",
      });
      throw queueError;
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });

    const updatedItems = [];
    for (const item of orderedItems) {
      const updated = await prisma.manualReviewItem.update({
        where: { id: item.id },
        data: {
          status: "reprocessing",
          resolutionType: "retry_requested",
          resolutionNote: buildBatchRegenerateNote(payload.note, task.id),
          assignedTo: payload.assignedTo ?? item.assignedTo,
          resolvedAt: null,
        },
        include: MANUAL_REVIEW_INCLUDE,
      });
      updatedItems.push(formatManualReviewItem(updated));
    }

    return {
      action: payload.action,
      processedCount: updatedItems.length,
      items: updatedItems,
      retryTask: {
        taskId: task.id,
        taskType: "SCRIPT_GENERATION",
        status: task.status,
      },
    };
  }

  const scriptSentenceIds = Array.from(
    new Set(
      orderedItems
        .map((item) => item.sentenceId)
        .filter((sentenceId): sentenceId is string => Boolean(sentenceId))
    )
  );
  const missingSentenceItemIds = orderedItems
    .filter((item) => !item.sentenceId)
    .map((item) => item.id);

  if (missingSentenceItemIds.length > 0) {
    throw new ValidationError(
      `批量重生失败：以下复核项缺少 sentenceId：${missingSentenceItemIds.join(", ")}`
    );
  }

  await ensureNoActiveAudioTask(bookId);

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
      progress: 0,
      totalItems: scriptSentenceIds.length,
      taskData: {
        message: "人工复核批量重生任务已创建",
        metadata: {
          source: "manual_review_batch",
          type: "batch",
          scriptSentenceIds,
          selectedReviewItemIds: orderedItems.map((item) => item.id),
          voiceProfileId: payload.voiceProfileId || null,
          preferredProvider: payload.preferredProvider || null,
          autoMerge: payload.autoMerge,
          note: payload.note || null,
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
      type: "batch",
      scriptSentenceIds,
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
      message: "人工复核批量重生任务入队失败",
    });
    throw queueError;
  }

  const updatedItems = [];
  for (const item of orderedItems) {
    const updated = await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "reprocessing",
        resolutionType: "retry_requested",
        resolutionNote: buildBatchRegenerateNote(payload.note, task.id),
        assignedTo: payload.assignedTo ?? item.assignedTo,
        resolvedAt: null,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });
    updatedItems.push(formatManualReviewItem(updated));
  }

  return {
    action: payload.action,
    processedCount: updatedItems.length,
    items: updatedItems,
    retryTask: {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: task.status,
    },
  };
};

// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 音频任务执行结果
// pos: 任务执行器
import {
  getAudioGenerator,
} from "@/lib/audio-generator";
import type {
  AudioGenerationRequest,
  AudioGenerationOptions,
} from "@/lib/audio-generator";
import prisma, { Prisma } from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import { enqueueQualityCheckJob } from "@/lib/task-queue";

export type AudioGenerationTaskType = "single" | "batch" | "book" | "chapter";

export interface AudioGenerationRunParams {
  bookId: string;
  taskId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

interface ManualReviewTaskContext {
  manualReviewItemId: string;
}

interface ManualReviewBatchTaskContext {
  selectedReviewItemIds: string[];
}

interface QcRetryIssueTypePolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
}

interface QcRetryDispatchPolicy {
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number;
  issueTypePolicies: Record<string, QcRetryIssueTypePolicy>;
}

interface QcRetryTaskContext {
  selectedReviewItemIds: string[];
  dispatchPolicy: QcRetryDispatchPolicy;
}

const DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT = 2;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const asNonNegativeInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return undefined;
  }

  return Number(numeric);
};

const extractManualReviewTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): ManualReviewTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "manual_review") {
    return null;
  }

  const manualReviewItemId =
    typeof metadata.manualReviewItemId === "string"
      ? metadata.manualReviewItemId
      : null;

  if (!manualReviewItemId) {
    return null;
  }

  return {
    manualReviewItemId,
  };
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
};

const extractManualReviewBatchTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): ManualReviewBatchTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "manual_review_batch") {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata.selectedReviewItemIds);
  if (selectedReviewItemIds.length === 0) {
    return null;
  }

  return {
    selectedReviewItemIds,
  };
};

const parseQcRetryIssueTypePolicies = (
  value: unknown
): Record<string, QcRetryIssueTypePolicy> => {
  const policyRecord = asRecord(value);
  if (!policyRecord) {
    return {};
  }

  const issueTypePolicies: Record<string, QcRetryIssueTypePolicy> = {};

  for (const [rawIssueType, issuePolicyValue] of Object.entries(policyRecord)) {
    const issueType = rawIssueType.trim().toUpperCase();
    if (!issueType) {
      continue;
    }

    const issuePolicy = asRecord(issuePolicyValue);
    if (!issuePolicy) {
      continue;
    }

    const autoCreatePendingOnReject = asBoolean(issuePolicy.autoCreatePendingOnReject);
    const maxAutoRejectedCount = asNonNegativeInteger(issuePolicy.maxAutoRejectedCount);

    if (
      autoCreatePendingOnReject === undefined &&
      maxAutoRejectedCount === undefined
    ) {
      continue;
    }

    issueTypePolicies[issueType] = {
      ...(autoCreatePendingOnReject !== undefined
        ? {
            autoCreatePendingOnReject,
          }
        : {}),
      ...(maxAutoRejectedCount !== undefined
        ? {
            maxAutoRejectedCount,
          }
        : {}),
    };
  }

  return issueTypePolicies;
};

const toJsonQcRetryDispatchPolicy = (
  dispatchPolicy: QcRetryDispatchPolicy
): Prisma.InputJsonValue => {
  const issueTypePolicies: Record<string, Prisma.InputJsonValue> = {};
  for (const [issueType, issuePolicy] of Object.entries(dispatchPolicy.issueTypePolicies)) {
    const issuePolicyPayload: Record<string, Prisma.InputJsonValue> = {};
    if (issuePolicy.autoCreatePendingOnReject !== undefined) {
      issuePolicyPayload.autoCreatePendingOnReject =
        issuePolicy.autoCreatePendingOnReject;
    }
    if (issuePolicy.maxAutoRejectedCount !== undefined) {
      issuePolicyPayload.maxAutoRejectedCount = issuePolicy.maxAutoRejectedCount;
    }
    if (Object.keys(issuePolicyPayload).length > 0) {
      issueTypePolicies[issueType] = issuePolicyPayload;
    }
  }

  return {
    autoCreatePendingOnReject: dispatchPolicy.autoCreatePendingOnReject,
    maxAutoRejectedCount: dispatchPolicy.maxAutoRejectedCount,
    issueTypePolicies,
  };
};

const extractQcRetryTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): QcRetryTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "qc_retry") {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata.selectedReviewItemIds);
  if (selectedReviewItemIds.length === 0) {
    return null;
  }

  const policySource = asRecord(metadata.dispatchPolicy) || metadata;
  const dispatchPolicy: QcRetryDispatchPolicy = {
    autoCreatePendingOnReject:
      asBoolean(policySource.autoCreatePendingOnReject) ?? true,
    maxAutoRejectedCount:
      asNonNegativeInteger(policySource.maxAutoRejectedCount) ??
      DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT,
    issueTypePolicies: parseQcRetryIssueTypePolicies(policySource.issueTypePolicies),
  };

  return {
    selectedReviewItemIds,
    dispatchPolicy,
  };
};

const appendResolutionNote = (
  current: string | null | undefined,
  next: string
): string => {
  if (!current) {
    return next;
  }
  if (current.includes(next)) {
    return current;
  }
  return `${current}\n${next}`;
};

const rejectManualReviewReprocessingItem = async ({
  bookId,
  manualReviewItemId,
  resolutionType,
  note,
}: {
  bookId: string;
  manualReviewItemId: string;
  resolutionType: string;
  note: string;
}): Promise<boolean> => {
  const reprocessingItem = await prisma.manualReviewItem.findFirst({
    where: {
      id: manualReviewItemId,
      bookId,
      status: "reprocessing",
    },
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (!reprocessingItem) {
    return false;
  }

  await prisma.manualReviewItem.update({
    where: { id: reprocessingItem.id },
    data: {
      status: "rejected",
      resolutionType,
      resolutionNote: appendResolutionNote(reprocessingItem.resolutionNote, note),
      resolvedAt: new Date(),
    },
  });

  return true;
};

const rejectQcRetryReprocessingItems = async ({
  bookId,
  reviewItemIds,
  resolutionType,
  note,
}: {
  bookId: string;
  reviewItemIds: string[];
  resolutionType: string;
  note: string;
}): Promise<number> => {
  if (reviewItemIds.length === 0) {
    return 0;
  }

  const reprocessingItems = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      id: {
        in: reviewItemIds,
      },
      status: "reprocessing",
    },
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (reprocessingItems.length === 0) {
    return 0;
  }

  for (const item of reprocessingItems) {
    await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "rejected",
        resolutionType,
        resolutionNote: appendResolutionNote(item.resolutionNote, note),
        resolvedAt: new Date(),
      },
    });
  }

  return reprocessingItems.length;
};

const enqueueManualReviewFollowupQualityCheck = async ({
  bookId,
  audioTaskId,
  manualReviewItemId,
  audioFileIds,
}: {
  bookId: string;
  audioTaskId: string;
  manualReviewItemId: string;
  audioFileIds: string[];
}): Promise<{ taskId: string; status: "processing" | "failed"; error?: string }> => {
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
    const failedTaskData = await mergeTaskData(qcTask.id, {
      message: "人工复核后置质检入队失败",
      metadata: {
        queueError: message,
        triggeredByTaskId: audioTaskId,
      },
    });

    await prisma.processingTask.update({
      where: { id: qcTask.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    await rejectManualReviewReprocessingItem({
      bookId,
      manualReviewItemId,
      resolutionType: "regenerate_qc_enqueue_failed",
      note: `auto_reject:后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

const enqueueManualReviewBatchFollowupQualityCheck = async ({
  bookId,
  audioTaskId,
  reviewItemIds,
  audioFileIds,
}: {
  bookId: string;
  audioTaskId: string;
  reviewItemIds: string[];
  audioFileIds: string[];
}): Promise<{ taskId: string; status: "processing" | "failed"; error?: string }> => {
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
    const failedTaskData = await mergeTaskData(qcTask.id, {
      message: "人工复核批量后置质检入队失败",
      metadata: {
        queueError: message,
        triggeredByTaskId: audioTaskId,
      },
    });

    await prisma.processingTask.update({
      where: { id: qcTask.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds,
      resolutionType: "batch_regenerate_qc_enqueue_failed",
      note: `auto_reject:manual_review_batch后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

const enqueueQcRetryFollowupQualityCheck = async ({
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
}): Promise<{ taskId: string; status: "processing" | "failed"; error?: string }> => {
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
    const message = queueError instanceof Error ? queueError.message : "质量返工后置质检入队失败";
    const failedTaskData = await mergeTaskData(qcTask.id, {
      message: "质量返工后置质检入队失败",
      metadata: {
        queueError: message,
        triggeredByTaskId: audioTaskId,
      },
    });

    await prisma.processingTask.update({
      where: { id: qcTask.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    await rejectQcRetryReprocessingItems({
      bookId,
      reviewItemIds,
      resolutionType: "batch_regenerate_qc_enqueue_failed",
      note: `auto_reject:qc_retry后置质检入队失败:${message}`,
    });

    return {
      taskId: qcTask.id,
      status: "failed",
      error: message,
    };
  }
};

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

  let results: any[] = [];
  let totalSentences = 0;

  if (type === "book") {
    await updateTaskProgress(taskId, 20, "开始生成整书音频");
    const result = await audioGenerator.generateBookAudio(bookId, options);
    results = result.results;
    totalSentences = result.total;
  } else if (type === "chapter" && chapterId) {
    await updateTaskProgress(taskId, 20, "开始生成章节音频");
    const result = await audioGenerator.generateChapterAudio(
      bookId,
      chapterId,
      options
    );
    results = result.results;
    totalSentences = result.total;
  } else if (type === "batch" && scriptSentenceIds) {
    await updateTaskProgress(taskId, 20, "开始批量生成音频");
    const requests: AudioGenerationRequest[] = scriptSentenceIds.map((id) => ({
      scriptSentenceId: id,
      voiceProfileId,
      outputFormat: "mp3",
    }));
    results = await audioGenerator.generateBatchAudio(requests, options);
    totalSentences = requests.length;
  } else if (type === "single" && scriptSentenceIds && scriptSentenceIds.length > 0) {
    await updateTaskProgress(taskId, 20, "开始生成单个音频");
    const request: AudioGenerationRequest = {
      scriptSentenceId: scriptSentenceIds[0],
      voiceProfileId,
      outputFormat: "mp3",
    };
    const result = await audioGenerator.generateSingleAudio(request, options);
    results = [result];
    totalSentences = 1;
  } else {
    throw new Error("无效的生成类型");
  }

  await updateTaskProgress(taskId, 80, "统计生成结果");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

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
      totalSentences,
      successCount,
      failedCount,
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

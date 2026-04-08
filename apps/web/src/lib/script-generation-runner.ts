// 一旦我被更新，请更新我的开头注释
// input: 任务参数/服务依赖
// output: 台本任务执行结果
// pos: 任务执行器
import prisma from "@/lib/prisma";
import type { LLMExecutionEvent } from "@/lib/llm/events";
import { runScriptProductionWorkflow } from "@/lib/agent-runtime/runtime/run-script-production-workflow";
import type {
  ScriptGenerationOptions,
  SegmentFailureDetail,
} from "@/lib/agent-runtime/runtime/script-production/types";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

export interface ScriptGenerationExtraParams {
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  regenerateSegments?: boolean;
  segmentIds?: string[];
  limitToSegments?: number;
}

export interface ScriptGenerationRunParams {
  bookId: string;
  taskId: string;
  options: Partial<ScriptGenerationOptions>;
  extraParams?: ScriptGenerationExtraParams;
}

const MANUAL_REVIEW_ISSUE_TYPE = "SCRIPT_VALIDATION";

interface ScriptGenerationLLMProviderMetrics {
  provider: string;
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageLatencyMs: number;
  averageWaitMs: number;
}

interface ScriptGenerationLLMMetrics {
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageLatencyMs: number;
  averageWaitMs: number;
  providers: ScriptGenerationLLMProviderMetrics[];
}

interface AgentRuntimeMetadata {
  workflowRunId: string;
  workflowId?: string;
  status: string;
  mode?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  traceEventCount?: number;
  stageRunCount?: number;
  summary?: Record<string, unknown>;
}

interface RuntimeManualReviewSync {
  issueType: string;
  created: number;
  updated: number;
  pending: number;
  resolved: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const asBoolean = (value: unknown): boolean => value === true;

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
};

const asAgentRuntimeMetadata = (
  value: unknown
): AgentRuntimeMetadata | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const workflowRunId = asString(record.workflowRunId);
  const status = asString(record.status);

  if (!workflowRunId || !status) {
    return null;
  }

  const summary = asRecord(record.summary) || undefined;

  return {
    workflowRunId,
    workflowId: asString(record.workflowId) || undefined,
    status,
    mode: asString(record.mode) || undefined,
    startedAt: asString(record.startedAt) || undefined,
    completedAt: asString(record.completedAt) || undefined,
    durationMs: asNumber(record.durationMs) ?? undefined,
    traceEventCount: asNumber(record.traceEventCount) ?? undefined,
    stageRunCount: asNumber(record.stageRunCount) ?? undefined,
    summary: summary ? JSON.parse(JSON.stringify(summary)) : undefined,
  };
};

const asRuntimeManualReviewSync = (
  runtimeMetadata: AgentRuntimeMetadata | null
): RuntimeManualReviewSync | null => {
  const summary = asRecord(runtimeMetadata?.summary);
  const reviewSync = asRecord(summary?.manualReviewSync);
  if (!reviewSync) {
    return null;
  }

  const issueType = asString(reviewSync.issueType);
  if (!issueType) {
    return null;
  }

  return {
    issueType,
    created: asNumber(reviewSync.created) ?? 0,
    updated: asNumber(reviewSync.updated) ?? 0,
    pending: asNumber(reviewSync.pending) ?? 0,
    resolved: asNumber(reviewSync.resolved) ?? 0,
  };
};

const buildBookRuntimePointers = (params: {
  runtimeMetadata: AgentRuntimeMetadata | null;
  isFailure: boolean;
}): Record<string, unknown> => {
  const { runtimeMetadata, isFailure } = params;
  if (!runtimeMetadata) {
    return {};
  }

  return {
    lastScriptWorkflowRunId: runtimeMetadata.workflowRunId,
    lastScriptRuntimeStatus: runtimeMetadata.status,
    ...(runtimeMetadata.completedAt
      ? {
          lastScriptRuntimeCompletedAt: runtimeMetadata.completedAt,
        }
      : {}),
    ...(isFailure
      ? {
          lastFailedScriptWorkflowRunId: runtimeMetadata.workflowRunId,
        }
      : {}),
  };
};

const createLLMMetricsCollector = () => {
  const providerBuckets = new Map<
    string,
    {
      submitted: number;
      completed: number;
      failed: number;
      retried: number;
      totalLatencyMs: number;
      totalWaitMs: number;
    }
  >();
  let submitted = 0;
  let completed = 0;
  let failed = 0;
  let retried = 0;
  let totalLatencyMs = 0;
  let totalWaitMs = 0;

  const getBucket = (provider: string) => {
    const key = provider.trim() || "unknown";
    const existing = providerBuckets.get(key);
    if (existing) {
      return existing;
    }

    const created = {
      submitted: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      totalLatencyMs: 0,
      totalWaitMs: 0,
    };
    providerBuckets.set(key, created);
    return created;
  };

  return {
    observe(event: LLMExecutionEvent) {
      const bucket = getBucket(event.provider);
      if (event.status === "submitted") {
        submitted += 1;
        bucket.submitted += 1;
        return;
      }

      const retriesUsed =
        typeof event.retriesUsed === "number"
          ? Math.max(event.retriesUsed, 0)
          : typeof event.attempt === "number"
            ? Math.max(event.attempt - 1, 0)
            : 0;

      retried += retriesUsed;
      bucket.retried += retriesUsed;

      if (event.status === "completed") {
        completed += 1;
        bucket.completed += 1;
        totalLatencyMs += event.latencyMs;
        bucket.totalLatencyMs += event.latencyMs;
        totalWaitMs += event.waitMs || 0;
        bucket.totalWaitMs += event.waitMs || 0;
        return;
      }

      failed += 1;
      bucket.failed += 1;
    },

    snapshot(): ScriptGenerationLLMMetrics {
      return {
        submitted,
        completed,
        failed,
        retried,
        averageLatencyMs: completed > 0 ? Math.round(totalLatencyMs / completed) : 0,
        averageWaitMs: completed > 0 ? Math.round(totalWaitMs / completed) : 0,
        providers: Array.from(providerBuckets.entries())
          .map(([provider, bucket]) => ({
            provider,
            submitted: bucket.submitted,
            completed: bucket.completed,
            failed: bucket.failed,
            retried: bucket.retried,
            averageLatencyMs:
              bucket.completed > 0
                ? Math.round(bucket.totalLatencyMs / bucket.completed)
                : 0,
            averageWaitMs:
              bucket.completed > 0
                ? Math.round(bucket.totalWaitMs / bucket.completed)
                : 0,
          }))
          .sort((left, right) => left.provider.localeCompare(right.provider)),
      };
    },
  };
};

const normalizeSegmentFailureDetail = (value: unknown): SegmentFailureDetail | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const segmentId = asString(record.segmentId);
  if (!segmentId) {
    return null;
  }

  return {
    segmentId,
    chapterId: asString(record.chapterId) || null,
    orderIndex:
      asNumber(record.orderIndex) !== null ? Number(record.orderIndex) : -1,
    stage: asString(record.stage) || "unknown",
    errorCode: asString(record.errorCode) || "UNKNOWN_ERROR",
    message: asString(record.message) || "未知错误",
    provider: asString(record.provider) || null,
    retryable: asBoolean(record.retryable),
    coverageRatio: asNumber(record.coverageRatio),
    issueCodes: asStringList(record.issueCodes),
    issueMessages: asStringList(record.issueMessages),
    issuePreviews: asStringList(record.issuePreviews),
    segmentPreview: asString(record.segmentPreview),
    segmentContent: asString(record.segmentContent),
    rawResponse: asString(record.rawResponse) || null,
    structuredResult:
      record.structuredResult &&
      typeof record.structuredResult === "object" &&
      !Array.isArray(record.structuredResult)
        ? (JSON.parse(
            JSON.stringify(record.structuredResult)
          ) as Record<string, unknown>)
        : null,
  };
};

const resolveFailureDetails = (rawValue: unknown): SegmentFailureDetail[] => {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((entry) => normalizeSegmentFailureDetail(entry))
    .filter((entry): entry is SegmentFailureDetail => Boolean(entry));
};

const isSampleScriptGenerationRun = (
  extraParams: ScriptGenerationExtraParams
): boolean =>
  typeof extraParams.limitToSegments === "number" &&
  extraParams.limitToSegments > 0 &&
  !extraParams.regenerateSegments &&
  !extraParams.startFromSegmentId &&
  (extraParams.startFromOrderIndex === null ||
    extraParams.startFromOrderIndex === undefined);

const isPartialScriptGenerationRun = (
  extraParams: ScriptGenerationExtraParams
): boolean =>
  Boolean(extraParams.regenerateSegments) ||
  Boolean(extraParams.startFromSegmentId) ||
  (extraParams.startFromOrderIndex !== null &&
    extraParams.startFromOrderIndex !== undefined) ||
  isSampleScriptGenerationRun(extraParams);

const mergeOutstandingFailedSegmentIds = (params: {
  bookMetadata: Record<string, unknown>;
  processedSegmentIds: string[];
  failedSegmentIds: string[];
  isPartialRun: boolean;
}): string[] => {
  const { bookMetadata, processedSegmentIds, failedSegmentIds, isPartialRun } = params;

  if (!isPartialRun) {
    return failedSegmentIds;
  }

  const processedSegmentIdSet = new Set(processedSegmentIds);
  const previousFailedSegmentIds = asStringList(bookMetadata.failedSegmentIds);

  return Array.from(
    new Set([
      ...previousFailedSegmentIds.filter((segmentId) => !processedSegmentIdSet.has(segmentId)),
      ...failedSegmentIds,
    ])
  );
};

const resolveBookStatusAfterSampleRun = (
  previousStatus: string,
  outstandingFailedSegments: number
): string => {
  if (outstandingFailedSegments > 0) {
    return "manual_review_pending";
  }

  if (previousStatus === "manual_review_pending" || previousStatus === "script_generated") {
    return "script_generated";
  }

  return previousStatus || "script_generated";
};

const resolveBookStatusAfterPartialRun = (params: {
  previousStatus: string;
  outstandingFailedSegments: number;
  isSampleRun: boolean;
}): string => {
  const { previousStatus, outstandingFailedSegments, isSampleRun } = params;

  if (isSampleRun) {
    return resolveBookStatusAfterSampleRun(
      previousStatus,
      outstandingFailedSegments
    );
  }

  if (outstandingFailedSegments > 0) {
    return "manual_review_pending";
  }

  if (previousStatus === "processed") {
    return "processed";
  }

  return "script_generated";
};

/**
 * 执行台本生成任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runScriptGenerationTask({
  bookId,
  taskId,
  options,
  extraParams = {},
}: ScriptGenerationRunParams): Promise<void> {
  const isSampleRun = isSampleScriptGenerationRun(extraParams);
  const isPartialRun = isPartialScriptGenerationRun(extraParams);
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      taskData: true,
    },
  });
  const taskMetadata = asRecord(asRecord(taskSnapshot?.taskData)?.metadata);
  const previousBookStatusFromTask = asString(taskMetadata?.previousBookStatus);

  await updateTaskProgress(taskId, 10, "准备生成台本");

  const llmMetricsCollector = createLLMMetricsCollector();
  let script: any;

  await updateTaskProgress(taskId, 30, "开始分析文本");

  const segmentProgress = (done: number, total: number) => {
    if (!total) return;
    const base = 30;
    const span = 40;
    const next = Math.min(base + Math.floor((done / total) * span), 69);
    return updateTaskProgress(taskId, next, `生成台本 ${done}/${total}`);
  };

  if (extraParams.regenerateSegments && extraParams.segmentIds) {
    script = await runScriptProductionWorkflow({
      taskId,
      bookId,
      options,
      mode: "regenerate",
      segmentIds: extraParams.segmentIds,
      onProgress: segmentProgress,
      onExecutionEvent: (event: LLMExecutionEvent) => {
        llmMetricsCollector.observe(event);
      },
    });
    await updateTaskProgress(taskId, 70, "段落台本生成完成");
  } else if (
    extraParams.limitToSegments ||
    extraParams.startFromSegmentId ||
    (extraParams.startFromOrderIndex !== null &&
      extraParams.startFromOrderIndex !== undefined)
  ) {
    if (extraParams.limitToSegments) {
      script = await runScriptProductionWorkflow({
        taskId,
        bookId,
        options,
        mode: "partial",
        startFromSegmentId: extraParams.startFromSegmentId,
        startFromOrderIndex: extraParams.startFromOrderIndex,
        limitToSegments: extraParams.limitToSegments,
        onProgress: segmentProgress,
        onExecutionEvent: (event: LLMExecutionEvent) => {
          llmMetricsCollector.observe(event);
        },
      });
      script.segments = script.segments.slice(0, extraParams.limitToSegments);
      await updateTaskProgress(
        taskId,
        70,
        `完成前${extraParams.limitToSegments}个段落的台本生成`
      );
    } else {
      script = await runScriptProductionWorkflow({
        taskId,
        bookId,
        options,
        mode: "partial",
        startFromSegmentId: extraParams.startFromSegmentId,
        startFromOrderIndex: extraParams.startFromOrderIndex,
        onProgress: segmentProgress,
        onExecutionEvent: (event: LLMExecutionEvent) => {
          llmMetricsCollector.observe(event);
        },
      });
      await updateTaskProgress(taskId, 70, "增量台本生成完成");
    }
  } else {
    await prisma.scriptSentence.deleteMany({
      where: { bookId },
    });
    script = await runScriptProductionWorkflow({
      taskId,
      bookId,
      options,
      mode: "full",
      onProgress: segmentProgress,
      onExecutionEvent: (event: LLMExecutionEvent) => {
        llmMetricsCollector.observe(event);
      },
    });
    await updateTaskProgress(taskId, 70, "台本生成完成");
  }

  await updateTaskProgress(taskId, 90, "更新书籍状态");

  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });
  const bookMetadata = jsonObject(book?.metadata);
  const previousBookStatus =
    previousBookStatusFromTask ||
    (typeof book?.status === "string" ? book.status : "");

  const failedSegments = Number(script.summary.failedSegments || 0);
  const totalSegments = Number(script.summary.totalSegments || 0);
  const runtimeMetadata = asAgentRuntimeMetadata(
    asRecord(script)?.runtimeMetadata
  );
  const runtimeReviewSync = asRuntimeManualReviewSync(runtimeMetadata);
  const hasSegmentFailures = failedSegments > 0;
  const failedSegmentIds = asStringList(script.summary.failedSegmentIds);
  const processedSegmentIds = Array.isArray(script.segments)
    ? script.segments
        .map((segment: { segmentId?: unknown }) => asString(segment?.segmentId))
        .filter((segmentId: string) => segmentId.length > 0)
    : [];
  const failedSegmentDetails = resolveFailureDetails(
    script.summary.failedSegmentDetails
  );
  const outstandingFailedSegmentIds = mergeOutstandingFailedSegmentIds({
    bookMetadata,
    processedSegmentIds,
    failedSegmentIds,
    isPartialRun,
  });
  const outstandingFailedSegments = outstandingFailedSegmentIds.length;
  const resolvedReviewResult = {
    resolved: runtimeReviewSync?.resolved ?? 0,
  };
  const reviewSyncResult = {
    created: runtimeReviewSync?.created ?? 0,
    updated: runtimeReviewSync?.updated ?? 0,
    totalPending: runtimeReviewSync?.pending ?? 0,
  };
  const llmMetrics = llmMetricsCollector.snapshot();

  if (hasSegmentFailures) {
    const failureMessage = `台本生成部分失败：${failedSegments}/${totalSegments} 个段落未生成成功`;
    const maxFailureDetailCount = 200;
    const visibleFailureDetails = failedSegmentDetails.slice(0, maxFailureDetailCount);
    const failedTaskData = await mergeTaskData(taskId, {
      message: failureMessage,
      metadata: {
        totalLines: script.summary.totalLines,
        dialogueCount: script.summary.dialogueCount,
        narrationCount: script.summary.narrationCount,
        segmentCount: script.segments.length,
        totalSegments,
        failedSegments,
        failedSegmentIds: outstandingFailedSegmentIds,
        failedSegmentDetails: visibleFailureDetails,
        omittedFailureDetails: Math.max(
          failedSegmentDetails.length - visibleFailureDetails.length,
          0
        ),
        isPartialFailure: true,
        reviewSync: {
          issueType: MANUAL_REVIEW_ISSUE_TYPE,
          created: reviewSyncResult.created,
          updated: reviewSyncResult.updated,
          pending: reviewSyncResult.totalPending,
        },
        ...(runtimeMetadata
          ? {
              agentRuntime: runtimeMetadata,
            }
          : {}),
        ...(llmMetrics.submitted > 0
          ? {
              llmMetrics,
            }
          : {}),
      },
    });

    await prisma.processingTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: failureMessage,
        taskData: failedTaskData,
      },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: {
        status:
          outstandingFailedSegments > 0
            ? "manual_review_pending"
            : "processed",
        metadata: {
          ...bookMetadata,
          scriptGenerationFailedAt: new Date().toISOString(),
          failedSegments: outstandingFailedSegments,
          totalSegments:
            isPartialRun && typeof book?.totalSegments === "number" && book.totalSegments > 0
              ? book.totalSegments
              : totalSegments,
          failedSegmentIds: outstandingFailedSegmentIds,
          scriptFailureIssueType: MANUAL_REVIEW_ISSUE_TYPE,
          scriptFailureManualReviewPending: reviewSyncResult.totalPending,
          scriptFailureManualReviewCreated: reviewSyncResult.created,
          scriptFailureManualReviewUpdated: reviewSyncResult.updated,
          scriptFailureManualReviewResolved: resolvedReviewResult.resolved,
          ...buildBookRuntimePointers({
            runtimeMetadata,
            isFailure: true,
          }),
        },
      },
    });
    return;
  }

  await updateTaskProgress(taskId, 100, "台本生成完成");

  const taskData = await mergeTaskData(taskId, {
    message: extraParams.regenerateSegments
      ? "段落重新生成完成"
      : isPartialRun
      ? "增量台本生成完成"
      : "台本生成完成",
    metadata: {
      totalLines: script.summary.totalLines,
      dialogueCount: script.summary.dialogueCount,
      narrationCount: script.summary.narrationCount,
      characterCount: Object.keys(script.summary.characterDistribution).length,
      segmentCount: script.segments.length,
      isPartial: isPartialRun,
      regeneratedSegments: extraParams.segmentIds?.length || 0,
      autoResolvedScriptReviewItems: resolvedReviewResult.resolved,
      ...(runtimeMetadata
        ? {
            agentRuntime: runtimeMetadata,
          }
        : {}),
      ...(llmMetrics.submitted > 0
        ? {
            llmMetrics,
          }
        : {}),
    },
  });

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
      status: isPartialRun
        ? resolveBookStatusAfterPartialRun({
            previousStatus: previousBookStatus,
            outstandingFailedSegments,
            isSampleRun,
          })
        : "script_generated",
      metadata: {
        ...bookMetadata,
        ...(isPartialRun
          ? {}
          : {
              scriptGeneratedAt: new Date().toISOString(),
              totalScriptLines: script.summary.totalLines,
              dialogueCount: script.summary.dialogueCount,
              narrationCount: script.summary.narrationCount,
              totalSegments: script.summary.totalSegments,
            }),
        failedSegments: outstandingFailedSegments,
        failedSegmentIds: outstandingFailedSegmentIds,
        ...buildBookRuntimePointers({
          runtimeMetadata,
          isFailure: false,
        }),
      },
    },
  });
}

import type { SegmentFailureDetail } from "@/lib/agent-runtime/runtime/script-production/types";
import type {
  AgentRuntimeMetadata,
  RuntimeManualReviewSync,
  ScriptGenerationExtraParams,
} from "@/lib/script-generation/runner/types";

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const asString = (value: unknown): string => {
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
export { asStringList };

export const asAgentRuntimeMetadata = (
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

export const asRuntimeManualReviewSync = (
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

export const buildBookRuntimePointers = (params: {
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

export const resolveFailureDetails = (rawValue: unknown): SegmentFailureDetail[] => {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((entry) => normalizeSegmentFailureDetail(entry))
    .filter((entry): entry is SegmentFailureDetail => Boolean(entry));
};

export const isSampleScriptGenerationRun = (
  extraParams: ScriptGenerationExtraParams
): boolean =>
  typeof extraParams.limitToSegments === "number" &&
  extraParams.limitToSegments > 0 &&
  !extraParams.regenerateSegments &&
  !extraParams.startFromSegmentId &&
  (extraParams.startFromOrderIndex === null ||
    extraParams.startFromOrderIndex === undefined);

export const isPartialScriptGenerationRun = (
  extraParams: ScriptGenerationExtraParams
): boolean =>
  Boolean(extraParams.regenerateSegments) ||
  Boolean(extraParams.startFromSegmentId) ||
  (extraParams.startFromOrderIndex !== null &&
    extraParams.startFromOrderIndex !== undefined) ||
  isSampleScriptGenerationRun(extraParams);

export const mergeOutstandingFailedSegmentIds = (params: {
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

export const resolveBookStatusAfterPartialRun = (params: {
  previousStatus: string;
  outstandingFailedSegments: number;
  isSampleRun: boolean;
}): string => {
  const { previousStatus, outstandingFailedSegments, isSampleRun } = params;

  if (isSampleRun) {
    return resolveBookStatusAfterSampleRun(previousStatus, outstandingFailedSegments);
  }

  if (outstandingFailedSegments > 0) {
    return "manual_review_pending";
  }

  if (previousStatus === "processed") {
    return "processed";
  }

  return "script_generated";
};

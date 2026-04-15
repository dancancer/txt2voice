// 一旦我被更新，请更新我的开头注释
// input: 复核任务响应/未知 metadata
// output: review workbench 辅助常量与转换
// pos: 质检复核页面数据钩子
import type {
  ReviewRegenerateTask,
  ReviewRegenerateTaskFailureSummary,
  ReviewTaskListResponse,
  ReviewPagination,
  ReviewSummary,
} from "../models/types";
import { REVIEW_PAGE_LIMIT } from "../models/types";

export const DEFAULT_PAGINATION: ReviewPagination = {
  page: 1,
  limit: REVIEW_PAGE_LIMIT,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export const DEFAULT_SUMMARY: ReviewSummary = {
  pendingCount: 0,
  reprocessingCount: 0,
  resolvedCount: 0,
  rejectedCount: 0,
  total: 0,
};

export const DEFAULT_DISPATCH_EVENT_SUMMARY = {
  openCount: 0,
  ackedCount: 0,
  resolvedCount: 0,
  totalCount: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const asFailureSummaries = (
  value: unknown
): ReviewRegenerateTaskFailureSummary[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((detail) => {
      if (!isRecord(detail)) {
        return null;
      }

      const summary: ReviewRegenerateTaskFailureSummary = {
        segmentId: asOptionalString(detail.segmentId),
        orderIndex: asOptionalNumber(detail.orderIndex),
        stage: asOptionalString(detail.stage),
        errorCode: asOptionalString(detail.errorCode),
        message: asOptionalString(detail.message),
      };

      if (
        !summary.segmentId &&
        summary.orderIndex === null &&
        !summary.stage &&
        !summary.errorCode &&
        !summary.message
      ) {
        return null;
      }

      return summary;
    })
    .filter(
      (summary): summary is ReviewRegenerateTaskFailureSummary => summary !== null
    );
};

const uniqueSegmentIds = (segmentIds: string[]): string[] => {
  return Array.from(new Set(segmentIds.filter((id) => id.length > 0)));
};

const toFailureSummarySortKey = (
  summary: ReviewRegenerateTaskFailureSummary
): [number, string, string, string] => {
  return [
    summary.orderIndex ?? Number.MAX_SAFE_INTEGER,
    summary.segmentId ?? "",
    summary.stage ?? "",
    summary.errorCode ?? "",
  ];
};

const pickStableFailureSummary = (
  summaries: ReviewRegenerateTaskFailureSummary[]
): ReviewRegenerateTaskFailureSummary | null => {
  if (summaries.length === 0) {
    return null;
  }

  return [...summaries].sort((left, right) => {
    const leftKey = toFailureSummarySortKey(left);
    const rightKey = toFailureSummarySortKey(right);
    for (let index = 0; index < leftKey.length; index += 1) {
      if (leftKey[index] < rightKey[index]) {
        return -1;
      }
      if (leftKey[index] > rightKey[index]) {
        return 1;
      }
    }
    return 0;
  })[0];
};

export const toRegenerateTask = (
  task: NonNullable<ReviewTaskListResponse["data"]>[number]
): ReviewRegenerateTask | null => {
  const metadata = isRecord(task.metadata) ? task.metadata : null;
  const manualSource =
    metadata?.source === "manual_review" ||
    metadata?.source === "manual_review_batch" ||
    metadata?.source === "manual_review_bulk_pending"
      ? metadata.source
      : null;
  const failedSegmentIds = uniqueSegmentIds(asStringArray(metadata?.failedSegmentIds));
  const failureSummaries = asFailureSummaries(metadata?.failedSegmentDetails);
  const isScriptFailureTask =
    task.taskType === "SCRIPT_GENERATION" &&
    task.status === "failed" &&
    (failureSummaries.length > 0 || failedSegmentIds.length > 0);
  const category = isScriptFailureTask
    ? "script_failure"
    : "manual_review_regenerate";
  const source = manualSource;

  if (!source && !isScriptFailureTask) {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata?.selectedReviewItemIds);
  const segmentIdsFromMetadata = uniqueSegmentIds(asStringArray(metadata?.segmentIds));
  const segmentIdsFromFailureDetails = uniqueSegmentIds(
    failureSummaries
      .map((summary) => summary.segmentId)
      .filter((segmentId): segmentId is string => Boolean(segmentId))
  );
  const segmentIds =
    segmentIdsFromMetadata.length > 0
      ? segmentIdsFromMetadata
      : segmentIdsFromFailureDetails.length > 0
        ? segmentIdsFromFailureDetails
        : failedSegmentIds;
  const scriptSentenceIds = asStringArray(metadata?.scriptSentenceIds);
  const targetCount =
    selectedReviewItemIds.length ||
    segmentIds.length ||
    scriptSentenceIds.length ||
    1;

  return {
    id: task.id,
    taskType: task.taskType,
    status: task.status,
    progress: task.progress || 0,
    message: task.message || null,
    errorMessage: task.errorMessage || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt || null,
    source,
    category,
    targetCount,
    segmentIds,
    failureSummary: pickStableFailureSummary(failureSummaries),
  };
};

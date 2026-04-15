// 一旦我被更新，请更新我的开头注释
// input: 复核任务响应/未知 metadata
// output: review workbench 辅助常量与转换
// pos: 质检复核页面数据钩子
import type {
  ReviewRegenerateTask,
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

export const toRegenerateTask = (
  task: NonNullable<ReviewTaskListResponse["data"]>[number]
): ReviewRegenerateTask | null => {
  const metadata = isRecord(task.metadata) ? task.metadata : null;
  const source =
    metadata?.source === "manual_review" ||
    metadata?.source === "manual_review_batch" ||
    metadata?.source === "manual_review_bulk_pending"
      ? metadata.source
      : null;

  if (!source) {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata?.selectedReviewItemIds);
  const segmentIds = asStringArray(metadata?.segmentIds);
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
    targetCount,
  };
};

// 一旦我被更新，请更新我的开头注释
// input: ManualReviewItem 状态字段
// output: 自动编排阻塞/非阻塞分类
// pos: 自动编排人工复核门禁模块
import type { Prisma } from "@/lib/prisma";

export const MANUAL_REVIEW_RESOLUTION_TYPES = [
  "fixed",
  "waived",
  "false_positive",
  "accepted_risk",
  "auto_recovery_exhausted",
  "hard_failure",
  "retry_requested",
] as const;

export type ManualReviewResolutionType =
  (typeof MANUAL_REVIEW_RESOLUTION_TYPES)[number];

export interface ManualReviewGateItem {
  id?: string;
  status: string;
  resolutionType: string | null;
  issueType?: string | null;
  issueDetail: Prisma.JsonValue | Record<string, unknown> | null;
}

export interface ManualReviewGateResult {
  blocking: boolean;
  reason: string;
}

const NON_BLOCKING_RESOLUTIONS = new Set<string>([
  "fixed",
  "waived",
  "false_positive",
  "accepted_risk",
]);

const BLOCKING_FAILURE_RESOLUTIONS = new Set<string>([
  "auto_recovery_exhausted",
  "hard_failure",
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const classifyManualReviewItem = (
  item: ManualReviewGateItem
): ManualReviewGateResult => {
  const detail = asRecord(item.issueDetail);
  const blockingFlag = detail.blocking;
  const nonBlocking = blockingFlag === false;
  const blockingReason =
    typeof detail.blockingReason === "string" ? detail.blockingReason : null;

  if (nonBlocking && NON_BLOCKING_RESOLUTIONS.has(item.resolutionType || "")) {
    return { blocking: false, reason: "non_blocking_resolution" };
  }

  if (item.status === "pending" || item.status === "reprocessing") {
    return {
      blocking: true,
      reason: blockingReason || item.status,
    };
  }

  if (item.status === "resolved") {
    return {
      blocking: !NON_BLOCKING_RESOLUTIONS.has(item.resolutionType || ""),
      reason: "resolved_resolution_type",
    };
  }

  if (item.status === "rejected") {
    const recoveryExhausted = detail.recoveryExhausted === true;
    const hardBlocking = blockingFlag === true;
    const failureResolution = BLOCKING_FAILURE_RESOLUTIONS.has(
      item.resolutionType || ""
    );
    const missingAudio =
      item.issueType === "MISSING_AUDIO" || blockingReason === "missing_audio";

    return {
      blocking: failureResolution || recoveryExhausted || hardBlocking || missingAudio,
      reason: blockingReason || item.resolutionType || "rejected",
    };
  }

  return { blocking: true, reason: "unknown_review_status" };
};

export const summarizeManualReviewGate = (items: ManualReviewGateItem[]) => {
  const blockingItems = items.filter((item) => classifyManualReviewItem(item).blocking);
  return {
    blockingCount: blockingItems.length,
    blockingItemIds: blockingItems
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string"),
  };
};

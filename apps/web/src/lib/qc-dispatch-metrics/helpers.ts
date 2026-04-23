// 一旦我被更新，请更新我的开头注释
// input: 派单指标查询/issueDetail/taskData
// output: 指标归一化与聚合辅助函数
// pos: 质检观测服务
import { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import type {
  QcDispatchMetricsQuery,
} from "@/lib/qc-dispatch-metrics-service";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_DAYS = 7;
export const MAX_WINDOW_DAYS = 90;

export interface DispatchMetricBase {
  autoRejectedEventCount: number;
  autoRejectedAccumulatedCount: number;
  thresholdBlockedCount: number;
  secondaryPendingCount: number;
}

export type MutableDispatchMetricBase = DispatchMetricBase;
export type DispatchSignalType = "cer" | "speaker";

export interface MutableSourceSummary {
  source: string;
  taskCount: number;
  secondaryDispatchCount: number;
  secondaryDispatchSkippedByThresholdCount: number;
}

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const asNonNegativeInteger = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isInteger(numeric) || numeric < 0) {
    return null;
  }
  return Number(numeric);
};

export const normalizeSource = (value: string): string =>
  value.trim().toLowerCase();

export const normalizeIssueType = (value: string): string =>
  value.trim().toUpperCase();

export const resolveSource = ({
  issueDetail,
  resolutionNote,
}: {
  issueDetail: Prisma.JsonValue;
  resolutionNote: string | null;
}): string => {
  const detail = asRecord(issueDetail);
  const sourceFromDetail = asString(detail?.source);
  if (sourceFromDetail) {
    return normalizeSource(sourceFromDetail);
  }

  const dispatchSource = asString(detail?.dispatchSource);
  if (dispatchSource) {
    return normalizeSource(dispatchSource);
  }

  if (typeof resolutionNote === "string") {
    if (resolutionNote.includes("qc_retry")) {
      return "qc_retry";
    }
    if (resolutionNote.includes("retry_task:")) {
      return "manual_review";
    }
  }

  return "unknown";
};

export const resolveSignal = ({
  issueType,
  issueDetail,
}: {
  issueType: string;
  issueDetail: Prisma.JsonValue;
}): DispatchSignalType | null => {
  const normalizedIssueType = normalizeIssueType(issueType || "UNKNOWN");
  if (normalizedIssueType === "CER") {
    return "cer";
  }
  if (normalizedIssueType === "SPEAKER") {
    return "speaker";
  }

  const detail = asRecord(issueDetail);
  const primarySignal = asString(detail?.primarySignal)?.toLowerCase();
  if (primarySignal?.includes("q2_cer") || primarySignal?.includes("cer")) {
    return "cer";
  }
  if (
    primarySignal?.includes("q3_speaker") ||
    primarySignal?.includes("speaker") ||
    primarySignal?.includes("voiceprint")
  ) {
    return "speaker";
  }

  const reasons = Array.isArray(detail?.reasons) ? detail?.reasons : [];
  if (
    reasons.some(
      (reason) => typeof reason === "string" && reason.startsWith("cer_")
    )
  ) {
    return "cer";
  }
  if (
    reasons.some(
      (reason) =>
        typeof reason === "string" && reason.startsWith("speaker_similarity")
    )
  ) {
    return "speaker";
  }

  return null;
};

export const initMutableMetric = (): MutableDispatchMetricBase => ({
  autoRejectedEventCount: 0,
  autoRejectedAccumulatedCount: 0,
  thresholdBlockedCount: 0,
  secondaryPendingCount: 0,
});

export const upsertMetric = <T>(
  map: Map<string, T>,
  key: string,
  create: () => T
): T => {
  const current = map.get(key);
  if (current) {
    return current;
  }
  const next = create();
  map.set(key, next);
  return next;
};

export const parseWindowDays = (value: unknown): number => {
  if (value === undefined || value === null) {
    return DEFAULT_WINDOW_DAYS;
  }
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_WINDOW_DAYS) {
    throw new ValidationError(`days 必须是 1-${MAX_WINDOW_DAYS} 的整数`);
  }
  return Number(numeric);
};

export const shouldInclude = ({
  query,
  source,
  issueType,
}: {
  query: QcDispatchMetricsQuery;
  source: string;
  issueType: string;
}): boolean => {
  if (query.source && source !== query.source) {
    return false;
  }
  if (query.issueType && issueType !== query.issueType) {
    return false;
  }
  return true;
};

export const sortMetric = (a: DispatchMetricBase, b: DispatchMetricBase): number => {
  if (b.autoRejectedEventCount !== a.autoRejectedEventCount) {
    return b.autoRejectedEventCount - a.autoRejectedEventCount;
  }
  if (b.secondaryPendingCount !== a.secondaryPendingCount) {
    return b.secondaryPendingCount - a.secondaryPendingCount;
  }
  return b.autoRejectedAccumulatedCount - a.autoRejectedAccumulatedCount;
};

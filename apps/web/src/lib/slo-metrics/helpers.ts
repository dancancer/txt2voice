// 一旦我被更新，请更新我的开头注释
// input: JSON/task 字段与聚合中间值
// output: SLO 聚合辅助函数
// pos: S32 指标工具
import type { Prisma } from "@/lib/prisma";
import type {
  AverageSloMetric,
  RatioSloMetric,
  SloMetricDirection,
  SloMetricStatus,
  TaskTypeSummary,
} from "@/lib/slo-metrics/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const matchesSource = (filterSource: string | undefined, source: string | null): boolean => {
  if (!filterSource) {
    return true;
  }
  return source === filterSource;
};

export const readTaskMetadata = (
  taskData: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null => {
  return asRecord(asRecord(taskData)?.metadata);
};

export const resolveTaskSource = (
  taskData: Prisma.JsonValue | null | undefined
): string | null => {
  const source = asString(readTaskMetadata(taskData)?.source);
  return source ? source.trim().toLowerCase() : null;
};

export const resolveQualitySource = (
  detail: Prisma.JsonValue | null | undefined
): string | null => {
  const source = asString(asRecord(detail)?.source);
  return source ? source.trim().toLowerCase() : null;
};

export const resolveManualReviewSource = (
  issueDetail: Prisma.JsonValue | null | undefined,
  resolutionNote?: string | null
): string | null => {
  const detail = asRecord(issueDetail);
  const explicitSource = asString(detail?.source) || asString(detail?.dispatchSource);
  if (explicitSource) {
    return explicitSource.trim().toLowerCase();
  }
  if (typeof resolutionNote === "string") {
    if (resolutionNote.includes("qc_retry")) {
      return "qc_retry";
    }
    if (resolutionNote.includes("manual_review")) {
      return "manual_review";
    }
  }
  return null;
};

export const hasCalibrationLabel = (
  detail: Prisma.JsonValue | null | undefined
): boolean => {
  return Boolean(asRecord(asRecord(detail)?.calibrationLabel));
};

export const createTaskTypeSummary = (): TaskTypeSummary => ({
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
});

export const appendTaskStatus = (summary: TaskTypeSummary, status: string): void => {
  summary.total += 1;
  if (status === "completed") {
    summary.completed += 1;
    return;
  }
  if (status === "failed") {
    summary.failed += 1;
    return;
  }
  if (status === "canceled") {
    summary.failed += 1;
    return;
  }
  if (status === "processing") {
    summary.processing += 1;
    return;
  }
  summary.pending += 1;
};

const resolveMetricStatus = ({
  value,
  direction,
  target,
}: {
  value: number | null;
  direction: SloMetricDirection;
  target: number | null;
}): SloMetricStatus => {
  if (value === null || target === null) {
    return "unknown";
  }
  if (direction === "higher_is_better") {
    return value >= target ? "healthy" : "breached";
  }
  return value <= target ? "healthy" : "breached";
};

export const buildRatioMetric = ({
  key,
  label,
  numerator,
  denominator,
  direction,
  target = null,
}: {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
  direction: SloMetricDirection;
  target?: number | null;
}): RatioSloMetric => {
  const value = denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
  return {
    kind: "ratio",
    key,
    label,
    value,
    percentage: value === null ? null : Number((value * 100).toFixed(2)),
    numerator,
    denominator,
    direction,
    target,
    status: resolveMetricStatus({ value, direction, target }),
  };
};

export const buildAverageMetric = ({
  key,
  label,
  total,
  denominator,
  direction,
  target = null,
}: {
  key: string;
  label: string;
  total: number;
  denominator: number;
  direction: SloMetricDirection;
  target?: number | null;
}): AverageSloMetric => {
  const value = denominator > 0 ? Number((total / denominator).toFixed(4)) : null;
  return {
    kind: "average",
    key,
    label,
    value,
    total,
    denominator,
    direction,
    target,
    status: resolveMetricStatus({ value, direction, target }),
  };
};

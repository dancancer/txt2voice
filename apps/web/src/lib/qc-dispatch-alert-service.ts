// 一旦我被更新，请更新我的开头注释
// input: 告警查询参数/派单指标服务依赖
// output: 派单告警清单与建议动作
// pos: 质检派单告警服务
import { ValidationError } from "@/lib/error-handler";
import {
  getQcDispatchMetrics,
  parseQcDispatchMetricsQuery,
  type QcDispatchMetricsQuery,
  type QcDispatchMetricsResult,
} from "@/lib/qc-dispatch-metrics-service";

type QcDispatchAlertCode =
  | "threshold_blocked_spike"
  | "secondary_pending_backlog"
  | "auto_rejected_accumulated_pressure";

type QcDispatchAlertSeverity = "warning" | "critical";

export interface QcDispatchAlertQuery extends QcDispatchMetricsQuery {
  thresholdBlockedSpikeDelta: number;
  thresholdBlockedGrowthRate: number;
  thresholdBlockedCurrentFloor: number;
  secondaryPendingLimit: number;
  autoRejectedAccumulatedLimit: number;
}

export interface QcDispatchAlertItem {
  code: QcDispatchAlertCode;
  severity: QcDispatchAlertSeverity;
  message: string;
  recommendedAction: string;
  values: Record<string, number>;
}

export interface QcDispatchAlertResult {
  window: QcDispatchMetricsResult["window"];
  filter: QcDispatchMetricsResult["filter"];
  thresholds: {
    thresholdBlockedSpikeDelta: number;
    thresholdBlockedGrowthRate: number;
    thresholdBlockedCurrentFloor: number;
    secondaryPendingLimit: number;
    autoRejectedAccumulatedLimit: number;
  };
  snapshot: {
    windowTotals: QcDispatchMetricsResult["totals"];
    thresholdBlockedCurrent24h: number;
    thresholdBlockedPrevious24h: number;
  };
  alerts: QcDispatchAlertItem[];
}

const DEFAULT_THRESHOLD_BLOCKED_SPIKE_DELTA = 3;
const DEFAULT_THRESHOLD_BLOCKED_GROWTH_RATE = 2;
const DEFAULT_THRESHOLD_BLOCKED_CURRENT_FLOOR = 3;
const DEFAULT_SECONDARY_PENDING_LIMIT = 15;
const DEFAULT_AUTO_REJECTED_ACCUMULATED_LIMIT = 30;

const toInteger = (value: string | null): number | null => {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    return null;
  }
  return Number(numeric);
};

const toNumber = (value: string | null): number | null => {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Number(numeric);
};

const parseNonNegativeInteger = ({
  raw,
  fallback,
  field,
}: {
  raw: string | null;
  fallback: number;
  field: string;
}): number => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }

  const value = toInteger(raw);
  if (value === null || value < 0) {
    throw new ValidationError(`${field} 必须是非负整数`);
  }

  return value;
};

const parsePositiveNumber = ({
  raw,
  fallback,
  field,
}: {
  raw: string | null;
  fallback: number;
  field: string;
}): number => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }

  const value = toNumber(raw);
  if (value === null || value <= 0) {
    throw new ValidationError(`${field} 必须是大于 0 的数字`);
  }

  return value;
};

const resolveSeverity = ({
  value,
  threshold,
}: {
  value: number;
  threshold: number;
}): QcDispatchAlertSeverity => {
  if (threshold <= 0) {
    return "warning";
  }
  return value >= threshold * 2 ? "critical" : "warning";
};

const buildMetricsQuery = (query: QcDispatchAlertQuery): QcDispatchMetricsQuery => {
  return {
    windowDays: query.windowDays,
    source: query.source,
    issueType: query.issueType,
  };
};

export const parseQcDispatchAlertQuery = (
  searchParams: URLSearchParams
): QcDispatchAlertQuery => {
  const base = parseQcDispatchMetricsQuery(searchParams);

  return {
    ...base,
    thresholdBlockedSpikeDelta: parseNonNegativeInteger({
      raw: searchParams.get("thresholdBlockedSpikeDelta"),
      fallback: DEFAULT_THRESHOLD_BLOCKED_SPIKE_DELTA,
      field: "thresholdBlockedSpikeDelta",
    }),
    thresholdBlockedGrowthRate: parsePositiveNumber({
      raw: searchParams.get("thresholdBlockedGrowthRate"),
      fallback: DEFAULT_THRESHOLD_BLOCKED_GROWTH_RATE,
      field: "thresholdBlockedGrowthRate",
    }),
    thresholdBlockedCurrentFloor: parseNonNegativeInteger({
      raw: searchParams.get("thresholdBlockedCurrentFloor"),
      fallback: DEFAULT_THRESHOLD_BLOCKED_CURRENT_FLOOR,
      field: "thresholdBlockedCurrentFloor",
    }),
    secondaryPendingLimit: parseNonNegativeInteger({
      raw: searchParams.get("secondaryPendingLimit"),
      fallback: DEFAULT_SECONDARY_PENDING_LIMIT,
      field: "secondaryPendingLimit",
    }),
    autoRejectedAccumulatedLimit: parseNonNegativeInteger({
      raw: searchParams.get("autoRejectedAccumulatedLimit"),
      fallback: DEFAULT_AUTO_REJECTED_ACCUMULATED_LIMIT,
      field: "autoRejectedAccumulatedLimit",
    }),
  };
};

const buildThresholdBlockedSpikeAlert = ({
  query,
  current24h,
  previous24h,
}: {
  query: QcDispatchAlertQuery;
  current24h: number;
  previous24h: number;
}): QcDispatchAlertItem | null => {
  const delta = current24h - previous24h;
  const growthRate = previous24h === 0 ? (current24h > 0 ? Infinity : 1) : current24h / previous24h;

  const reachedFloor = current24h >= query.thresholdBlockedCurrentFloor;
  const reachedDelta = delta >= query.thresholdBlockedSpikeDelta;
  const reachedGrowth = growthRate >= query.thresholdBlockedGrowthRate;

  if (!reachedFloor || (!reachedDelta && !reachedGrowth)) {
    return null;
  }

  const thresholdScore = Math.max(
    query.thresholdBlockedSpikeDelta > 0
      ? delta / query.thresholdBlockedSpikeDelta
      : delta > 0
        ? 2
        : 0,
    growthRate === Infinity
      ? 2
      : query.thresholdBlockedGrowthRate > 0
        ? growthRate / query.thresholdBlockedGrowthRate
        : 0
  );

  return {
    code: "threshold_blocked_spike",
    severity: thresholdScore >= 2 ? "critical" : "warning",
    message: `最近 24 小时 threshold_blocked=${current24h}，上一窗口=${previous24h}，出现突增趋势`,
    recommendedAction:
      "检查 dispatchPolicy.maxAutoRejectedCount 与 issueTypePolicies，必要时临时关闭 autoCreatePendingOnReject。",
    values: {
      current24h,
      previous24h,
      delta,
      growthRate: growthRate === Infinity ? 999 : Number(growthRate.toFixed(4)),
      thresholdDelta: query.thresholdBlockedSpikeDelta,
      thresholdGrowthRate: query.thresholdBlockedGrowthRate,
      thresholdCurrentFloor: query.thresholdBlockedCurrentFloor,
    },
  };
};

const buildSecondaryPendingAlert = ({
  current,
  threshold,
}: {
  current: number;
  threshold: number;
}): QcDispatchAlertItem | null => {
  if (current < threshold) {
    return null;
  }

  return {
    code: "secondary_pending_backlog",
    severity: resolveSeverity({ value: current, threshold }),
    message: `secondary_pending 数量达到 ${current}，已超过阈值 ${threshold}`,
    recommendedAction: "优先处理 pending 复核项，并检查是否存在单一 issueType 的批量退化。",
    values: {
      current,
      threshold,
    },
  };
};

const buildAutoRejectedAccumulatedAlert = ({
  current,
  threshold,
}: {
  current: number;
  threshold: number;
}): QcDispatchAlertItem | null => {
  if (current < threshold) {
    return null;
  }

  return {
    code: "auto_rejected_accumulated_pressure",
    severity: resolveSeverity({ value: current, threshold }),
    message: `autoRejected 累计重拒次数达到 ${current}，已超过阈值 ${threshold}`,
    recommendedAction:
      "按 source/issueType 过滤排查回归点，必要时限制 qc_retry 批次规模并提高人工介入比例。",
    values: {
      current,
      threshold,
    },
  };
};

export const getQcDispatchAlerts = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: QcDispatchAlertQuery;
}): Promise<QcDispatchAlertResult> => {
  const metricsQuery = buildMetricsQuery(query);

  const [windowMetrics, current24hMetrics, recent48hMetrics] = await Promise.all([
    getQcDispatchMetrics({
      bookId,
      query: metricsQuery,
    }),
    getQcDispatchMetrics({
      bookId,
      query: {
        ...metricsQuery,
        windowDays: 1,
      },
    }),
    getQcDispatchMetrics({
      bookId,
      query: {
        ...metricsQuery,
        windowDays: 2,
      },
    }),
  ]);

  const thresholdBlockedCurrent24h = current24hMetrics.totals.thresholdBlockedCount;
  const thresholdBlockedPrevious24h = Math.max(
    0,
    recent48hMetrics.totals.thresholdBlockedCount - thresholdBlockedCurrent24h
  );

  const alerts = [
    buildThresholdBlockedSpikeAlert({
      query,
      current24h: thresholdBlockedCurrent24h,
      previous24h: thresholdBlockedPrevious24h,
    }),
    buildSecondaryPendingAlert({
      current: windowMetrics.totals.secondaryPendingCount,
      threshold: query.secondaryPendingLimit,
    }),
    buildAutoRejectedAccumulatedAlert({
      current: windowMetrics.totals.autoRejectedAccumulatedCount,
      threshold: query.autoRejectedAccumulatedLimit,
    }),
  ].filter((item): item is QcDispatchAlertItem => Boolean(item));

  return {
    window: windowMetrics.window,
    filter: windowMetrics.filter,
    thresholds: {
      thresholdBlockedSpikeDelta: query.thresholdBlockedSpikeDelta,
      thresholdBlockedGrowthRate: query.thresholdBlockedGrowthRate,
      thresholdBlockedCurrentFloor: query.thresholdBlockedCurrentFloor,
      secondaryPendingLimit: query.secondaryPendingLimit,
      autoRejectedAccumulatedLimit: query.autoRejectedAccumulatedLimit,
    },
    snapshot: {
      windowTotals: windowMetrics.totals,
      thresholdBlockedCurrent24h,
      thresholdBlockedPrevious24h,
    },
    alerts,
  };
};

// 一旦我被更新，请更新我的开头注释
// input: 查询参数/数据库依赖
// output: 自动派单与 autoRejected 聚合指标
// pos: 质检观测服务
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;

interface DispatchMetricBase {
  autoRejectedEventCount: number;
  autoRejectedAccumulatedCount: number;
  thresholdBlockedCount: number;
  secondaryPendingCount: number;
}
type MutableDispatchMetricBase = DispatchMetricBase;

type DispatchSignalType = "cer" | "speaker";

interface MutableSourceSummary {
  source: string;
  taskCount: number;
  secondaryDispatchCount: number;
  secondaryDispatchSkippedByThresholdCount: number;
}

export interface QcDispatchMetricsQuery {
  windowDays: number;
  source?: string;
  issueType?: string;
}

export interface QcDispatchMetricsResult {
  window: {
    days: number;
    since: string;
    until: string;
  };
  filter: {
    source: string | null;
    issueType: string | null;
  };
  totals: DispatchMetricBase;
  byIssueType: Array<DispatchMetricBase & { issueType: string }>;
  bySource: Array<DispatchMetricBase & { source: string }>;
  qualityTaskSummary: {
    taskCount: number;
    secondaryDispatchCount: number;
    secondaryDispatchSkippedByThresholdCount: number;
    bySource: Array<MutableSourceSummary>;
  };
  signalBreakdown: {
    cer: DispatchMetricBase;
    speaker: DispatchMetricBase;
  };
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asNonNegativeInteger = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric < 0) {
    return null;
  }
  return Number(numeric);
};

const normalizeSource = (value: string): string => value.trim().toLowerCase();
const normalizeIssueType = (value: string): string => value.trim().toUpperCase();

const resolveSource = ({
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

const resolveSignal = ({
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
  if (reasons.some((reason) => typeof reason === "string" && reason.startsWith("cer_"))) {
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

const initMutableMetric = (): MutableDispatchMetricBase => ({
  autoRejectedEventCount: 0,
  autoRejectedAccumulatedCount: 0,
  thresholdBlockedCount: 0,
  secondaryPendingCount: 0,
});

const upsertMetric = <T>(
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

const parseWindowDays = (value: unknown): number => {
  if (value === undefined || value === null) {
    return DEFAULT_WINDOW_DAYS;
  }
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_WINDOW_DAYS) {
    throw new ValidationError(`days 必须是 1-${MAX_WINDOW_DAYS} 的整数`);
  }
  return Number(numeric);
};

const shouldInclude = ({
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

export const parseQcDispatchMetricsQuery = (
  searchParams: URLSearchParams
): QcDispatchMetricsQuery => {
  const windowDays = parseWindowDays(searchParams.get("days"));
  const sourceInput = asString(searchParams.get("source"));
  const issueTypeInput = asString(searchParams.get("issueType"));
  return {
    windowDays,
    source: sourceInput ? normalizeSource(sourceInput) : undefined,
    issueType: issueTypeInput ? normalizeIssueType(issueTypeInput) : undefined,
  };
};

export const getQcDispatchMetrics = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: QcDispatchMetricsQuery;
}): Promise<QcDispatchMetricsResult> => {
  const until = new Date();
  const since = new Date(until.getTime() - query.windowDays * DAY_MS);

  const [autoRejectedRows, recentReviewRows, qualityTasks] = await Promise.all([
    prisma.manualReviewItem.findMany({
      where: {
        bookId,
        resolutionType: "auto_rejected",
        resolvedAt: {
          gte: since,
        },
      },
      select: {
        issueType: true,
        issueDetail: true,
        resolutionNote: true,
      },
    }),
    prisma.manualReviewItem.findMany({
      where: {
        bookId,
        createdAt: {
          gte: since,
        },
      },
      select: {
        issueType: true,
        issueDetail: true,
        resolutionNote: true,
      },
    }),
    prisma.processingTask.findMany({
      where: {
        bookId,
        taskType: "QUALITY_CHECK",
        status: "completed",
        completedAt: {
          gte: since,
        },
      },
      select: {
        taskData: true,
      },
    }),
  ]);

  const totals = initMutableMetric();
  const byIssueTypeMap = new Map<string, MutableDispatchMetricBase & { issueType: string }>();
  const bySourceMap = new Map<string, MutableDispatchMetricBase & { source: string }>();
  const signalBreakdown = {
    cer: initMutableMetric(),
    speaker: initMutableMetric(),
  };

  for (const row of autoRejectedRows) {
    const source = resolveSource({
      issueDetail: row.issueDetail,
      resolutionNote: row.resolutionNote,
    });
    const issueType = normalizeIssueType(row.issueType || "UNKNOWN");

    if (!shouldInclude({ query, source, issueType })) {
      continue;
    }

    const detail = asRecord(row.issueDetail);
    const autoRejectedCount = asNonNegativeInteger(detail?.autoRejectedCount) ?? 1;
    const isThresholdBlocked = detail?.secondaryDispatch === "threshold_blocked";
    const signal = resolveSignal({
      issueType,
      issueDetail: row.issueDetail,
    });

    totals.autoRejectedEventCount += 1;
    totals.autoRejectedAccumulatedCount += autoRejectedCount;
    if (isThresholdBlocked) {
      totals.thresholdBlockedCount += 1;
    }

    const issueBucket = upsertMetric(byIssueTypeMap, issueType, () => ({
      issueType,
      ...initMutableMetric(),
    }));
    issueBucket.autoRejectedEventCount += 1;
    issueBucket.autoRejectedAccumulatedCount += autoRejectedCount;
    if (isThresholdBlocked) {
      issueBucket.thresholdBlockedCount += 1;
    }

    const sourceBucket = upsertMetric(bySourceMap, source, () => ({
      source,
      ...initMutableMetric(),
    }));
    sourceBucket.autoRejectedEventCount += 1;
    sourceBucket.autoRejectedAccumulatedCount += autoRejectedCount;
    if (isThresholdBlocked) {
      sourceBucket.thresholdBlockedCount += 1;
    }

    if (signal) {
      const signalBucket = signalBreakdown[signal];
      signalBucket.autoRejectedEventCount += 1;
      signalBucket.autoRejectedAccumulatedCount += autoRejectedCount;
      if (isThresholdBlocked) {
        signalBucket.thresholdBlockedCount += 1;
      }
    }
  }

  for (const row of recentReviewRows) {
    const detail = asRecord(row.issueDetail);
    if (detail?.dispatch !== "secondary_pending") {
      continue;
    }

    const source = resolveSource({
      issueDetail: row.issueDetail,
      resolutionNote: row.resolutionNote,
    });
    const issueType = normalizeIssueType(row.issueType || "UNKNOWN");
    const signal = resolveSignal({
      issueType,
      issueDetail: row.issueDetail,
    });
    if (!shouldInclude({ query, source, issueType })) {
      continue;
    }

    totals.secondaryPendingCount += 1;

    const issueBucket = upsertMetric(byIssueTypeMap, issueType, () => ({
      issueType,
      ...initMutableMetric(),
    }));
    issueBucket.secondaryPendingCount += 1;

    const sourceBucket = upsertMetric(bySourceMap, source, () => ({
      source,
      ...initMutableMetric(),
    }));
    sourceBucket.secondaryPendingCount += 1;

    if (signal) {
      signalBreakdown[signal].secondaryPendingCount += 1;
    }
  }

  const qualityTaskSummary = {
    taskCount: 0,
    secondaryDispatchCount: 0,
    secondaryDispatchSkippedByThresholdCount: 0,
    bySource: [] as Array<MutableSourceSummary>,
  };
  const qualityTaskBySourceMap = new Map<string, MutableSourceSummary>();

  for (const task of qualityTasks) {
    const taskData = asRecord(task.taskData);
    const metadata = asRecord(taskData?.metadata);
    const source = normalizeSource(asString(metadata?.source) || "unknown");
    if (query.source && source !== query.source) {
      continue;
    }

    const secondaryDispatchCount = asNonNegativeInteger(metadata?.secondaryDispatchCount) || 0;
    const secondaryDispatchSkippedByThresholdCount =
      asNonNegativeInteger(metadata?.secondaryDispatchSkippedByThresholdCount) || 0;

    qualityTaskSummary.taskCount += 1;
    qualityTaskSummary.secondaryDispatchCount += secondaryDispatchCount;
    qualityTaskSummary.secondaryDispatchSkippedByThresholdCount +=
      secondaryDispatchSkippedByThresholdCount;

    const sourceSummary = upsertMetric(qualityTaskBySourceMap, source, () => ({
      source,
      taskCount: 0,
      secondaryDispatchCount: 0,
      secondaryDispatchSkippedByThresholdCount: 0,
    }));
    sourceSummary.taskCount += 1;
    sourceSummary.secondaryDispatchCount += secondaryDispatchCount;
    sourceSummary.secondaryDispatchSkippedByThresholdCount +=
      secondaryDispatchSkippedByThresholdCount;
  }

  qualityTaskSummary.bySource = Array.from(qualityTaskBySourceMap.values()).sort((a, b) => {
    if (b.taskCount !== a.taskCount) {
      return b.taskCount - a.taskCount;
    }
    return a.source.localeCompare(b.source);
  });

  const sortMetric = (a: DispatchMetricBase, b: DispatchMetricBase): number => {
    if (b.autoRejectedEventCount !== a.autoRejectedEventCount) {
      return b.autoRejectedEventCount - a.autoRejectedEventCount;
    }
    if (b.secondaryPendingCount !== a.secondaryPendingCount) {
      return b.secondaryPendingCount - a.secondaryPendingCount;
    }
    return b.autoRejectedAccumulatedCount - a.autoRejectedAccumulatedCount;
  };

  const byIssueType = Array.from(byIssueTypeMap.values()).sort((a, b) => {
    const metricCompare = sortMetric(a, b);
    if (metricCompare !== 0) {
      return metricCompare;
    }
    return a.issueType.localeCompare(b.issueType);
  });

  const bySource = Array.from(bySourceMap.values()).sort((a, b) => {
    const metricCompare = sortMetric(a, b);
    if (metricCompare !== 0) {
      return metricCompare;
    }
    return a.source.localeCompare(b.source);
  });

  return {
    window: { days: query.windowDays, since: since.toISOString(), until: until.toISOString() },
    filter: { source: query.source || null, issueType: query.issueType || null },
    totals,
    byIssueType,
    bySource,
    qualityTaskSummary,
    signalBreakdown,
  };
};

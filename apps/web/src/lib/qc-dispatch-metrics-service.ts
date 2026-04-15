// 一旦我被更新，请更新我的开头注释
// input: 查询参数/数据库依赖
// output: 自动派单与 autoRejected 聚合指标
// pos: 质检观测服务
import prisma, { Prisma } from "@/lib/prisma";
import {
  asNonNegativeInteger,
  asRecord,
  asString,
  DAY_MS,
  DEFAULT_WINDOW_DAYS,
  initMutableMetric,
  MutableDispatchMetricBase,
  MutableSourceSummary,
  normalizeIssueType,
  normalizeSource,
  parseWindowDays,
  resolveSignal,
  resolveSource,
  shouldInclude,
  sortMetric,
  upsertMetric,
  MAX_WINDOW_DAYS,
  type DispatchMetricBase,
} from "@/lib/qc-dispatch-metrics/helpers";

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

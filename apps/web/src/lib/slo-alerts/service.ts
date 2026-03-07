// 一旦我被更新，请更新我的开头注释
// input: 告警查询参数/SLO 指标服务依赖
// output: 核心 SLO 告警清单
// pos: S32 告警服务
import { getBookSloMetrics } from "@/lib/slo-metrics/service";
import type {
  AverageSloMetric,
  BookSloMetricsResult,
  RatioSloMetric,
} from "@/lib/slo-metrics/types";
import type {
  SloAlertCode,
  SloAlertItem,
  SloAlertQuery,
  SloAlertResult,
} from "@/lib/slo-alerts/types";

const formatPercent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const formatFixed = (value: number): string => value.toFixed(4);

const resolveSeverity = ({
  metric,
  threshold,
}: {
  metric: RatioSloMetric | AverageSloMetric;
  threshold: number;
}): SloAlertItem["severity"] => {
  if (metric.value === null) {
    return "warning";
  }

  if (metric.direction === "higher_is_better") {
    if (threshold <= 0) {
      return "warning";
    }
    return (threshold - metric.value) / threshold >= 0.2 ? "critical" : "warning";
  }

  if (threshold === 0) {
    return metric.value > 0 ? "critical" : "warning";
  }
  return metric.value / threshold >= 1.5 ? "critical" : "warning";
};

const RECOMMENDED_ACTIONS: Record<keyof BookSloMetricsResult["metrics"], string> = {
  pipelineSuccessRate:
    "优先检查失败的 AUTO_PIPELINE/FINAL_ASSEMBLY 任务，并通过 replay/retry 收敛交付失败。",
  sentencePassRateFirstTry:
    "检查 QUALITY_CHECK issueType 分布、信号供给缺失率与阈值是否过紧。",
  avgRetryPerSentence:
    "定位返工热点句子与 provider 抖动，必要时回看 dispatchPolicy 和重试上限。",
  manualReviewRatio:
    "检查人工复核噪声、误报候选与阈值模板，优先压低无效人工介入。",
  chapterConsistencyFailRate:
    "检查章节审计中的 speaker drift / continuity 失败样本，并回看 Deep Gate 阈值与角色路由。",
};

const CODE_MAP: Record<keyof BookSloMetricsResult["metrics"], SloAlertCode> = {
  pipelineSuccessRate: "slo_pipeline_success_rate_breach",
  sentencePassRateFirstTry: "slo_sentence_pass_rate_first_try_breach",
  avgRetryPerSentence: "slo_avg_retry_per_sentence_breach",
  manualReviewRatio: "slo_manual_review_ratio_breach",
  chapterConsistencyFailRate: "slo_chapter_consistency_fail_rate_breach",
};

const buildRatioAlert = ({
  metricKey,
  metric,
  threshold,
}: {
  metricKey: keyof BookSloMetricsResult["metrics"];
  metric: RatioSloMetric;
  threshold: number | null;
}): SloAlertItem | null => {
  if (threshold === null || metric.value === null) {
    return null;
  }

  const breached =
    metric.direction === "higher_is_better"
      ? metric.value < threshold
      : metric.value > threshold;

  if (!breached) {
    return null;
  }

  return {
    code: CODE_MAP[metricKey],
    severity: resolveSeverity({ metric, threshold }),
    metricKey,
    message:
      metric.direction === "higher_is_better"
        ? `${metric.label} 当前 ${formatPercent(metric.value)}，低于阈值 ${formatPercent(threshold)}`
        : `${metric.label} 当前 ${formatPercent(metric.value)}，高于阈值 ${formatPercent(threshold)}`,
    recommendedAction: RECOMMENDED_ACTIONS[metricKey],
    values: {
      current: Number(metric.value.toFixed(4)),
      threshold: Number(threshold.toFixed(4)),
      numerator: metric.numerator,
      denominator: metric.denominator,
    },
  };
};

const buildAverageAlert = ({
  metricKey,
  metric,
  threshold,
}: {
  metricKey: keyof BookSloMetricsResult["metrics"];
  metric: AverageSloMetric;
  threshold: number | null;
}): SloAlertItem | null => {
  if (threshold === null || metric.value === null) {
    return null;
  }

  const breached =
    metric.direction === "higher_is_better"
      ? metric.value < threshold
      : metric.value > threshold;

  if (!breached) {
    return null;
  }

  return {
    code: CODE_MAP[metricKey],
    severity: resolveSeverity({ metric, threshold }),
    metricKey,
    message:
      metric.direction === "higher_is_better"
        ? `${metric.label} 当前 ${formatFixed(metric.value)}，低于阈值 ${formatFixed(threshold)}`
        : `${metric.label} 当前 ${formatFixed(metric.value)}，高于阈值 ${formatFixed(threshold)}`,
    recommendedAction: RECOMMENDED_ACTIONS[metricKey],
    values: {
      current: Number(metric.value.toFixed(4)),
      threshold: Number(threshold.toFixed(4)),
      total: metric.total,
      denominator: metric.denominator,
    },
  };
};

export const getBookSloAlerts = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: SloAlertQuery;
}): Promise<SloAlertResult> => {
  const metrics = await getBookSloMetrics({
    bookId,
    query: {
      windowDays: query.windowDays,
      source: query.source,
    },
  });

  const alerts = [
    buildRatioAlert({
      metricKey: "pipelineSuccessRate",
      metric: metrics.metrics.pipelineSuccessRate,
      threshold: query.pipelineSuccessRateMin,
    }),
    buildRatioAlert({
      metricKey: "sentencePassRateFirstTry",
      metric: metrics.metrics.sentencePassRateFirstTry,
      threshold: query.sentencePassRateFirstTryMin,
    }),
    buildAverageAlert({
      metricKey: "avgRetryPerSentence",
      metric: metrics.metrics.avgRetryPerSentence,
      threshold: query.avgRetryPerSentenceMax,
    }),
    buildRatioAlert({
      metricKey: "manualReviewRatio",
      metric: metrics.metrics.manualReviewRatio,
      threshold: query.manualReviewRatioMax,
    }),
    buildRatioAlert({
      metricKey: "chapterConsistencyFailRate",
      metric: metrics.metrics.chapterConsistencyFailRate,
      threshold: query.chapterConsistencyFailRateMax,
    }),
  ].filter((item): item is SloAlertItem => Boolean(item));

  return {
    window: metrics.window,
    filter: metrics.filter,
    thresholds: {
      pipelineSuccessRateMin: query.pipelineSuccessRateMin,
      sentencePassRateFirstTryMin: query.sentencePassRateFirstTryMin,
      avgRetryPerSentenceMax: query.avgRetryPerSentenceMax,
      manualReviewRatioMax: query.manualReviewRatioMax,
      chapterConsistencyFailRateMax: query.chapterConsistencyFailRateMax,
    },
    snapshot: {
      metrics: metrics.metrics,
      workflowSummary: metrics.workflowSummary,
      qualitySummary: metrics.qualitySummary,
      manualReviewSummary: metrics.manualReviewSummary,
      chapterAuditSummary: metrics.chapterAuditSummary,
      latestQualityTask: metrics.latestQualityTask,
    },
    alerts,
  };
};

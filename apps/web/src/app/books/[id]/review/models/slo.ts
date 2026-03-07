// 一旦我被更新，请更新我的开头注释
// input: 统一 SLO 指标结果
// output: 复核页展示模型与格式化结果
// pos: 质检复核 SLO 视图模型
import type {
  AverageSloMetric,
  BookSloMetricsResult,
  RatioSloMetric,
  SloMetricStatus,
} from "@/lib/slo-metrics/types";

export type ReviewSloMetricKey = keyof BookSloMetricsResult["metrics"];
export type ReviewSloMetricValue = BookSloMetricsResult["metrics"][ReviewSloMetricKey];

export interface ReviewSloMetricView {
  key: ReviewSloMetricKey;
  shortLabel: string;
  label: string;
  valueText: string;
  targetText: string;
  detailText: string;
  status: SloMetricStatus;
}

const METRIC_META: Record<ReviewSloMetricKey, { shortLabel: string; label: string }> = {
  pipelineSuccessRate: {
    shortLabel: "整书完成率",
    label: "pipeline_success_rate",
  },
  sentencePassRateFirstTry: {
    shortLabel: "首轮通过率",
    label: "sentence_pass_rate_first_try",
  },
  avgRetryPerSentence: {
    shortLabel: "句均返工",
    label: "avg_retry_per_sentence",
  },
  manualReviewRatio: {
    shortLabel: "人工复核占比",
    label: "manual_review_ratio",
  },
  chapterConsistencyFailRate: {
    shortLabel: "章节审计失败率",
    label: "chapter_consistency_fail_rate",
  },
};

const METRIC_ORDER: ReviewSloMetricKey[] = [
  "pipelineSuccessRate",
  "sentencePassRateFirstTry",
  "avgRetryPerSentence",
  "manualReviewRatio",
  "chapterConsistencyFailRate",
];

const formatPercentValue = (value: number | null): string => {
  if (value === null) {
    return "--";
  }
  return `${(value * 100).toFixed(1)}%`;
};

const formatNumericValue = (value: number | null): string => {
  if (value === null) {
    return "--";
  }
  return value.toFixed(2);
};

const formatMetricValue = (metric: RatioSloMetric | AverageSloMetric): string => {
  return metric.kind === "ratio"
    ? formatPercentValue(metric.value)
    : formatNumericValue(metric.value);
};

const formatMetricTarget = (metric: RatioSloMetric | AverageSloMetric): string => {
  return metric.kind === "ratio"
    ? formatPercentValue(metric.target)
    : formatNumericValue(metric.target);
};

const formatMetricDetail = (metric: RatioSloMetric | AverageSloMetric): string => {
  if (metric.kind === "ratio") {
    return `${metric.numerator}/${metric.denominator}`;
  }
  return `${metric.total}/${metric.denominator}`;
};

export const buildReviewSloMetricViews = (
  metrics: BookSloMetricsResult["metrics"]
): ReviewSloMetricView[] => {
  return METRIC_ORDER.map((key) => {
    const metric = metrics[key];
    const meta = METRIC_META[key];
    return {
      key,
      shortLabel: meta.shortLabel,
      label: meta.label,
      valueText: formatMetricValue(metric),
      targetText: formatMetricTarget(metric),
      detailText: formatMetricDetail(metric),
      status: metric.status,
    };
  });
};

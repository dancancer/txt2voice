// 一旦我被更新，请更新我的开头注释
// input: 复核页 SLO 展示模型
// output: 展示格式化断言
// pos: S32-C 视图模型测试
import { buildReviewSloMetricViews } from "@/app/books/[id]/review/models/slo";
import type { BookSloMetricsResult } from "@/lib/slo-metrics/types";

const metrics: BookSloMetricsResult["metrics"] = {
  pipelineSuccessRate: {
    kind: "ratio",
    key: "pipeline_success_rate",
    label: "整书完成率",
    status: "healthy",
    direction: "higher_is_better",
    target: 0.95,
    value: 0.98,
    percentage: 98,
    numerator: 49,
    denominator: 50,
  },
  sentencePassRateFirstTry: {
    kind: "ratio",
    key: "sentence_pass_rate_first_try",
    label: "首轮通过率",
    status: "unknown",
    direction: "higher_is_better",
    target: null,
    value: 0.72,
    percentage: 72,
    numerator: 18,
    denominator: 25,
  },
  avgRetryPerSentence: {
    kind: "average",
    key: "avg_retry_per_sentence",
    label: "句均返工次数",
    status: "breached",
    direction: "lower_is_better",
    target: null,
    value: 1.25,
    total: 30,
    denominator: 24,
  },
  manualReviewRatio: {
    kind: "ratio",
    key: "manual_review_ratio",
    label: "人工复核占比",
    status: "breached",
    direction: "lower_is_better",
    target: 0.2,
    value: 0.28,
    percentage: 28,
    numerator: 7,
    denominator: 25,
  },
  chapterConsistencyFailRate: {
    kind: "ratio",
    key: "chapter_consistency_fail_rate",
    label: "章节审计失败率",
    status: "healthy",
    direction: "lower_is_better",
    target: 0.03,
    value: 0.02,
    percentage: 2,
    numerator: 1,
    denominator: 50,
  },
};

describe("review-slo-models", () => {
  it("should build metric views in stable order", () => {
    const views = buildReviewSloMetricViews(metrics);
    expect(views.map((item) => item.key)).toEqual([
      "pipelineSuccessRate",
      "sentencePassRateFirstTry",
      "avgRetryPerSentence",
      "manualReviewRatio",
      "chapterConsistencyFailRate",
    ]);
  });

  it("should format ratio and average values consistently", () => {
    const views = buildReviewSloMetricViews(metrics);
    expect(views[0]).toMatchObject({
      valueText: "98.0%",
      targetText: "95.0%",
      detailText: "49/50",
      status: "healthy",
    });
    expect(views[2]).toMatchObject({
      valueText: "1.25",
      targetText: "--",
      detailText: "30/24",
      status: "breached",
    });
  });
});

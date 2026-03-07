// 一旦我被更新，请更新我的开头注释
// input: 核心 SLO 告警查询/依赖 mock
// output: 告警构建断言
// pos: S32 告警服务测试
jest.mock("@/lib/slo-metrics/service", () => ({
  getBookSloMetrics: jest.fn(),
}));

import { ValidationError } from "@/lib/error-handler";
import { getBookSloMetrics } from "@/lib/slo-metrics/service";
import { parseSloAlertQuery } from "@/lib/slo-alerts/query";
import { getBookSloAlerts } from "@/lib/slo-alerts/service";

const mockGetBookSloMetrics = getBookSloMetrics as jest.MockedFunction<typeof getBookSloMetrics>;

const baseMetrics = {
  window: {
    days: 7,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-08T00:00:00.000Z",
  },
  filter: {
    source: "auto_pipeline",
  },
  metrics: {
    pipelineSuccessRate: {
      kind: "ratio",
      key: "pipeline_success_rate",
      label: "整书完成率",
      value: 0.8,
      percentage: 80,
      numerator: 4,
      denominator: 5,
      direction: "higher_is_better",
      target: 0.95,
      status: "breached",
    },
    sentencePassRateFirstTry: {
      kind: "ratio",
      key: "sentence_pass_rate_first_try",
      label: "首轮通过率",
      value: 0.72,
      percentage: 72,
      numerator: 18,
      denominator: 25,
      direction: "higher_is_better",
      target: null,
      status: "unknown",
    },
    avgRetryPerSentence: {
      kind: "average",
      key: "avg_retry_per_sentence",
      label: "句均返工次数",
      value: 1.2,
      total: 30,
      denominator: 25,
      direction: "lower_is_better",
      target: null,
      status: "unknown",
    },
    manualReviewRatio: {
      kind: "ratio",
      key: "manual_review_ratio",
      label: "人工复核占比",
      value: 0.28,
      percentage: 28,
      numerator: 7,
      denominator: 25,
      direction: "lower_is_better",
      target: null,
      status: "unknown",
    },
    chapterConsistencyFailRate: {
      kind: "ratio",
      key: "chapter_consistency_fail_rate",
      label: "章节审计失败率",
      value: 0.08,
      percentage: 8,
      numerator: 2,
      denominator: 25,
      direction: "lower_is_better",
      target: 0.03,
      status: "breached",
    },
  },
  workflowSummary: {
    autoPipeline: {
      total: 5,
      pending: 0,
      processing: 0,
      completed: 4,
      failed: 1,
      pendingReviewHandOffCount: 1,
      directDeliveryCount: 4,
    },
    finalAssembly: {
      total: 1,
      pending: 0,
      processing: 0,
      completed: 1,
      failed: 0,
    },
    manualReviewSync: {
      total: 1,
      pending: 0,
      processing: 0,
      completed: 1,
      failed: 0,
    },
    deliveryTerminalCount: 5,
    deliverySuccessCount: 4,
    deliveryFailureCount: 1,
  },
  qualitySummary: {
    sentenceCount: 25,
    firstPassCount: 18,
    manualReviewSentenceCount: 7,
    totalRetryCount: 30,
  },
  manualReviewSummary: {
    createdCount: 8,
    uniqueSentenceCount: 7,
    pendingCount: 2,
    reprocessingCount: 1,
    resolvedCount: 5,
    rejectedCount: 0,
  },
  chapterAuditSummary: {
    total: 25,
    failedCount: 2,
    repairCount: 1,
    manualReviewCount: 1,
  },
  latestQualityTask: {
    taskId: "task-quality-1",
    source: "auto_pipeline",
    completedAt: "2026-03-07T00:00:00.000Z",
    checked: 25,
    passCount: 18,
    repairCount: 5,
    manualReviewCount: 2,
    hardFailCount: 0,
  },
};

describe("slo-alert-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse default thresholds", () => {
    expect(parseSloAlertQuery(new URLSearchParams("days=14&source=QC_Retry"))).toEqual({
      windowDays: 14,
      source: "qc_retry",
      pipelineSuccessRateMin: 0.95,
      sentencePassRateFirstTryMin: null,
      avgRetryPerSentenceMax: null,
      manualReviewRatioMax: null,
      chapterConsistencyFailRateMax: 0.03,
    });
  });

  it("should reject invalid ratio threshold", () => {
    expect(() =>
      parseSloAlertQuery(new URLSearchParams("manualReviewRatioMax=1.2"))
    ).toThrow(ValidationError);
  });

  it("should build default alerts from core thresholds", async () => {
    mockGetBookSloMetrics.mockResolvedValue(baseMetrics as any);

    const result = await getBookSloAlerts({
      bookId: "book-1",
      query: parseSloAlertQuery(new URLSearchParams("days=7&source=auto_pipeline")),
    });

    expect(result.alerts).toHaveLength(2);
    expect(result.alerts.map((item) => item.code)).toEqual([
      "slo_pipeline_success_rate_breach",
      "slo_chapter_consistency_fail_rate_breach",
    ]);
    expect(result.alerts[0]).toMatchObject({
      severity: "warning",
      metricKey: "pipelineSuccessRate",
    });
    expect(result.snapshot.metrics.pipelineSuccessRate.value).toBe(0.8);
  });

  it("should build custom threshold alerts without expanding defaults", async () => {
    mockGetBookSloMetrics.mockResolvedValue(baseMetrics as any);

    const result = await getBookSloAlerts({
      bookId: "book-1",
      query: parseSloAlertQuery(
        new URLSearchParams(
          "sentencePassRateFirstTryMin=0.8&avgRetryPerSentenceMax=1&manualReviewRatioMax=0.2"
        )
      ),
    });

    expect(result.alerts.map((item) => item.code)).toEqual([
      "slo_pipeline_success_rate_breach",
      "slo_sentence_pass_rate_first_try_breach",
      "slo_avg_retry_per_sentence_breach",
      "slo_manual_review_ratio_breach",
      "slo_chapter_consistency_fail_rate_breach",
    ]);
    expect(result.alerts.find((item) => item.code === "slo_avg_retry_per_sentence_breach")).toMatchObject({
      severity: "warning",
      metricKey: "avgRetryPerSentence",
    });
  });
});

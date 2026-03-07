// 一旦我被更新，请更新我的开头注释
// input: SLO 查询参数/服务依赖 mock
// output: 核心 SLO 指标聚合断言
// pos: S32 服务测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findMany: jest.fn(),
    },
    qualityCheckResult: {
      findMany: jest.fn(),
    },
    manualReviewItem: {
      findMany: jest.fn(),
    },
    chapterQualityAudit: {
      findMany: jest.fn(),
    },
    synthesisAttempt: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { parseBookSloMetricsQuery } from "@/lib/slo-metrics/query";
import { getBookSloMetrics } from "@/lib/slo-metrics/service";

const mockFindTasks = (prisma as any).processingTask.findMany as jest.Mock;
const mockFindQualityResults = (prisma as any).qualityCheckResult.findMany as jest.Mock;
const mockFindManualReviewItems = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockFindChapterAudits = (prisma as any).chapterQualityAudit.findMany as jest.Mock;
const mockFindAttempts = (prisma as any).synthesisAttempt.findMany as jest.Mock;

const buildFixture = () => ({
  tasks: [
    {
      id: "task-quality-cal",
      taskType: "QUALITY_CHECK",
      status: "completed",
      createdAt: new Date("2026-03-07T11:00:00.000Z"),
      taskData: {
        metadata: {
          source: "calibration_eval",
          checked: 1,
          passCount: 1,
        },
      },
    },
    {
      id: "task-quality-qc-retry",
      taskType: "QUALITY_CHECK",
      status: "completed",
      createdAt: new Date("2026-03-07T10:00:00.000Z"),
      taskData: {
        metadata: {
          source: "qc_retry",
          completedAt: "2026-03-07T10:05:00.000Z",
          checked: 1,
          passCount: 1,
          repairCount: 0,
          manualReviewCount: 0,
          hardFailCount: 0,
        },
      },
    },
    {
      id: "task-final-1",
      taskType: "FINAL_ASSEMBLY",
      status: "completed",
      createdAt: new Date("2026-03-07T09:00:00.000Z"),
      taskData: {
        metadata: {
          source: "final_assembly",
        },
      },
    },
    {
      id: "task-review-sync-1",
      taskType: "MANUAL_REVIEW_SYNC",
      status: "completed",
      createdAt: new Date("2026-03-07T08:00:00.000Z"),
      taskData: {
        metadata: {
          source: "manual_review_sync",
        },
      },
    },
    {
      id: "task-quality-auto",
      taskType: "QUALITY_CHECK",
      status: "completed",
      createdAt: new Date("2026-03-07T07:00:00.000Z"),
      taskData: {
        metadata: {
          source: "auto_pipeline",
          completedAt: "2026-03-07T07:05:00.000Z",
          checked: 3,
          passCount: 2,
          repairCount: 1,
          manualReviewCount: 1,
          hardFailCount: 0,
        },
      },
    },
    {
      id: "task-pipeline-1",
      taskType: "AUTO_PIPELINE",
      status: "completed",
      createdAt: new Date("2026-03-07T06:00:00.000Z"),
      taskData: {
        metadata: {
          source: "auto_pipeline",
          pendingReviewCount: 0,
        },
      },
    },
    {
      id: "task-pipeline-2",
      taskType: "AUTO_PIPELINE",
      status: "completed",
      createdAt: new Date("2026-03-07T05:00:00.000Z"),
      taskData: {
        metadata: {
          source: "auto_pipeline",
          pendingReviewCount: 2,
        },
      },
    },
    {
      id: "task-pipeline-3",
      taskType: "AUTO_PIPELINE",
      status: "failed",
      createdAt: new Date("2026-03-07T04:00:00.000Z"),
      taskData: {
        metadata: {
          source: "auto_pipeline",
        },
      },
    },
  ],
  qualityResults: [
    {
      sentenceId: "sentence-1",
      verdict: "pass",
      detail: { source: "auto_pipeline" },
      createdAt: new Date("2026-03-07T01:00:00.000Z"),
    },
    {
      sentenceId: "sentence-1",
      verdict: "repair",
      detail: { source: "qc_retry" },
      createdAt: new Date("2026-03-07T02:00:00.000Z"),
    },
    {
      sentenceId: "sentence-2",
      verdict: "manual_review",
      detail: { source: "auto_pipeline" },
      createdAt: new Date("2026-03-07T01:10:00.000Z"),
    },
    {
      sentenceId: "sentence-3",
      verdict: "pass",
      detail: { source: "auto_pipeline" },
      createdAt: new Date("2026-03-07T01:20:00.000Z"),
    },
    {
      sentenceId: "sentence-4",
      verdict: "pass",
      detail: { source: "qc_retry" },
      createdAt: new Date("2026-03-07T01:30:00.000Z"),
    },
    {
      sentenceId: "sentence-cal",
      verdict: "pass",
      detail: {
        source: "calibration_eval",
        calibrationLabel: {
          expectedVerdict: "pass",
        },
      },
      createdAt: new Date("2026-03-07T01:40:00.000Z"),
    },
  ],
  manualReviewItems: [
    {
      sentenceId: "sentence-2",
      status: "pending",
      issueDetail: { source: "auto_pipeline" },
      resolutionNote: null,
    },
    {
      sentenceId: "sentence-2",
      status: "resolved",
      issueDetail: { source: "auto_pipeline" },
      resolutionNote: null,
    },
    {
      sentenceId: "sentence-4",
      status: "reprocessing",
      issueDetail: { source: "qc_retry" },
      resolutionNote: null,
    },
  ],
  chapterAudits: [
    {
      auditBatchId: "task-quality-auto",
      verdict: "pass",
    },
    {
      auditBatchId: "task-quality-auto",
      verdict: "manual_review",
    },
    {
      auditBatchId: "task-quality-qc-retry",
      verdict: "repair",
    },
  ],
  attempts: [
    { sentenceId: "sentence-1", attemptNo: 2 },
    { sentenceId: "sentence-1", attemptNo: 1 },
    { sentenceId: "sentence-2", attemptNo: 1 },
    { sentenceId: "sentence-3", attemptNo: 3 },
    { sentenceId: "sentence-3", attemptNo: 2 },
    { sentenceId: "sentence-3", attemptNo: 1 },
    { sentenceId: "sentence-4", attemptNo: 2 },
    { sentenceId: "sentence-4", attemptNo: 1 },
  ],
});

describe("slo-metrics-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse query with defaults and normalization", () => {
    expect(parseBookSloMetricsQuery(new URLSearchParams("days=14&source=QC_Retry"))).toEqual({
      windowDays: 14,
      source: "qc_retry",
    });
    expect(parseBookSloMetricsQuery(new URLSearchParams())).toEqual({
      windowDays: 7,
      source: undefined,
    });
  });

  it("should reject invalid window days", () => {
    expect(() => parseBookSloMetricsQuery(new URLSearchParams("days=0"))).toThrow(
      ValidationError
    );
  });

  it("should aggregate core slo metrics", async () => {
    const fixture = buildFixture();
    mockFindTasks.mockResolvedValue(fixture.tasks);
    mockFindQualityResults.mockResolvedValue(fixture.qualityResults);
    mockFindManualReviewItems.mockResolvedValue(fixture.manualReviewItems);
    mockFindChapterAudits.mockResolvedValue(fixture.chapterAudits);
    mockFindAttempts.mockResolvedValue(fixture.attempts);

    const result = await getBookSloMetrics({
      bookId: "book-1",
      query: {
        windowDays: 7,
      },
    });

    expect(result.metrics.pipelineSuccessRate).toMatchObject({
      value: 0.6667,
      numerator: 2,
      denominator: 3,
      status: "breached",
    });
    expect(result.metrics.sentencePassRateFirstTry).toMatchObject({
      value: 0.75,
      numerator: 3,
      denominator: 4,
    });
    expect(result.metrics.avgRetryPerSentence).toMatchObject({
      value: 1,
      total: 4,
      denominator: 4,
    });
    expect(result.metrics.manualReviewRatio).toMatchObject({
      value: 0.5,
      numerator: 2,
      denominator: 4,
    });
    expect(result.metrics.chapterConsistencyFailRate).toMatchObject({
      value: 0.6667,
      numerator: 2,
      denominator: 3,
    });
    expect(result.workflowSummary).toMatchObject({
      autoPipeline: {
        total: 3,
        completed: 2,
        failed: 1,
        pendingReviewHandOffCount: 1,
        directDeliveryCount: 2,
      },
      finalAssembly: {
        total: 1,
        completed: 1,
      },
      manualReviewSync: {
        total: 1,
        completed: 1,
      },
      deliveryTerminalCount: 3,
      deliverySuccessCount: 2,
      deliveryFailureCount: 1,
    });
    expect(result.qualitySummary).toEqual({
      sentenceCount: 4,
      firstPassCount: 3,
      manualReviewSentenceCount: 2,
      totalRetryCount: 4,
    });
    expect(result.manualReviewSummary).toEqual({
      createdCount: 3,
      uniqueSentenceCount: 2,
      pendingCount: 1,
      reprocessingCount: 1,
      resolvedCount: 1,
      rejectedCount: 0,
    });
    expect(result.chapterAuditSummary).toEqual({
      total: 3,
      failedCount: 2,
      repairCount: 1,
      manualReviewCount: 1,
    });
    expect(result.latestQualityTask).toMatchObject({
      taskId: "task-quality-qc-retry",
      source: "qc_retry",
      checked: 1,
    });
  });

  it("should filter metrics by source", async () => {
    const fixture = buildFixture();
    mockFindTasks.mockResolvedValue(fixture.tasks);
    mockFindQualityResults.mockResolvedValue(fixture.qualityResults);
    mockFindManualReviewItems.mockResolvedValue(fixture.manualReviewItems);
    mockFindChapterAudits.mockResolvedValue(fixture.chapterAudits);
    mockFindAttempts.mockResolvedValue(fixture.attempts);

    const result = await getBookSloMetrics({
      bookId: "book-1",
      query: {
        windowDays: 7,
        source: "auto_pipeline",
      },
    });

    expect(result.filter.source).toBe("auto_pipeline");
    expect(result.metrics.pipelineSuccessRate).toMatchObject({
      value: 0.5,
      numerator: 1,
      denominator: 2,
    });
    expect(result.metrics.sentencePassRateFirstTry).toMatchObject({
      value: 0.6667,
      numerator: 2,
      denominator: 3,
    });
    expect(result.metrics.manualReviewRatio).toMatchObject({
      value: 0.3333,
      numerator: 1,
      denominator: 3,
    });
    expect(result.metrics.chapterConsistencyFailRate).toMatchObject({
      value: 0.5,
      numerator: 1,
      denominator: 2,
    });
    expect(result.latestQualityTask).toMatchObject({
      taskId: "task-quality-auto",
      source: "auto_pipeline",
      checked: 3,
    });
  });
});

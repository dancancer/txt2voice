// 一旦我被更新，请更新我的开头注释
// input: 指标查询参数/服务依赖 mock
// output: 聚合统计服务断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    manualReviewItem: {
      findMany: jest.fn(),
    },
    processingTask: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  getQcDispatchMetrics,
  parseQcDispatchMetricsQuery,
} from "@/lib/qc-dispatch-metrics-service";

const mockFindManualReviewItems = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockFindQualityTasks = (prisma as any).processingTask.findMany as jest.Mock;

describe("qc-dispatch-metrics-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse query with defaults and normalization", () => {
    const query = parseQcDispatchMetricsQuery(
      new URLSearchParams("days=14&source=QC_Retry&issueType=fast_gate")
    );

    expect(query).toEqual({
      windowDays: 14,
      source: "qc_retry",
      issueType: "FAST_GATE",
    });
  });

  it("should throw when days is invalid", () => {
    expect(() => parseQcDispatchMetricsQuery(new URLSearchParams("days=0"))).toThrow(
      ValidationError
    );
  });

  it("should aggregate metrics by issueType and source", async () => {
    mockFindManualReviewItems
      .mockResolvedValueOnce([
        {
          issueType: "FAST_GATE",
          issueDetail: {
            autoRejectedCount: 2,
            secondaryDispatch: "threshold_blocked",
            source: "qc_retry",
          },
          resolutionNote: "auto_qc:hard_fail",
        },
        {
          issueType: "FAST_GATE",
          issueDetail: {
            autoRejectedCount: 1,
            source: "manual_review",
          },
          resolutionNote: "auto_qc:manual_review",
        },
        {
          issueType: "EMOTION",
          issueDetail: {
            autoRejectedCount: 3,
            source: "qc_retry",
          },
          resolutionNote: "auto_qc:manual_review",
        },
      ])
      .mockResolvedValueOnce([
        {
          issueType: "FAST_GATE",
          issueDetail: {
            dispatch: "secondary_pending",
            source: "qc_retry",
          },
          resolutionNote: null,
        },
        {
          issueType: "EMOTION",
          issueDetail: {
            dispatch: "secondary_pending",
            source: "manual_review",
          },
          resolutionNote: null,
        },
        {
          issueType: "FAST_GATE",
          issueDetail: {
            dispatch: "ignored_marker",
            source: "qc_retry",
          },
          resolutionNote: null,
        },
      ]);

    mockFindQualityTasks.mockResolvedValueOnce([
      {
        taskData: {
          metadata: {
            source: "qc_retry",
            secondaryDispatchCount: 2,
            secondaryDispatchSkippedByThresholdCount: 1,
          },
        },
      },
      {
        taskData: {
          metadata: {
            source: "manual_review",
            secondaryDispatchCount: 0,
            secondaryDispatchSkippedByThresholdCount: 0,
          },
        },
      },
      {
        taskData: {
          metadata: {},
        },
      },
    ]);

    const result = await getQcDispatchMetrics({
      bookId: "book-1",
      query: {
        windowDays: 7,
      },
    });

    expect(result.totals).toMatchObject({
      autoRejectedEventCount: 3,
      autoRejectedAccumulatedCount: 6,
      thresholdBlockedCount: 1,
      secondaryPendingCount: 2,
    });

    const fastGate = result.byIssueType.find((item) => item.issueType === "FAST_GATE");
    const emotion = result.byIssueType.find((item) => item.issueType === "EMOTION");
    const qcRetry = result.bySource.find((item) => item.source === "qc_retry");
    const manualReview = result.bySource.find(
      (item) => item.source === "manual_review"
    );

    expect(fastGate).toMatchObject({
      autoRejectedEventCount: 2,
      autoRejectedAccumulatedCount: 3,
      thresholdBlockedCount: 1,
      secondaryPendingCount: 1,
    });
    expect(emotion).toMatchObject({
      autoRejectedEventCount: 1,
      autoRejectedAccumulatedCount: 3,
      thresholdBlockedCount: 0,
      secondaryPendingCount: 1,
    });
    expect(qcRetry).toMatchObject({
      autoRejectedEventCount: 2,
      autoRejectedAccumulatedCount: 5,
      thresholdBlockedCount: 1,
      secondaryPendingCount: 1,
    });
    expect(manualReview).toMatchObject({
      autoRejectedEventCount: 1,
      autoRejectedAccumulatedCount: 1,
      thresholdBlockedCount: 0,
      secondaryPendingCount: 1,
    });

    expect(result.qualityTaskSummary).toMatchObject({
      taskCount: 3,
      secondaryDispatchCount: 2,
      secondaryDispatchSkippedByThresholdCount: 1,
    });
    expect(result.qualityTaskSummary.bySource).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "qc_retry",
          taskCount: 1,
          secondaryDispatchCount: 2,
          secondaryDispatchSkippedByThresholdCount: 1,
        }),
      ])
    );
  });

  it("should filter metrics by source", async () => {
    mockFindManualReviewItems
      .mockResolvedValueOnce([
        {
          issueType: "FAST_GATE",
          issueDetail: {
            autoRejectedCount: 2,
            source: "qc_retry",
          },
          resolutionNote: null,
        },
        {
          issueType: "FAST_GATE",
          issueDetail: {
            autoRejectedCount: 1,
            source: "manual_review",
          },
          resolutionNote: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          issueType: "FAST_GATE",
          issueDetail: {
            dispatch: "secondary_pending",
            source: "qc_retry",
          },
          resolutionNote: null,
        },
      ]);
    mockFindQualityTasks.mockResolvedValueOnce([
      {
        taskData: {
          metadata: {
            source: "qc_retry",
            secondaryDispatchCount: 2,
            secondaryDispatchSkippedByThresholdCount: 1,
          },
        },
      },
      {
        taskData: {
          metadata: {
            source: "manual_review",
            secondaryDispatchCount: 4,
            secondaryDispatchSkippedByThresholdCount: 0,
          },
        },
      },
    ]);

    const result = await getQcDispatchMetrics({
      bookId: "book-2",
      query: {
        windowDays: 7,
        source: "qc_retry",
      },
    });

    expect(result.totals).toMatchObject({
      autoRejectedEventCount: 1,
      autoRejectedAccumulatedCount: 2,
      thresholdBlockedCount: 0,
      secondaryPendingCount: 1,
    });
    expect(result.bySource).toHaveLength(1);
    expect(result.bySource[0]).toMatchObject({
      source: "qc_retry",
      autoRejectedEventCount: 1,
    });
    expect(result.qualityTaskSummary).toMatchObject({
      taskCount: 1,
      secondaryDispatchCount: 2,
      secondaryDispatchSkippedByThresholdCount: 1,
    });
  });
});

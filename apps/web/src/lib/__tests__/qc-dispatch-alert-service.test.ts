// 一旦我被更新，请更新我的开头注释
// input: 告警查询参数/服务依赖 mock
// output: 派单告警服务行为断言
// pos: 服务层单元测试
jest.mock("@/lib/qc-dispatch-metrics-service", () => {
  const actual = jest.requireActual("@/lib/qc-dispatch-metrics-service");
  return {
    ...actual,
    getQcDispatchMetrics: jest.fn(),
  };
});

import { ValidationError } from "@/lib/error-handler";
import {
  getQcDispatchMetrics,
  type QcDispatchMetricsResult,
} from "@/lib/qc-dispatch-metrics-service";
import {
  getQcDispatchAlerts,
  parseQcDispatchAlertQuery,
} from "@/lib/qc-dispatch-alert-service";

const mockGetQcDispatchMetrics = getQcDispatchMetrics as jest.MockedFunction<
  typeof getQcDispatchMetrics
>;

const buildMetrics = (
  totals: QcDispatchMetricsResult["totals"],
  days = 7
): QcDispatchMetricsResult => ({
  window: {
    days,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-08T00:00:00.000Z",
  },
  filter: {
    source: null,
    issueType: null,
  },
  totals,
  byIssueType: [],
  bySource: [],
  qualityTaskSummary: {
    taskCount: 0,
    secondaryDispatchCount: 0,
    secondaryDispatchSkippedByThresholdCount: 0,
    bySource: [],
  },
  signalBreakdown: {
    cer: {
      autoRejectedEventCount: 0,
      autoRejectedAccumulatedCount: 0,
      thresholdBlockedCount: 0,
      secondaryPendingCount: 0,
    },
    speaker: {
      autoRejectedEventCount: 0,
      autoRejectedAccumulatedCount: 0,
      thresholdBlockedCount: 0,
      secondaryPendingCount: 0,
    },
  },
});

describe("qc-dispatch-alert-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse alert query with defaults and custom thresholds", () => {
    const query = parseQcDispatchAlertQuery(
      new URLSearchParams(
        "days=14&source=QC_Retry&issueType=fast_gate&thresholdBlockedSpikeDelta=5&thresholdBlockedGrowthRate=2.5&thresholdBlockedCurrentFloor=4&secondaryPendingLimit=12&autoRejectedAccumulatedLimit=33"
      )
    );

    expect(query).toEqual({
      windowDays: 14,
      source: "qc_retry",
      issueType: "FAST_GATE",
      thresholdBlockedSpikeDelta: 5,
      thresholdBlockedGrowthRate: 2.5,
      thresholdBlockedCurrentFloor: 4,
      secondaryPendingLimit: 12,
      autoRejectedAccumulatedLimit: 33,
    });
  });

  it("should throw when thresholdBlockedGrowthRate is invalid", () => {
    expect(() =>
      parseQcDispatchAlertQuery(new URLSearchParams("thresholdBlockedGrowthRate=0"))
    ).toThrow(ValidationError);
  });

  it("should build alerts for spike and backlog conditions", async () => {
    mockGetQcDispatchMetrics
      .mockResolvedValueOnce(
        buildMetrics({
          autoRejectedEventCount: 10,
          autoRejectedAccumulatedCount: 42,
          thresholdBlockedCount: 10,
          secondaryPendingCount: 18,
        })
      )
      .mockResolvedValueOnce(
        buildMetrics(
          {
            autoRejectedEventCount: 2,
            autoRejectedAccumulatedCount: 5,
            thresholdBlockedCount: 8,
            secondaryPendingCount: 3,
          },
          1
        )
      )
      .mockResolvedValueOnce(
        buildMetrics(
          {
            autoRejectedEventCount: 4,
            autoRejectedAccumulatedCount: 8,
            thresholdBlockedCount: 10,
            secondaryPendingCount: 4,
          },
          2
        )
      );

    const result = await getQcDispatchAlerts({
      bookId: "book-1",
      query: {
        windowDays: 7,
        source: "qc_retry",
        issueType: "FAST_GATE",
        thresholdBlockedSpikeDelta: 3,
        thresholdBlockedGrowthRate: 2,
        thresholdBlockedCurrentFloor: 3,
        secondaryPendingLimit: 10,
        autoRejectedAccumulatedLimit: 30,
      },
    });

    expect(result.alerts.map((item) => item.code)).toEqual([
      "threshold_blocked_spike",
      "secondary_pending_backlog",
      "auto_rejected_accumulated_pressure",
    ]);
    expect(result.alerts[0]).toMatchObject({
      severity: "critical",
    });
    expect(result.snapshot).toMatchObject({
      thresholdBlockedCurrent24h: 8,
      thresholdBlockedPrevious24h: 2,
    });

    expect(mockGetQcDispatchMetrics).toHaveBeenNthCalledWith(1, {
      bookId: "book-1",
      query: {
        windowDays: 7,
        source: "qc_retry",
        issueType: "FAST_GATE",
      },
    });
    expect(mockGetQcDispatchMetrics).toHaveBeenNthCalledWith(2, {
      bookId: "book-1",
      query: {
        windowDays: 1,
        source: "qc_retry",
        issueType: "FAST_GATE",
      },
    });
    expect(mockGetQcDispatchMetrics).toHaveBeenNthCalledWith(3, {
      bookId: "book-1",
      query: {
        windowDays: 2,
        source: "qc_retry",
        issueType: "FAST_GATE",
      },
    });
  });

  it("should return empty alerts when metrics are healthy", async () => {
    mockGetQcDispatchMetrics
      .mockResolvedValueOnce(
        buildMetrics({
          autoRejectedEventCount: 2,
          autoRejectedAccumulatedCount: 12,
          thresholdBlockedCount: 1,
          secondaryPendingCount: 4,
        })
      )
      .mockResolvedValueOnce(
        buildMetrics(
          {
            autoRejectedEventCount: 1,
            autoRejectedAccumulatedCount: 3,
            thresholdBlockedCount: 1,
            secondaryPendingCount: 1,
          },
          1
        )
      )
      .mockResolvedValueOnce(
        buildMetrics(
          {
            autoRejectedEventCount: 2,
            autoRejectedAccumulatedCount: 4,
            thresholdBlockedCount: 2,
            secondaryPendingCount: 2,
          },
          2
        )
      );

    const result = await getQcDispatchAlerts({
      bookId: "book-2",
      query: {
        windowDays: 7,
        thresholdBlockedSpikeDelta: 3,
        thresholdBlockedGrowthRate: 2,
        thresholdBlockedCurrentFloor: 3,
        secondaryPendingLimit: 10,
        autoRejectedAccumulatedLimit: 30,
      },
    });

    expect(result.alerts).toEqual([]);
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 核心 SLO 扫描依赖 mock
// output: 扫描沉淀与通知断言
// pos: S32 告警扫描测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    qcDispatchAlertEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    book: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/slo-alerts/service", () => ({
  getBookSloAlerts: jest.fn(),
}));

jest.mock("@/lib/slo-alerts/notifier", () => ({
  notifySloAlertScan: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { getBookSloAlerts } from "@/lib/slo-alerts/service";
import { notifySloAlertScan } from "@/lib/slo-alerts/notifier";
import { scanSloAlertsForBook, scanSloAlertsForBooks } from "@/lib/slo-alerts/scanner";

const mockFindManyEvents = (prisma as any).qcDispatchAlertEvent.findMany as jest.Mock;
const mockCreateEvent = (prisma as any).qcDispatchAlertEvent.create as jest.Mock;
const mockUpdateEvent = (prisma as any).qcDispatchAlertEvent.update as jest.Mock;
const mockUpdateManyEvents = (prisma as any).qcDispatchAlertEvent.updateMany as jest.Mock;
const mockCountEvents = (prisma as any).qcDispatchAlertEvent.count as jest.Mock;
const mockFindBooks = (prisma as any).book.findMany as jest.Mock;
const mockGetBookSloAlerts = getBookSloAlerts as jest.MockedFunction<typeof getBookSloAlerts>;
const mockNotifySloAlertScan = notifySloAlertScan as jest.MockedFunction<typeof notifySloAlertScan>;

const baseAlertResult = {
  window: {
    days: 7,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-08T00:00:00.000Z",
  },
  filter: {
    source: null,
  },
  thresholds: {
    pipelineSuccessRateMin: 0.95,
    sentencePassRateFirstTryMin: null,
    avgRetryPerSentenceMax: null,
    manualReviewRatioMax: null,
    chapterConsistencyFailRateMax: 0.03,
  },
  snapshot: {
    metrics: {},
    workflowSummary: {},
    qualitySummary: {},
    manualReviewSummary: {},
    chapterAuditSummary: {},
    latestQualityTask: null,
  },
};

describe("slo-alert-scanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create new events and auto resolve stale ones", async () => {
    mockGetBookSloAlerts.mockResolvedValueOnce({
      ...baseAlertResult,
      alerts: [
        {
          code: "slo_pipeline_success_rate_breach",
          severity: "warning",
          metricKey: "pipelineSuccessRate",
          message: "pipeline low",
          recommendedAction: "check pipeline",
          values: {
            current: 0.8,
            threshold: 0.95,
            numerator: 4,
            denominator: 5,
          },
        },
      ],
    } as any);
    mockFindManyEvents.mockResolvedValueOnce([
      {
        id: "evt-stale",
        status: "open",
        fingerprint: "category:slo|code:slo_manual_review_ratio_breach|days:7|source:all",
      },
    ]);
    mockCreateEvent.mockResolvedValueOnce({
      id: "evt-new",
      alertCode: "slo_pipeline_success_rate_breach",
      severity: "warning",
      status: "open",
      triggerCount: 1,
    });
    mockUpdateManyEvents.mockResolvedValueOnce({ count: 1 });
    mockCountEvents.mockResolvedValueOnce(1);
    mockNotifySloAlertScan.mockResolvedValueOnce({
      enabled: true,
      delivered: true,
      channel: "webhook",
      reason: "delivered",
    });

    const result = await scanSloAlertsForBook({
      bookId: "book-1",
      query: {
        windowDays: 7,
        pipelineSuccessRateMin: 0.95,
        sentencePassRateFirstTryMin: null,
        avgRetryPerSentenceMax: null,
        manualReviewRatioMax: null,
        chapterConsistencyFailRateMax: 0.03,
        autoResolveStale: true,
      },
      triggeredBy: "schedule",
    });

    expect(result.mutation).toEqual({
      created: 1,
      reopened: 0,
      updated: 0,
      autoResolved: 1,
      activeCount: 1,
    });
    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueType: "SLO",
          alertCode: "slo_pipeline_success_rate_breach",
        }),
      })
    );
    expect(mockNotifySloAlertScan).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        events: [expect.objectContaining({ id: "evt-new" })],
      })
    );
  });

  it("should reopen acked events instead of creating duplicates", async () => {
    mockGetBookSloAlerts.mockResolvedValueOnce({
      ...baseAlertResult,
      alerts: [
        {
          code: "slo_pipeline_success_rate_breach",
          severity: "critical",
          metricKey: "pipelineSuccessRate",
          message: "pipeline still low",
          recommendedAction: "replay tasks",
          values: {
            current: 0.6,
            threshold: 0.95,
            numerator: 3,
            denominator: 5,
          },
        },
      ],
    } as any);
    mockFindManyEvents.mockResolvedValueOnce([
      {
        id: "evt-acked",
        status: "acked",
        fingerprint: "category:slo|code:slo_pipeline_success_rate_breach|days:7|source:all",
      },
    ]);
    mockUpdateEvent.mockResolvedValueOnce({
      id: "evt-acked",
      alertCode: "slo_pipeline_success_rate_breach",
      severity: "critical",
      status: "open",
      triggerCount: 3,
    });
    mockCountEvents.mockResolvedValueOnce(1);
    mockNotifySloAlertScan.mockResolvedValueOnce({
      enabled: true,
      delivered: false,
      channel: "webhook",
      reason: "no_new_events",
    });

    const result = await scanSloAlertsForBook({
      bookId: "book-1",
      query: {
        windowDays: 7,
        pipelineSuccessRateMin: 0.95,
        sentencePassRateFirstTryMin: null,
        avgRetryPerSentenceMax: null,
        manualReviewRatioMax: null,
        chapterConsistencyFailRateMax: 0.03,
        autoResolveStale: true,
      },
    });

    expect(result.mutation.reopened).toBe(1);
    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-acked" },
        data: expect.objectContaining({
          status: "open",
          ackedAt: null,
        }),
      })
    );
  });

  it("should scan target books and continue on single-book failure", async () => {
    mockFindBooks.mockResolvedValueOnce([{ id: "book-a" }, { id: "book-b" }]);
    mockGetBookSloAlerts
      .mockResolvedValueOnce({
        ...baseAlertResult,
        alerts: [],
      } as any)
      .mockRejectedValueOnce(new Error("mock failure"));
    mockFindManyEvents.mockResolvedValueOnce([]);
    mockCountEvents.mockResolvedValueOnce(0);
    mockNotifySloAlertScan.mockResolvedValueOnce({
      enabled: false,
      delivered: false,
      channel: "none",
      reason: "webhook_not_configured",
    });

    const result = await scanSloAlertsForBooks({
      query: {
        windowDays: 7,
        pipelineSuccessRateMin: 0.95,
        sentencePassRateFirstTryMin: null,
        avgRetryPerSentenceMax: null,
        manualReviewRatioMax: null,
        chapterConsistencyFailRateMax: 0.03,
        autoResolveStale: true,
        maxBooks: 50,
      },
    });

    expect(result.targetBookCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});

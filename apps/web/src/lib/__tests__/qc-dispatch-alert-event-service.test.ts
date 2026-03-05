// 一旦我被更新，请更新我的开头注释
// input: 告警事件服务依赖 mock
// output: 扫描沉淀与生命周期断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    qcDispatchAlertEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    book: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/qc-dispatch-alert-service", () => ({
  ...jest.requireActual("@/lib/qc-dispatch-alert-service"),
  getQcDispatchAlerts: jest.fn(),
}));

jest.mock("@/lib/qc-dispatch-alert-notifier", () => ({
  notifyQcDispatchAlertScan: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { getQcDispatchAlerts } from "@/lib/qc-dispatch-alert-service";
import { notifyQcDispatchAlertScan } from "@/lib/qc-dispatch-alert-notifier";
import {
  parseQcDispatchAlertEventListQuery,
  parseQcDispatchAlertEventResolvePayload,
  resolveQcDispatchAlertEvent,
  scanQcDispatchAlertsForBook,
  scanQcDispatchAlertsForBooks,
} from "@/lib/qc-dispatch-alert-event-service";

const mockFindManyEvents = (prisma as any).qcDispatchAlertEvent.findMany as jest.Mock;
const mockCreateEvent = (prisma as any).qcDispatchAlertEvent.create as jest.Mock;
const mockUpdateEvent = (prisma as any).qcDispatchAlertEvent.update as jest.Mock;
const mockUpdateManyEvents = (prisma as any).qcDispatchAlertEvent.updateMany as jest.Mock;
const mockCountEvents = (prisma as any).qcDispatchAlertEvent.count as jest.Mock;
const mockFindEvent = (prisma as any).qcDispatchAlertEvent.findUnique as jest.Mock;
const mockFindBooks = (prisma as any).book.findMany as jest.Mock;

const mockGetQcDispatchAlerts = getQcDispatchAlerts as jest.MockedFunction<
  typeof getQcDispatchAlerts
>;
const mockNotifyQcDispatchAlertScan = notifyQcDispatchAlertScan as jest.MockedFunction<
  typeof notifyQcDispatchAlertScan
>;

const baseAlertResult = {
  window: {
    days: 7,
    since: "2026-03-01T00:00:00.000Z",
    until: "2026-03-08T00:00:00.000Z",
  },
  filter: {
    source: null,
    issueType: null,
  },
  thresholds: {
    thresholdBlockedSpikeDelta: 3,
    thresholdBlockedGrowthRate: 2,
    thresholdBlockedCurrentFloor: 3,
    secondaryPendingLimit: 10,
    autoRejectedAccumulatedLimit: 30,
  },
  snapshot: {
    windowTotals: {
      autoRejectedEventCount: 3,
      autoRejectedAccumulatedCount: 10,
      thresholdBlockedCount: 5,
      secondaryPendingCount: 12,
    },
    thresholdBlockedCurrent24h: 5,
    thresholdBlockedPrevious24h: 2,
  },
};

describe("qc-dispatch-alert-event-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse list query with normalization", () => {
    const query = parseQcDispatchAlertEventListQuery(
      new URLSearchParams("page=2&limit=15&status=resolved&source=QC_Retry&issueType=fast_gate&alertCode=SECONDARY_PENDING_BACKLOG")
    );

    expect(query).toEqual({
      page: 2,
      limit: 15,
      status: "resolved",
      source: "qc_retry",
      issueType: "FAST_GATE",
      alertCode: "secondary_pending_backlog",
    });
  });

  it("should throw for invalid resolve payload", () => {
    expect(() => parseQcDispatchAlertEventResolvePayload({ action: "reject" })).toThrow(
      ValidationError
    );
  });

  it("should scan alerts and create events with stale auto resolve", async () => {
    mockGetQcDispatchAlerts.mockResolvedValueOnce({
      ...baseAlertResult,
      alerts: [
        {
          code: "secondary_pending_backlog",
          severity: "warning",
          message: "backlog",
          recommendedAction: "check pending",
          values: {
            current: 12,
            threshold: 10,
          },
        },
      ],
    } as any);

    mockFindManyEvents.mockResolvedValueOnce([
      {
        id: "evt-stale",
        bookId: "book-1",
        status: "open",
        fingerprint: "code:threshold_blocked_spike|days:7|source:all|issue:all",
      },
    ]);

    mockCreateEvent.mockResolvedValueOnce({
      id: "evt-new",
      alertCode: "secondary_pending_backlog",
      severity: "warning",
      status: "open",
      triggerCount: 1,
    });
    mockUpdateManyEvents.mockResolvedValueOnce({ count: 1 });
    mockCountEvents.mockResolvedValueOnce(1);
    mockNotifyQcDispatchAlertScan.mockResolvedValueOnce({
      enabled: true,
      delivered: true,
      channel: "webhook",
      reason: "delivered",
    });

    const result = await scanQcDispatchAlertsForBook({
      bookId: "book-1",
      query: {
        windowDays: 7,
        thresholdBlockedSpikeDelta: 3,
        thresholdBlockedGrowthRate: 2,
        thresholdBlockedCurrentFloor: 3,
        secondaryPendingLimit: 10,
        autoRejectedAccumulatedLimit: 30,
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
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockUpdateManyEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ["evt-stale"],
          },
        }),
      })
    );
    expect(mockNotifyQcDispatchAlertScan).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        events: [
          expect.objectContaining({
            id: "evt-new",
            code: "secondary_pending_backlog",
          }),
        ],
      })
    );
  });

  it("should reopen acked events instead of creating duplicates", async () => {
    mockGetQcDispatchAlerts.mockResolvedValueOnce({
      ...baseAlertResult,
      alerts: [
        {
          code: "secondary_pending_backlog",
          severity: "critical",
          message: "still backlog",
          recommendedAction: "drain queue",
          values: {
            current: 20,
            threshold: 10,
          },
        },
      ],
    } as any);

    mockFindManyEvents.mockResolvedValueOnce([
      {
        id: "evt-acked",
        bookId: "book-2",
        status: "acked",
        fingerprint: "code:secondary_pending_backlog|days:7|source:all|issue:all",
      },
    ]);

    mockUpdateEvent.mockResolvedValueOnce({
      id: "evt-acked",
      alertCode: "secondary_pending_backlog",
      severity: "critical",
      status: "open",
      triggerCount: 3,
    });

    mockCountEvents.mockResolvedValueOnce(1);
    mockNotifyQcDispatchAlertScan.mockResolvedValueOnce({
      enabled: true,
      delivered: false,
      channel: "webhook",
      reason: "webhook_status_500",
    });

    const result = await scanQcDispatchAlertsForBook({
      bookId: "book-2",
      query: {
        windowDays: 7,
        thresholdBlockedSpikeDelta: 3,
        thresholdBlockedGrowthRate: 2,
        thresholdBlockedCurrentFloor: 3,
        secondaryPendingLimit: 10,
        autoRejectedAccumulatedLimit: 30,
        autoResolveStale: true,
      },
      triggeredBy: "schedule",
    });

    expect(result.mutation).toEqual({
      created: 0,
      reopened: 1,
      updated: 0,
      autoResolved: 0,
      activeCount: 1,
    });
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

  it("should resolve alert event status by action", async () => {
    mockFindEvent.mockResolvedValueOnce({
      id: "evt-1",
      bookId: "book-1",
      status: "open",
    });
    mockUpdateEvent.mockResolvedValueOnce({
      id: "evt-1",
      bookId: "book-1",
      status: "acked",
      resolutionNote: "manual ack",
    });

    const result = await resolveQcDispatchAlertEvent({
      bookId: "book-1",
      eventId: "evt-1",
      payload: {
        action: "ack",
        note: "manual ack",
      },
    });

    expect(result.item.status).toBe("acked");
    expect(mockUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          status: "acked",
        }),
      })
    );
  });

  it("should scan target books and continue when single book fails", async () => {
    mockFindBooks.mockResolvedValueOnce([{ id: "book-a" }, { id: "book-b" }]);

    mockGetQcDispatchAlerts
      .mockResolvedValueOnce({
        ...baseAlertResult,
        alerts: [],
      } as any)
      .mockRejectedValueOnce(new Error("mock failure"));

    mockFindManyEvents.mockResolvedValueOnce([]);
    mockCountEvents.mockResolvedValueOnce(0);
    mockNotifyQcDispatchAlertScan.mockResolvedValueOnce({
      enabled: false,
      delivered: false,
      channel: "none",
      reason: "webhook_not_configured",
    });

    const result = await scanQcDispatchAlertsForBooks({
      query: {
        windowDays: 7,
        thresholdBlockedSpikeDelta: 3,
        thresholdBlockedGrowthRate: 2,
        thresholdBlockedCurrentFloor: 3,
        secondaryPendingLimit: 10,
        autoRejectedAccumulatedLimit: 30,
        autoResolveStale: true,
        maxBooks: 50,
      },
    });

    expect(result.targetBookCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});

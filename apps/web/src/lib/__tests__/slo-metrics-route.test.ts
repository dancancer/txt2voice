// 一旦我被更新，请更新我的开头注释
// input: 核心 SLO 路由请求/依赖 mock
// output: SLO 指标接口断言
// pos: S32 路由测试
jest.mock("next/server", () => {
  class MockNextResponse {
    body: any;
    status: number;
    headers: Headers;

    constructor(body: any, init: { status?: number; headers?: HeadersInit } = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers);
    }

    static json(data: any, init: { status?: number; headers?: HeadersInit } = {}) {
      return new MockNextResponse(data, init);
    }

    async json() {
      return this.body;
    }
  }

  return {
    NextRequest: class MockNextRequest {},
    NextResponse: MockNextResponse,
  };
});

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/slo-metrics/service", () => ({
  getBookSloMetrics: jest.fn(),
}));

import { GET } from "@/app/api/books/[id]/slo/metrics/route";
import prisma from "@/lib/prisma";
import { getBookSloMetrics } from "@/lib/slo-metrics/service";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockGetBookSloMetrics = getBookSloMetrics as jest.MockedFunction<typeof getBookSloMetrics>;
const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("GET /api/books/[id]/slo/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ id: "book-1" });
  });

  it("should return core slo metrics", async () => {
    mockGetBookSloMetrics.mockResolvedValue({
      window: {
        days: 7,
        since: "2026-03-01T00:00:00.000Z",
        until: "2026-03-07T00:00:00.000Z",
      },
      filter: {
        source: "auto_pipeline",
      },
      metrics: {
        pipelineSuccessRate: {
          kind: "ratio",
          key: "pipeline_success_rate",
          label: "整书完成率",
          value: 1,
          percentage: 100,
          numerator: 1,
          denominator: 1,
          direction: "higher_is_better",
          target: 0.95,
          status: "healthy",
        },
        sentencePassRateFirstTry: null,
        avgRetryPerSentence: null,
        manualReviewRatio: null,
        chapterConsistencyFailRate: null,
      },
      workflowSummary: {
        autoPipeline: {
          total: 1,
          pending: 0,
          processing: 0,
          completed: 1,
          failed: 0,
          pendingReviewHandOffCount: 0,
          directDeliveryCount: 1,
        },
        finalAssembly: {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
        manualReviewSync: {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
        deliveryTerminalCount: 1,
        deliverySuccessCount: 1,
        deliveryFailureCount: 0,
      },
      qualitySummary: {
        sentenceCount: 0,
        firstPassCount: 0,
        manualReviewSentenceCount: 0,
        totalRetryCount: 0,
      },
      manualReviewSummary: {
        createdCount: 0,
        uniqueSentenceCount: 0,
        pendingCount: 0,
        reprocessingCount: 0,
        resolvedCount: 0,
        rejectedCount: 0,
      },
      chapterAuditSummary: {
        total: 0,
        failedCount: 0,
        repairCount: 0,
        manualReviewCount: 0,
      },
      latestQualityTask: null,
    } as any);

    const response: any = await GET(
      {
        url: "http://localhost/api/books/book-1/slo/metrics?days=7&source=auto_pipeline",
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.filter.source).toBe("auto_pipeline");
    expect(mockGetBookSloMetrics).toHaveBeenCalledWith({
      bookId: "book-1",
      query: {
        windowDays: 7,
        source: "auto_pipeline",
      },
    });
  });
});

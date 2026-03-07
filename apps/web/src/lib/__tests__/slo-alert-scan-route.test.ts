// 一旦我被更新，请更新我的开头注释
// input: SLO 扫描路由请求/依赖 mock
// output: 扫描接口断言
// pos: S32 告警路由测试
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

jest.mock("@/lib/slo-alerts/scanner", () => ({
  scanSloAlertsForBooks: jest.fn(),
}));

import { POST } from "@/app/api/slo/alerts/scan/route";
import { scanSloAlertsForBooks } from "@/lib/slo-alerts/scanner";

const mockScanSloAlertsForBooks = scanSloAlertsForBooks as jest.MockedFunction<
  typeof scanSloAlertsForBooks
>;

describe("POST /api/slo/alerts/scan", () => {
  const previousToken = process.env.SLO_ALERT_SCAN_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SLO_ALERT_SCAN_TOKEN = "secret-token";
    mockScanSloAlertsForBooks.mockResolvedValue({
      scanAt: "2026-03-07T00:00:00.000Z",
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
      targetBookCount: 1,
      successCount: 1,
      failedCount: 0,
      results: [],
    } as any);
  });

  afterAll(() => {
    if (previousToken === undefined) {
      delete process.env.SLO_ALERT_SCAN_TOKEN;
      return;
    }
    process.env.SLO_ALERT_SCAN_TOKEN = previousToken;
  });

  it("should reject requests with invalid token", async () => {
    const response: any = await POST({
      url: "http://localhost/api/slo/alerts/scan",
      headers: new Headers(),
      json: async () => ({}),
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("should scan books with normalized query", async () => {
    const response: any = await POST({
      url: "http://localhost/api/slo/alerts/scan?days=7&source=QC_Retry&maxBooks=10",
      headers: new Headers({
        "x-slo-alert-scan-token": "secret-token",
        "x-operator": "cron",
      }),
      json: async () => ({
        bookIds: ["book-1"],
      }),
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockScanSloAlertsForBooks).toHaveBeenCalledWith({
      query: {
        windowDays: 7,
        source: "qc_retry",
        pipelineSuccessRateMin: 0.95,
        sentencePassRateFirstTryMin: null,
        avgRetryPerSentenceMax: null,
        manualReviewRatioMax: null,
        chapterConsistencyFailRateMax: 0.03,
        autoResolveStale: true,
        maxBooks: 10,
      },
      bookIds: ["book-1"],
      triggeredBy: "cron",
    });
  });
});

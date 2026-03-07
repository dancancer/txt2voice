// 一旦我被更新，请更新我的开头注释
// input: 基线路由请求/服务 mock
// output: 基线查询与固化接口断言
// pos: Phase D 路由测试
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

jest.mock("@/lib/qc-baseline-service", () => ({
  getQualityBaselineStateForBook: jest.fn(),
  captureQualityBaselineForBook: jest.fn(),
  parseCaptureQualityBaselinePayload: jest.fn((body: unknown) => body),
}));

import { GET, POST } from "@/app/api/books/[id]/qc/baseline/route";
import {
  captureQualityBaselineForBook,
  getQualityBaselineStateForBook,
} from "@/lib/qc-baseline-service";

const mockGetBaselineState = getQualityBaselineStateForBook as jest.MockedFunction<
  typeof getQualityBaselineStateForBook
>;
const mockCaptureBaseline = captureQualityBaselineForBook as jest.MockedFunction<
  typeof captureQualityBaselineForBook
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("/api/books/[id]/qc/baseline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return baseline state", async () => {
    mockGetBaselineState.mockResolvedValue({
      baselines: [],
      currentSummary: {
        taskId: "task-quality-1",
      },
      bookMetadata: {},
      latestTask: null,
    } as any);

    const response: any = await GET(
      { url: "http://localhost/api/books/book-1/qc/baseline" } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.currentSummary.taskId).toBe("task-quality-1");
    expect(mockGetBaselineState).toHaveBeenCalledWith({
      bookId: "book-1",
      taskId: undefined,
    });
  });

  it("should capture baseline snapshot", async () => {
    mockCaptureBaseline.mockResolvedValue({
      snapshot: {
        id: "baseline-1",
      },
      currentSummary: {
        taskId: "task-quality-1",
      },
      baselineCount: 1,
    } as any);

    const response: any = await POST(
      {
        async json() {
          return {
            label: "phase-d",
          };
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.snapshot.id).toBe("baseline-1");
    expect(mockCaptureBaseline).toHaveBeenCalledWith({
      bookId: "book-1",
      payload: {
        label: "phase-d",
      },
    });
  });
});

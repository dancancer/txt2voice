// 一旦我被更新，请更新我的开头注释
// input: 自动编排启动 HTTP 请求/依赖 mock
// output: preset 接线与单入口断言
// pos: API 路由测试
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

jest.mock("@/lib/auto-pipeline-runner", () => ({
  parseAutoPipelineOptions: jest.fn((value: unknown) =>
    value && typeof value === "object" ? value : {}
  ),
}));

jest.mock("@/lib/auto-pipeline-trigger-service", () => ({
  startAutoPipelineTask: jest.fn(),
}));

jest.mock("@/lib/task-queue", () => ({
  ensureTaskWorkerStarted: jest.fn(),
}));

import { POST } from "@/app/api/books/[id]/pipeline/auto/route";
import { parseAutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import { startAutoPipelineTask } from "@/lib/auto-pipeline-trigger-service";
import { ensureTaskWorkerStarted } from "@/lib/task-queue";

const mockParseOptions = parseAutoPipelineOptions as jest.MockedFunction<
  typeof parseAutoPipelineOptions
>;
const mockStartAutoPipelineTask = startAutoPipelineTask as jest.MockedFunction<
  typeof startAutoPipelineTask
>;
const mockEnsureTaskWorkerStarted = ensureTaskWorkerStarted as jest.MockedFunction<
  typeof ensureTaskWorkerStarted
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

const makeRequest = (body: Record<string, unknown>): any => ({
  async json() {
    return body;
  },
});

describe("POST /api/books/[id]/pipeline/auto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureTaskWorkerStarted.mockResolvedValue(undefined as never);
    mockStartAutoPipelineTask.mockResolvedValue({
      taskId: "task-auto-1",
      reused: false,
      totalStages: 4,
      qualityCheckEnabled: true,
    });
  });

  it("starts the existing auto pipeline route with preset id", async () => {
    const response: any = await POST(
      makeRequest({
        presetId: "zero_touch_voxcpm",
        options: {
          qualityCheck: {
            enabled: true,
          },
        },
      }),
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockParseOptions).toHaveBeenCalledWith({
      qualityCheck: {
        enabled: true,
      },
    });
    expect(mockStartAutoPipelineTask).toHaveBeenCalledWith({
      bookId: "book-1",
      options: {
        qualityCheck: {
          enabled: true,
        },
      },
      presetId: "zero_touch_voxcpm",
      triggerSource: "pipeline_auto_api",
      allowReuseRunningTask: true,
    });
  });
});

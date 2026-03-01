// 一旦我被更新，请更新我的开头注释
// input: 路由请求/环境变量/依赖 mock
// output: 手动重放接口鉴权与行为断言
// pos: API 集成测试
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
    processingTask: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  replayProcessingTask: jest.fn(),
}));

import { POST } from "@/app/api/tasks/[taskId]/replay/route";
import prisma from "@/lib/prisma";
import { replayProcessingTask } from "@/lib/task-queue";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockReplayTask = replayProcessingTask as jest.MockedFunction<
  typeof replayProcessingTask
>;

const ROUTE_PARAMS = { params: Promise.resolve({ taskId: "task-1" }) };

function makeRequest(
  token?: string,
  body: Record<string, unknown> = { force: false }
): any {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("x-txt2voice-replay-token", token);
  }

  return {
    headers,
    url: "http://localhost/api/tasks/task-1/replay",
    async json() {
      return body;
    },
  };
}

describe("POST /api/tasks/[taskId]/replay", () => {
  const ORIGINAL_TOKEN = process.env.TASK_REPLAY_API_TOKEN;

  beforeEach(() => {
    process.env.TASK_REPLAY_API_TOKEN = "dev-replay-token";
    mockFindTask.mockReset();
    mockReplayTask.mockReset();
  });

  afterAll(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.TASK_REPLAY_API_TOKEN;
      return;
    }
    process.env.TASK_REPLAY_API_TOKEN = ORIGINAL_TOKEN;
  });

  it("should reject request without replay token", async () => {
    const response: any = await POST(makeRequest(), ROUTE_PARAMS as any);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockFindTask).not.toHaveBeenCalled();
  });

  it("should reject request with invalid replay token", async () => {
    const response: any = await POST(makeRequest("wrong-token"), ROUTE_PARAMS as any);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(mockFindTask).not.toHaveBeenCalled();
  });

  it("should reject request when replay auth is disabled", async () => {
    delete process.env.TASK_REPLAY_API_TOKEN;

    const response: any = await POST(
      makeRequest("dev-replay-token"),
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("REPLAY_DISABLED");
    expect(mockFindTask).not.toHaveBeenCalled();
  });

  it("should replay task when token is valid", async () => {
    mockFindTask.mockResolvedValue({
      id: "task-1",
      bookId: "book-1",
      taskType: "SCRIPT_GENERATION",
      status: "failed",
    });

    mockReplayTask.mockResolvedValue({
      taskId: "task-1",
      taskType: "SCRIPT_GENERATION",
      jobId: "task-1",
      reused: false,
      reason: "manual_api_replay",
    });

    const response: any = await POST(
      makeRequest("dev-replay-token", { force: false }),
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      taskId: "task-1",
      taskType: "SCRIPT_GENERATION",
      bookId: "book-1",
      reused: false,
    });

    expect(mockFindTask).toHaveBeenCalledWith({
      where: { id: "task-1" },
      select: {
        id: true,
        bookId: true,
        taskType: true,
        status: true,
      },
    });

    expect(mockReplayTask).toHaveBeenCalledWith("task-1", {
      force: false,
      reason: "manual_api_replay",
    });
  });
});

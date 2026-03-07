// 一旦我被更新，请更新我的开头注释
// input: 合并路由请求/依赖 mock
// output: FINAL_ASSEMBLY 任务创建断言
// pos: S31 路由测试
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
  return { NextRequest: class MockNextRequest {}, NextResponse: MockNextResponse };
});

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: { findUnique: jest.fn() },
    processingTask: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    audioFile: { findMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock("@/lib/task-queue/ops/auto-pipeline-enqueue", () => ({
  enqueueAutoPipelineJobInternal: jest.fn(),
}));

jest.mock("@/lib/task-queue", () => ({
  ensureTaskWorkerStarted: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
}));

import { POST } from "@/app/api/books/[id]/audio/merge/route";
import prisma from "@/lib/prisma";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockEnqueueWorkflow = enqueueAutoPipelineJobInternal as jest.MockedFunction<
  typeof enqueueAutoPipelineJobInternal
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("POST /api/books/[id]/audio/merge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ id: "book-1", status: "manual_review_pending", _count: { audioFiles: 3 } });
    mockFindTask.mockResolvedValue(null);
    mockCreateTask.mockResolvedValue({ id: "assembly-task-1" });
    mockEnqueueWorkflow.mockResolvedValue({ jobId: "assembly-task-1", dedupeKey: "workflow", reused: false, state: "waiting" });
  });

  it("should create final assembly task instead of synchronous merge", async () => {
    const response: any = await POST(
      {
        async json() {
          return { type: "book", options: { format: "mp3" } };
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      taskId: "assembly-task-1",
      taskType: "FINAL_ASSEMBLY",
      type: "book",
    });
    expect(mockEnqueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "assembly-task-1",
        mode: "final_assembly",
      }),
      expect.objectContaining({
        reason: "audio_merge_api",
      })
    );
  });

  it("should reject invalid merge type before creating a task", async () => {
    const response: any = await POST(
      {
        async json() {
          return { type: "foo" };
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("无效的合并类型");
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflow).not.toHaveBeenCalled();
  });
});

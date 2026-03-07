// 一旦我被更新，请更新我的开头注释
// input: 信号生产路由请求/服务依赖 mock
// output: 信号生产接口断言
// pos: S30.1 路由测试
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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueQualitySignalSyncJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  formatProcessingTask: jest.fn((task: any) => ({
    ...task,
    message: task.taskData?.message || null,
    metadata: task.taskData?.metadata || null,
    error: task.errorMessage || null,
  })),
}));

import { GET, POST } from "@/app/api/books/[id]/qc/signals/sync/route";
import prisma from "@/lib/prisma";
import { enqueueQualitySignalSyncJob } from "@/lib/task-queue";

const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;
const mockEnqueueSignalSync = enqueueQualitySignalSyncJob as jest.MockedFunction<
  typeof enqueueQualitySignalSyncJob
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("/api/books/[id]/qc/signals/sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create and enqueue signal sync task", async () => {
    mockFindTask.mockResolvedValueOnce(null);
    mockAudioCount.mockResolvedValueOnce(3);
    mockCreateTask.mockResolvedValueOnce({ id: "signal-task-1" });
    mockEnqueueSignalSync.mockResolvedValueOnce({
      jobId: "signal-task-1",
      dedupeKey: "signal_sync:book-1:hash",
      reused: false,
      state: "waiting",
    });

    const response: any = await POST(
      {
        async json() {
          return {
            type: "book",
            forceResync: true,
          };
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      taskId: "signal-task-1",
      type: "book",
      totalItems: 3,
      forceResync: true,
    });
    expect(mockEnqueueSignalSync).toHaveBeenCalledWith(
      {
        taskId: "signal-task-1",
        bookId: "book-1",
        type: "book",
        chapterId: undefined,
        audioFileIds: undefined,
        forceResync: true,
      },
      {
        reason: "qc_signal_sync_api",
      }
    );
  });

  it("should return latest signal sync task", async () => {
    mockFindTask.mockResolvedValueOnce({
      id: "signal-task-2",
      taskData: {
        message: "完成",
        metadata: {
          source: "quality_signal_sync",
        },
      },
      errorMessage: null,
    });

    const response: any = await GET(
      { url: "http://localhost/api/books/book-1/qc/signals/sync" } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.latestTask).toEqual(
      expect.objectContaining({
        id: "signal-task-2",
        metadata: expect.objectContaining({
          source: "quality_signal_sync",
        }),
      })
    );
  });
});

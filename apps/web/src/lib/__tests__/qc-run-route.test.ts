// 一旦我被更新，请更新我的开头注释
// input: 质检路由请求/依赖 mock
// output: 默认前置信号同步参数断言
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
  Prisma: {},
  default: {
    book: {
      findUnique: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      count: jest.fn(),
    },
    manualReviewItem: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueQualityCheckJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  formatProcessingTask: jest.fn((task: any) => task),
}));

import { POST } from "@/app/api/books/[id]/qc/run/route";
import prisma from "@/lib/prisma";
import { enqueueQualityCheckJob } from "@/lib/task-queue";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;
const mockEnqueueQualityCheck = enqueueQualityCheckJob as jest.MockedFunction<
  typeof enqueueQualityCheckJob
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("POST /api/books/[id]/qc/run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ id: "book-1", status: "completed" });
    mockFindTask.mockResolvedValue(null);
    mockAudioCount.mockResolvedValue(2);
    mockCreateTask.mockResolvedValue({ id: "qc-task-1" });
    mockEnqueueQualityCheck.mockResolvedValue({
      jobId: "qc-task-1",
      dedupeKey: "quality:book-1:hash",
      reused: false,
      state: "waiting",
    });
  });

  it("should create qc task with signal sync defaults and payloads", async () => {
    const response: any = await POST(
      {
        async json() {
          return {
            type: "batch",
            audioFileIds: ["audio-1", "audio-2"],
            signalPayloadByAudioFileId: {
              "audio-1": {
                cer: 0.08,
              },
            },
          };
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "QUALITY_CHECK",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            syncSignalsBeforeRun: true,
            forceSignalResync: false,
            signalPayloadByAudioFileId: {
              "audio-1": {
                cer: 0.08,
              },
            },
          }),
        }),
      }),
    });
  });
});

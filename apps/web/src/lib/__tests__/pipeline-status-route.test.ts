// 一旦我被更新，请更新我的开头注释
// input: 状态查询请求/任务与书籍 mock
// output: 上传触发来源与阶段状态断言
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
    book: {
      findUnique: jest.fn(),
    },
    manualReviewItem: {
      count: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { GET } from "@/app/api/books/[id]/pipeline/status/route";
import prisma from "@/lib/prisma";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockCountReviewItems = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockFindTasks = (prisma as any).processingTask.findMany as jest.Mock;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

describe("GET /api/books/[id]/pipeline/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountReviewItems.mockResolvedValue(2);
    mockFindTasks.mockResolvedValue([]);
  });

  it("should expose upload trigger source and stage summary", async () => {
    mockFindBook.mockResolvedValue({
      id: "book-1",
      status: "processing",
      metadata: {
        autoPipeline: {
          lastTrigger: {
            source: "upload_api",
          },
        },
        qualityCheck: {
          checked: 12,
        },
      },
      _count: {
        chapters: 1,
        textSegments: 4,
        scriptSentences: 8,
        audioFiles: 8,
        qualityCheckResults: 8,
      },
    });
    mockFindTask
      .mockResolvedValueOnce({
        id: "task-auto-1",
        bookId: "book-1",
        taskType: "AUTO_PIPELINE",
        status: "processing",
        progress: 50,
        totalItems: 4,
        processedItems: 2,
        taskData: {
          message: "进行中",
          metadata: {
            currentStage: "audio_generation",
            triggerSource: "upload_api",
            stages: {
              text_processing: {
                taskId: "stage-text-1",
                status: "completed",
                startedAt: "2026-03-06T12:00:00.000Z",
                completedAt: "2026-03-06T12:00:05.000Z",
              },
              audio_generation: {
                taskId: "stage-audio-1",
                status: "processing",
                startedAt: "2026-03-06T12:00:06.000Z",
              },
            },
          },
        },
        errorMessage: null,
        startedAt: new Date("2026-03-06T12:00:00.000Z"),
        completedAt: null,
        createdAt: new Date("2026-03-06T12:00:00.000Z"),
        updatedAt: new Date("2026-03-06T12:00:10.000Z"),
        externalTaskId: null,
      })
      .mockResolvedValueOnce(null);
    mockFindTasks.mockResolvedValueOnce([
      {
        id: "stage-text-1",
        bookId: "book-1",
        taskType: "TEXT_PROCESSING",
        status: "completed",
        progress: 100,
        totalItems: 1,
        processedItems: 1,
        taskData: { message: "文本处理完成", metadata: {} },
        errorMessage: null,
        startedAt: new Date("2026-03-06T12:00:00.000Z"),
        completedAt: new Date("2026-03-06T12:00:05.000Z"),
        createdAt: new Date("2026-03-06T12:00:00.000Z"),
        updatedAt: new Date("2026-03-06T12:00:05.000Z"),
        externalTaskId: null,
      },
      {
        id: "stage-audio-1",
        bookId: "book-1",
        taskType: "AUDIO_GENERATION",
        status: "processing",
        progress: 40,
        totalItems: 8,
        processedItems: 3,
        taskData: { message: "音频生成中", metadata: {} },
        errorMessage: null,
        startedAt: new Date("2026-03-06T12:00:06.000Z"),
        completedAt: null,
        createdAt: new Date("2026-03-06T12:00:06.000Z"),
        updatedAt: new Date("2026-03-06T12:00:10.000Z"),
        externalTaskId: null,
      },
    ]);

    const response: any = await GET(
      { url: "http://localhost/api/books/book-1/pipeline/status" } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.latestUploadTriggerSource).toBe("upload_api");
    expect(payload.data.currentStage).toBe("audio_generation");
    expect(payload.data.pendingReviewCount).toBe(2);
    expect(payload.data.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "text_processing",
          status: "completed",
          durationMs: 5000,
        }),
        expect.objectContaining({
          key: "audio_generation",
          status: "processing",
          progress: 40,
        }),
      ])
    );
  });
});

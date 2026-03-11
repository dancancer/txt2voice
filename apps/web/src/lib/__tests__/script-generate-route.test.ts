// 一旦我被更新，请更新我的开头注释
// input: 台本生成路由请求/依赖 mock
// output: manual_review_pending 重跑门禁断言
// pos: 台本生成路由测试
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
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    manualReviewItem: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueScriptGenerationJob: jest.fn(),
}));

import { POST } from "@/app/api/books/[id]/script/generate/route";
import prisma from "@/lib/prisma";
import { enqueueScriptGenerationJob } from "@/lib/task-queue";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockFindBlockingReview = (prisma as any).manualReviewItem.findFirst as jest.Mock;
const mockEnqueueScript = enqueueScriptGenerationJob as jest.MockedFunction<
  typeof enqueueScriptGenerationJob
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };

const buildBook = (status: string) => ({
  id: "book-1",
  status,
  characterProfiles: [],
  textSegments: [
    {
      id: "segment-1",
      orderIndex: 0,
      content: "第一段原文",
    },
  ],
  scriptSentences: [],
});

describe("POST /api/books/[id]/script/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue(buildBook("manual_review_pending"));
    mockFindTask.mockResolvedValue(null);
    mockFindBlockingReview.mockResolvedValue(null);
    mockCreateTask.mockResolvedValue({ id: "script-task-1" });
    mockUpdateBook.mockResolvedValue({});
    mockEnqueueScript.mockResolvedValue({
      jobId: "script-task-1",
      dedupeKey: "script:book-1",
      reused: false,
      state: "waiting",
    });
  });

  it("should reject rerun when manual review queue still has non script validation items", async () => {
    mockFindBlockingReview.mockResolvedValue({
      id: "review-audio-1",
      issueType: "AUDIO",
    });

    const response: any = await POST(
      {
        async json() {
          return {};
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toContain("非台本校验复核项");
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueScript).not.toHaveBeenCalled();
  });

  it("should allow rerun from manual_review_pending when only script validation items remain", async () => {
    const response: any = await POST(
      {
        async json() {
          return {};
        },
      } as any,
      ROUTE_PARAMS as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      taskId: "script-task-1",
      bookStatus: "generating_script",
    });
    expect(mockCreateTask).toHaveBeenCalled();
    expect(mockEnqueueScript).toHaveBeenCalled();
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 上传路由请求/依赖 mock/测试书样本
// output: 上传主链路与补偿链路断言
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

jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/api-utils", () => ({
  sanitizeFilename: jest.fn((value: string) => value.replace(/\s+/g, "_")),
  validateFilePath: jest.fn(() => true),
  validateBookExists: jest.fn(),
}));

jest.mock("@/lib/storage-path", () => ({
  getBookUploadDir: jest.fn(() => "/tmp/txt2voice-test/books/book-1"),
}));

jest.mock("@/lib/auto-pipeline-runner", () => ({
  parseAutoPipelineOptions: jest.fn((value: unknown) => (value && typeof value === "object" ? value : {})),
}));

jest.mock("@/lib/auto-pipeline-trigger-service", () => ({
  startAutoPipelineTask: jest.fn(),
  scheduleAutoPipelineCompensationTask: jest.fn(),
}));

jest.mock("@/lib/task-queue", () => ({
  ensureTaskWorkerStarted: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { readFileSync } from "fs";
import { join } from "path";
import { POST } from "@/app/api/books/[id]/upload/route";
import prisma from "@/lib/prisma";
import { validateBookExists } from "@/lib/api-utils";
import {
  scheduleAutoPipelineCompensationTask,
  startAutoPipelineTask,
} from "@/lib/auto-pipeline-trigger-service";
import { ensureTaskWorkerStarted } from "@/lib/task-queue";

const mockBookUpdate = (prisma as any).book.update as jest.Mock;
const mockValidateBookExists = validateBookExists as jest.MockedFunction<
  typeof validateBookExists
>;
const mockStartAutoPipelineTask = startAutoPipelineTask as jest.MockedFunction<
  typeof startAutoPipelineTask
>;
const mockScheduleCompensationTask =
  scheduleAutoPipelineCompensationTask as jest.MockedFunction<
    typeof scheduleAutoPipelineCompensationTask
  >;
const mockEnsureTaskWorkerStarted = ensureTaskWorkerStarted as jest.MockedFunction<
  typeof ensureTaskWorkerStarted
>;

const ROUTE_PARAMS = { params: Promise.resolve({ id: "book-1" }) };
const SAMPLE_TEXT = readFileSync(
  join(process.cwd(), "../../uploads/sample.txt"),
  "utf-8"
);

const makeRequest = (overrides?: {
  autoPipelineEnabled?: string;
  autoPipelineOptions?: Record<string, unknown>;
}) => {
  const entries = new Map<string, any>([
    [
      "file",
      {
        name: "sample.txt",
        size: Buffer.byteLength(SAMPLE_TEXT, "utf-8"),
        async arrayBuffer() {
          const buffer = Buffer.from(SAMPLE_TEXT, "utf-8");
          return buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          );
        },
      },
    ],
  ]);

  if (overrides?.autoPipelineEnabled !== undefined) {
    entries.set("autoPipelineEnabled", overrides.autoPipelineEnabled);
  }

  if (overrides?.autoPipelineOptions !== undefined) {
    entries.set("autoPipelineOptions", JSON.stringify(overrides.autoPipelineOptions));
  }

  return {
    async formData() {
      return {
        get(key: string) {
          return entries.get(key) ?? null;
        },
      };
    },
  } as any;
};

describe("POST /api/books/[id]/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateBookExists.mockResolvedValue({ id: "book-1" } as any);
    mockBookUpdate.mockResolvedValue({
      id: "book-1",
      updatedAt: new Date("2026-03-06T12:00:00.000Z"),
    });
    mockEnsureTaskWorkerStarted.mockResolvedValue(undefined as never);
  });

  it("should upload sample file and trigger auto pipeline", async () => {
    mockStartAutoPipelineTask.mockResolvedValue({
      taskId: "task-auto-1",
      reused: false,
      totalStages: 4,
      qualityCheckEnabled: true,
    });

    const response: any = await POST(makeRequest(), ROUTE_PARAMS as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.originalFilename).toBe("sample.txt");
    expect(payload.data.contentPreview).toContain("第一章");
    expect(payload.data.autoPipeline).toEqual(
      expect.objectContaining({
        enabled: true,
        triggered: true,
        taskId: "task-auto-1",
        totalStages: 4,
        qualityCheckEnabled: true,
        compensationTaskId: null,
        compensationScheduled: false,
        warning: null,
      })
    );
    expect(mockEnsureTaskWorkerStarted).toHaveBeenCalledTimes(1);
    expect(mockStartAutoPipelineTask).toHaveBeenCalledWith({
      bookId: "book-1",
      options: {},
      triggerSource: "upload_api",
      triggerMetadata: {
        filename: "sample.txt",
        size: expect.any(Number),
        uploadedAt: "2026-03-06T12:00:00.000Z",
      },
      allowReuseRunningTask: true,
    });
    expect(mockScheduleCompensationTask).not.toHaveBeenCalled();
  });

  it("should schedule compensation task when auto pipeline trigger fails", async () => {
    mockStartAutoPipelineTask.mockRejectedValue(new Error("redis down"));
    mockScheduleCompensationTask.mockResolvedValue({
      taskId: "task-comp-1",
      status: "scheduled",
    });

    const response: any = await POST(makeRequest(), ROUTE_PARAMS as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.autoPipeline).toEqual(
      expect.objectContaining({
        enabled: true,
        triggered: false,
        taskId: null,
        compensationTaskId: "task-comp-1",
        compensationScheduled: true,
        warning: "redis down",
      })
    );
    expect(mockScheduleCompensationTask).toHaveBeenCalledWith({
      bookId: "book-1",
      options: {},
      originalTriggerSource: "upload_api",
      triggerMetadata: {
        filename: "sample.txt",
        size: expect.any(Number),
        uploadedAt: "2026-03-06T12:00:00.000Z",
      },
      triggerFailure: "redis down",
    });
  });
});

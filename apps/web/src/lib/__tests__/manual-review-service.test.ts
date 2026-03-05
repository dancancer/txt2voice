// 一旦我被更新，请更新我的开头注释
// input: 查询参数/复核动作/服务依赖 mock
// output: 人工复核服务行为断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    manualReviewItem: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueAudioGenerationJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { enqueueAudioGenerationJob } from "@/lib/task-queue";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  listManualReviewItems,
  parseManualReviewQuery,
  parseManualReviewResolvePayload,
  resolveManualReviewItem,
} from "@/lib/manual-review-service";

const mockCount = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindMany = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockFindUnique = (prisma as any).manualReviewItem.findUnique as jest.Mock;
const mockUpdate = (prisma as any).manualReviewItem.update as jest.Mock;
const mockFindFirstTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockEnqueueAudio = enqueueAudioGenerationJob as jest.MockedFunction<
  typeof enqueueAudioGenerationJob
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

const baseItem = (overrides: Record<string, unknown> = {}) => ({
  id: "review-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-1",
  sentenceId: "sentence-1",
  audioFileId: "audio-1",
  attemptId: "attempt-1",
  qcResultId: "qc-1",
  issueType: "FAST_GATE",
  priority: "normal",
  status: "pending",
  issueDetail: {
    reasons: ["pace_too_fast"],
    repairPlan: ["decrease_speed_0.05"],
    score: 72,
  },
  assignedTo: null,
  resolutionType: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: new Date("2026-03-05T12:40:00.000Z"),
  updatedAt: new Date("2026-03-05T12:40:00.000Z"),
  scriptSentence: {
    id: "sentence-1",
    text: "样例台词",
    roleType: "dialogue",
    emotionLabel: "calm",
    priority: "high",
  },
  audioFile: {
    id: "audio-1",
    fileName: "a1.mp3",
    duration: 3.22,
    status: "completed",
    qualityScore: 72.5,
    qualityVerdict: "repair",
    qualityStatus: "repair",
  },
  qualityCheckResult: {
    id: "qc-1",
    verdict: "manual_review",
    score: 72.5,
    hardFail: false,
    reasons: ["pace_too_fast"],
    detail: { repairPlan: ["decrease_speed_0.05"] },
    createdAt: new Date("2026-03-05T12:41:00.000Z"),
  },
  ...overrides,
});

describe("manual-review-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse query with default pending status", () => {
    const query = parseManualReviewQuery(new URLSearchParams("page=2&limit=10"));

    expect(query).toMatchObject({
      page: 2,
      limit: 10,
      offset: 10,
      status: "pending",
    });
  });

  it("should throw when query status is invalid", () => {
    expect(() =>
      parseManualReviewQuery(new URLSearchParams("status=invalid"))
    ).toThrow(ValidationError);
  });

  it("should normalize resolve action aliases", () => {
    const payload = parseManualReviewResolvePayload({
      action: "重生",
      note: "重跑并复听",
      provider: "voxcpm",
    });

    expect(payload).toMatchObject({
      action: "regenerate",
      note: "重跑并复听",
      provider: "voxcpm",
      autoMerge: false,
    });
  });

  it("should list manual review items with summary", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    mockFindMany.mockResolvedValueOnce([baseItem()]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
    });

    expect(result.data).toHaveLength(1);
    expect(result.summary).toMatchObject({
      pendingCount: 3,
      reprocessingCount: 1,
      resolvedCount: 4,
      rejectedCount: 2,
      total: 10,
    });
    expect(mockCount).toHaveBeenNthCalledWith(1, {
      where: {
        bookId: "book-1",
        status: "pending",
      },
    });
  });

  it("should resolve item as approved", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockUpdate.mockResolvedValueOnce(
      baseItem({
        status: "resolved",
        resolutionType: "approved",
        resolutionNote: "人工确认通过",
        resolvedAt: new Date("2026-03-05T13:00:00.000Z"),
      })
    );

    const result = await resolveManualReviewItem({
      bookId: "book-1",
      itemId: "review-1",
      payload: {
        action: "approve",
        note: "人工确认通过",
        autoMerge: false,
      },
    });

    expect(result.retryTask).toBeNull();
    expect(result.item.status).toBe("resolved");
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueAudio).not.toHaveBeenCalled();
  });

  it("should enqueue single audio retry for regenerate action", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-retry-1",
      status: "processing",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-retry-1",
      dedupeKey: "audio:single:sentence-1",
      reused: false,
      state: "waiting",
    });
    mockUpdate.mockResolvedValueOnce(
      baseItem({
        status: "reprocessing",
        resolutionType: "regenerate",
        resolutionNote: "retry_task:task-retry-1",
      })
    );

    const result = await resolveManualReviewItem({
      bookId: "book-1",
      itemId: "review-1",
      payload: {
        action: "regenerate",
        note: undefined,
        assignedTo: "qa-1",
        voiceProfileId: "voice-1",
        provider: "voxcpm",
        autoMerge: false,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUDIO_GENERATION",
      }),
    });
    expect(mockEnqueueAudio).toHaveBeenCalledWith({
      taskId: "task-retry-1",
      bookId: "book-1",
      type: "single",
      scriptSentenceIds: ["sentence-1"],
      voiceProfileId: "voice-1",
      autoMerge: false,
      options: {
        provider: "voxcpm",
        skipExisting: false,
        overwriteExisting: true,
      },
    });
    expect(result.retryTask).toMatchObject({
      taskId: "task-retry-1",
      taskType: "AUDIO_GENERATION",
      status: "processing",
    });
    expect(result.item.status).toBe("reprocessing");
  });

  it("should fail regenerate when item has no sentenceId", async () => {
    mockFindUnique.mockResolvedValueOnce(
      baseItem({
        sentenceId: null,
      })
    );

    await expect(
      resolveManualReviewItem({
        bookId: "book-1",
        itemId: "review-1",
        payload: {
          action: "regenerate",
          autoMerge: false,
        },
      })
    ).rejects.toThrow("当前复核项缺少 sentenceId");
  });

  it("should mark retry task failed when enqueue fails", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-retry-2",
      status: "processing",
    });
    mockEnqueueAudio.mockRejectedValueOnce(new Error("queue down"));
    mockMergeTaskData.mockResolvedValueOnce({
      message: "人工复核重生任务入队失败",
    } as any);
    mockUpdateTask.mockResolvedValueOnce({});

    await expect(
      resolveManualReviewItem({
        bookId: "book-1",
        itemId: "review-1",
        payload: {
          action: "regenerate",
          autoMerge: false,
        },
      })
    ).rejects.toThrow("queue down");

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "task-retry-2" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "queue down",
      }),
    });
  });
});

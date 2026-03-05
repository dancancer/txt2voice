// 一旦我被更新，请更新我的开头注释
// input: 手工复核重生任务上下文/音频执行结果 mock
// output: 自动质检触发与状态回流断言
// pos: 任务执行器测试
jest.mock("@/lib/audio-generator", () => ({
  getAudioGenerator: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    manualReviewItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(),
  updateProcessingTaskProgress: jest.fn(),
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueQualityCheckJob: jest.fn(),
}));

import { getAudioGenerator } from "@/lib/audio-generator";
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueQualityCheckJob } from "@/lib/task-queue";
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";

const mockGetAudioGenerator = getAudioGenerator as jest.MockedFunction<typeof getAudioGenerator>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;
const mockEnqueueQualityCheck = enqueueQualityCheckJob as jest.MockedFunction<
  typeof enqueueQualityCheckJob
>;

const mockProcessingTaskFindUnique = (prisma as any).processingTask.findUnique as jest.Mock;
const mockProcessingTaskUpdate = (prisma as any).processingTask.update as jest.Mock;
const mockProcessingTaskCreate = (prisma as any).processingTask.create as jest.Mock;
const mockManualReviewFindFirst = (prisma as any).manualReviewItem.findFirst as jest.Mock;
const mockManualReviewFindMany = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockManualReviewUpdate = (prisma as any).manualReviewItem.update as jest.Mock;
const mockBookFindUnique = (prisma as any).book.findUnique as jest.Mock;
const mockBookUpdate = (prisma as any).book.update as jest.Mock;
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;

describe("runAudioGenerationTask manual review followup", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
    mockBookFindUnique.mockResolvedValue({ metadata: {} });
    mockAudioCount.mockResolvedValue(8);
    mockBookUpdate.mockResolvedValue({});
    mockProcessingTaskUpdate.mockResolvedValue({});
    mockProcessingTaskCreate.mockResolvedValue({ id: "qc-task-1" });
    mockManualReviewFindFirst.mockResolvedValue(null);
    mockManualReviewFindMany.mockResolvedValue([]);
    mockManualReviewUpdate.mockResolvedValue({});
  });

  it("should enqueue followup quality check when regenerate succeeds", async () => {
    mockProcessingTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "manual_review",
          manualReviewItemId: "review-1",
        },
      },
    });

    mockGetAudioGenerator.mockReturnValue({
      generateSingleAudio: jest.fn().mockResolvedValue({
        success: true,
        audioFileId: "audio-1",
        duration: 3.2,
      }),
    } as any);

    mockEnqueueQualityCheck.mockResolvedValue({
      jobId: "qc-task-1",
      dedupeKey: "quality:batch:audio-1",
      reused: false,
      state: "waiting",
    });

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-1",
      type: "single",
      scriptSentenceIds: ["sentence-1"],
      options: {
        provider: "voxcpm",
      },
    });

    expect(mockProcessingTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "QUALITY_CHECK",
        totalItems: 1,
      }),
    });
    expect(mockEnqueueQualityCheck).toHaveBeenCalledWith({
      taskId: "qc-task-1",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });
    expect(mockManualReviewUpdate).not.toHaveBeenCalled();
  });

  it("should reject reprocessing item when regenerate fails", async () => {
    mockProcessingTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "manual_review",
          manualReviewItemId: "review-2",
        },
      },
    });

    mockGetAudioGenerator.mockReturnValue({
      generateSingleAudio: jest.fn().mockResolvedValue({
        success: false,
        error: "tts failed",
      }),
    } as any);

    mockManualReviewFindFirst.mockResolvedValue({
      id: "review-2",
      resolutionNote: "retry_task:task-audio-2",
    });

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-2",
      type: "single",
      scriptSentenceIds: ["sentence-2"],
    });

    expect(mockProcessingTaskCreate).not.toHaveBeenCalled();
    expect(mockManualReviewUpdate).toHaveBeenCalledWith({
      where: { id: "review-2" },
      data: expect.objectContaining({
        status: "rejected",
        resolutionType: "regenerate_failed",
      }),
    });
  });

  it("should enqueue followup quality check for qc_retry source", async () => {
    mockProcessingTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "qc_retry",
          selectedReviewItemIds: ["review-11", "review-12"],
        },
      },
    });

    mockGetAudioGenerator.mockReturnValue({
      generateBatchAudio: jest.fn().mockResolvedValue([
        {
          success: true,
          audioFileId: "audio-11",
          duration: 2.8,
        },
        {
          success: true,
          audioFileId: "audio-12",
          duration: 3.1,
        },
      ]),
    } as any);

    mockEnqueueQualityCheck.mockResolvedValue({
      jobId: "qc-task-qc-retry",
      dedupeKey: "quality:batch:audio-11,audio-12",
      reused: false,
      state: "waiting",
    });

    mockProcessingTaskCreate.mockResolvedValueOnce({
      id: "qc-task-qc-retry",
    });

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-qc-retry",
      type: "batch",
      scriptSentenceIds: ["sentence-11", "sentence-12"],
      options: {
        provider: "voxcpm",
      },
    });

    expect(mockProcessingTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "QUALITY_CHECK",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            source: "qc_retry",
            retryReviewItemIds: ["review-11", "review-12"],
            autoCreatePendingOnReject: true,
            maxAutoRejectedCount: 2,
            issueTypePolicies: {},
          }),
        }),
      }),
    });
    expect(mockEnqueueQualityCheck).toHaveBeenCalledWith({
      taskId: "qc-task-qc-retry",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-11", "audio-12"],
    });
    expect(mockManualReviewUpdate).not.toHaveBeenCalled();
  });

  it("should forward qc_retry dispatch policy to followup quality task", async () => {
    mockProcessingTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "qc_retry",
          selectedReviewItemIds: ["review-31"],
          autoCreatePendingOnReject: false,
          maxAutoRejectedCount: 4,
          issueTypePolicies: {
            FAST_GATE: {
              autoCreatePendingOnReject: true,
              maxAutoRejectedCount: 2,
            },
          },
        },
      },
    });

    mockGetAudioGenerator.mockReturnValue({
      generateBatchAudio: jest.fn().mockResolvedValue([
        {
          success: true,
          audioFileId: "audio-31",
          duration: 3.6,
        },
      ]),
    } as any);

    mockEnqueueQualityCheck.mockResolvedValue({
      jobId: "qc-task-qc-retry-policy",
      dedupeKey: "quality:batch:audio-31",
      reused: false,
      state: "waiting",
    });

    mockProcessingTaskCreate.mockResolvedValueOnce({
      id: "qc-task-qc-retry-policy",
    });

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-qc-retry-policy",
      type: "batch",
      scriptSentenceIds: ["sentence-31"],
    });

    expect(mockProcessingTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            autoCreatePendingOnReject: false,
            maxAutoRejectedCount: 4,
            issueTypePolicies: {
              FAST_GATE: {
                autoCreatePendingOnReject: true,
                maxAutoRejectedCount: 2,
              },
            },
          }),
        }),
      }),
    });
  });

  it("should reject qc_retry items when generated audio is empty", async () => {
    mockProcessingTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "qc_retry",
          selectedReviewItemIds: ["review-21", "review-22"],
        },
      },
    });

    mockGetAudioGenerator.mockReturnValue({
      generateBatchAudio: jest.fn().mockResolvedValue([
        {
          success: false,
          error: "tts failed",
        },
        {
          success: false,
          error: "voice unavailable",
        },
      ]),
    } as any);

    mockManualReviewFindMany.mockResolvedValue([
      {
        id: "review-21",
        resolutionNote: "qc_retry_task:task-audio-qc-retry-fail",
      },
      {
        id: "review-22",
        resolutionNote: null,
      },
    ]);

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-qc-retry-fail",
      type: "batch",
      scriptSentenceIds: ["sentence-21", "sentence-22"],
    });

    expect(mockProcessingTaskCreate).not.toHaveBeenCalled();
    expect(mockManualReviewUpdate).toHaveBeenCalledTimes(2);
    expect(mockManualReviewUpdate).toHaveBeenCalledWith({
      where: { id: "review-21" },
      data: expect.objectContaining({
        status: "rejected",
        resolutionType: "batch_regenerate_failed",
      }),
    });
  });
});

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
});

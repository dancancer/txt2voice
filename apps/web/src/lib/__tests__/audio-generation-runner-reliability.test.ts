// 一旦我被更新，请更新我的开头注释
// input: 音频任务上下文/带可靠性摘要的 generator mock
// output: runner 回写 reliability metadata 断言
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
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";

const mockGetAudioGenerator = getAudioGenerator as jest.MockedFunction<
  typeof getAudioGenerator
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;
const mockProcessingTaskFindUnique = (prisma as any).processingTask.findUnique as jest.Mock;
const mockProcessingTaskUpdate = (prisma as any).processingTask.update as jest.Mock;
const mockBookFindUnique = (prisma as any).book.findUnique as jest.Mock;
const mockBookUpdate = (prisma as any).book.update as jest.Mock;
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;

describe("audio-generation-runner reliability metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessingTaskFindUnique.mockResolvedValue({ taskData: {} });
    mockBookFindUnique.mockResolvedValue({ metadata: {} });
    mockBookUpdate.mockResolvedValue({});
    mockProcessingTaskUpdate.mockResolvedValue({});
    mockAudioCount.mockResolvedValue(3);
    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
  });

  it("should persist audioReliability summary from staged generation", async () => {
    mockGetAudioGenerator.mockReturnValue({
      generateBatchAudioWithReliability: jest.fn().mockResolvedValue({
        results: [
          {
            success: true,
            audioFileId: "audio-1",
            duration: 1,
            provider: "indextts",
            waitMs: 40,
            totalElapsedMs: 1100,
            retriesUsed: 0,
          },
          {
            success: true,
            audioFileId: "audio-2",
            duration: 2,
            provider: "indextts",
            waitMs: 60,
            totalElapsedMs: 1900,
            retriesUsed: 1,
          },
        ],
        reliability: {
          policyProvider: "indextts",
          firstPassSuccessRate: 0.5,
          retryRounds: 1,
          averageDurationMs: 1500,
          providerFailures: [
            {
              provider: "indextts",
              failed: 1,
            },
          ],
          passSummaries: [
            {
              passName: "pass-1",
              requestCount: 2,
              successCount: 1,
              failedCount: 1,
              concurrency: 3,
              durationMs: 20,
            },
            {
              passName: "pass-2",
              requestCount: 1,
              successCount: 1,
              failedCount: 0,
              concurrency: 2,
              durationMs: 10,
            },
          ],
        },
      }),
    } as any);

    await runAudioGenerationTask({
      bookId: "book-1",
      taskId: "task-audio-reliability-1",
      type: "batch",
      scriptSentenceIds: ["sentence-1", "sentence-2"],
      options: {
        provider: "indextts",
      },
    });

    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "task-audio-reliability-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          audioReliability: expect.objectContaining({
            firstPassSuccessRate: 0.5,
            retryRounds: 1,
            averageDurationMs: 1500,
            providerFailures: [
              expect.objectContaining({
                provider: "indextts",
                failed: 1,
              }),
            ],
          }),
          audioChildJobMetrics: expect.objectContaining({
            submitted: 2,
            completed: 2,
            failed: 0,
            retried: 1,
            averageWaitMs: 50,
            averageLatencyMs: 1500,
            providers: [
              expect.objectContaining({
                provider: "indextts",
                completed: 2,
                failed: 0,
                retried: 1,
              }),
            ],
          }),
        }),
      })
    );
  });
});

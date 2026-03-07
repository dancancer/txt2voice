// 一旦我被更新，请更新我的开头注释
// input: 信号生产任务上下文/数据库依赖 mock
// output: attempt.metrics 回写与摘要断言
// pos: S30.1 任务执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      findMany: jest.fn(),
    },
    synthesisAttempt: {
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  updateProcessingTaskProgress: jest.fn(),
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
}));

import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { runQualitySignalSyncTask } from "@/lib/quality-signal-sync-runner";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockFindAudioFiles = (prisma as any).audioFile.findMany as jest.Mock;
const mockUpdateAttempt = (prisma as any).synthesisAttempt.update as jest.Mock;
const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

const buildAudioFile = (metrics: Record<string, unknown> = {}) => ({
  id: "audio-1",
  sentenceId: "sentence-1",
  voiceProfileId: "voice-1",
  duration: 6,
  scriptSentence: {
    text: "第一章：此地无银三百两。",
    roleType: "dialogue",
    priority: "high",
  },
  synthesisAttempts: [
    {
      id: "attempt-1",
      metrics,
    },
  ],
});

describe("quality-signal-sync-runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTask.mockResolvedValue({
      taskData: {
        metadata: {
          source: "quality_signal_sync",
        },
      },
    });
    mockFindBook.mockResolvedValue({ metadata: {} });
    mockUpdateBook.mockResolvedValue({});
    mockUpdateTask.mockResolvedValue({});
    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
  });

  it("should enrich missing cer and speaker similarity into attempt metrics", async () => {
    mockFindAudioFiles.mockResolvedValue([buildAudioFile()]);

    await runQualitySignalSyncTask({
      taskId: "signal-task-1",
      bookId: "book-1",
      type: "book",
    });

    expect(mockUpdateAttempt).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        metrics: expect.objectContaining({
          cer: expect.any(Number),
          asrCer: expect.any(Number),
          q2Cer: expect.any(Number),
          speakerSimilarity: expect.any(Number),
          speakerEmbeddingSimilarity: expect.any(Number),
          q3SpeakerSimilarity: expect.any(Number),
          signalSync: expect.objectContaining({
            version: "s30.1-v1",
            taskId: "signal-task-1",
            cerSource: "heuristic",
            speakerSource: "heuristic",
          }),
        }),
      },
    });
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "signal-task-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "quality_signal_sync",
          updatedAttempts: 1,
          cerUpdatedCount: 1,
          speakerUpdatedCount: 1,
        }),
      })
    );
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            signalSupply: expect.objectContaining({
              taskId: "signal-task-1",
              updatedAttempts: 1,
            }),
          }),
        }),
      },
    });
  });

  it("should skip existing metrics when forceResync is false", async () => {
    mockFindAudioFiles.mockResolvedValue([
      buildAudioFile({
        cer: 0.08,
        speakerSimilarity: 0.88,
      }),
    ]);

    await runQualitySignalSyncTask({
      taskId: "signal-task-2",
      bookId: "book-1",
      type: "book",
      forceResync: false,
    });

    expect(mockUpdateAttempt).not.toHaveBeenCalled();
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "signal-task-2",
      expect.objectContaining({
        metadata: expect.objectContaining({
          skippedExistingCount: 1,
          updatedAttempts: 0,
        }),
      })
    );
  });
});

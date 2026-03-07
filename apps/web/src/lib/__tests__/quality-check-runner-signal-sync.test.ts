// 一旦我被更新，请更新我的开头注释
// input: 质检任务上下文/信号同步依赖 mock
// output: 质检前置信号同步断言
// pos: S30.1 任务执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  Prisma: {
    Decimal: class Decimal {
      private readonly raw: number;
      constructor(value: string | number) {
        this.raw = Number(value);
      }
      toNumber(): number {
        return this.raw;
      }
    },
  },
  default: {
    processingTask: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    chapterQualityAudit: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

jest.mock("@/lib/quality-signal-sync-runner", () => ({
  runQualitySignalSyncTask: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { runQualitySignalSyncTask } from "@/lib/quality-signal-sync-runner";
import { runQualityCheckTask } from "@/lib/quality-check-runner";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;
const mockFindAudioFiles = (prisma as any).audioFile.findMany as jest.Mock;
const mockTransaction = (prisma as any).$transaction as jest.Mock;
const mockSignalSyncRunner = runQualitySignalSyncTask as jest.MockedFunction<
  typeof runQualitySignalSyncTask
>;

const buildAudioFile = () => ({
  id: "audio-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-1",
  sentenceId: "sentence-1",
  voiceProfileId: null,
  duration: 6,
  scriptSentence: {
    id: "sentence-1",
    text: "你是谁？",
    roleType: "dialogue",
    emotionLabel: "calm",
    emotionIntensity: 0.55,
    priority: "normal",
  },
  synthesisAttempts: [{ id: "attempt-1", metrics: {} }],
});

describe("quality-check-runner signal sync integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ metadata: {} });
    mockUpdateBook.mockResolvedValue({});
    mockAudioCount.mockResolvedValue(1);
    mockFindAudioFiles.mockResolvedValue([buildAudioFile()]);
    mockCreateTask.mockResolvedValue({ id: "signal-sync-task-1" });
    mockTransaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      return callback({
        qualityCheckResult: {
          create: jest.fn().mockResolvedValue({ id: "qc-1" }),
        },
        audioFile: {
          update: jest.fn().mockResolvedValue({}),
        },
        manualReviewItem: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "review-1" }),
        },
      });
    });
  });

  it("should run signal sync before qc by default", async () => {
    mockFindTask.mockResolvedValueOnce({
      taskData: {
        metadata: {
          type: "batch",
          source: "upload_api",
          audioFileIds: ["audio-1"],
        },
      },
    });

    await runQualityCheckTask({
      taskId: "qc-task-1",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "QUALITY_SIGNAL_SYNC",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            parentQualityCheckTaskId: "qc-task-1",
            type: "batch",
          }),
        }),
      }),
    });
    expect(mockSignalSyncRunner).toHaveBeenCalledWith({
      taskId: "signal-sync-task-1",
      bookId: "book-1",
      type: "batch",
      chapterId: undefined,
      audioFileIds: ["audio-1"],
      forceResync: false,
    });
  });

  it("should skip signal sync when explicitly disabled", async () => {
    mockFindTask.mockResolvedValueOnce({
      taskData: {
        metadata: {
          type: "batch",
          source: "upload_api",
          audioFileIds: ["audio-1"],
          syncSignalsBeforeRun: false,
        },
      },
    });

    await runQualityCheckTask({
      taskId: "qc-task-2",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockSignalSyncRunner).not.toHaveBeenCalled();
  });
});

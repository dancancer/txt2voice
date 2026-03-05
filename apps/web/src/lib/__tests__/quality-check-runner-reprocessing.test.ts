// 一旦我被更新，请更新我的开头注释
// input: 质检任务上下文/数据库事务 mock
// output: reprocessing 自动回写与二次派单断言
// pos: 任务执行器测试
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
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { runQualityCheckTask } from "@/lib/quality-check-runner";

const mockTaskFindUnique = (prisma as any).processingTask.findUnique as jest.Mock;
const mockTaskUpdate = (prisma as any).processingTask.update as jest.Mock;
const mockBookFindUnique = (prisma as any).book.findUnique as jest.Mock;
const mockBookUpdate = (prisma as any).book.update as jest.Mock;
const mockAudioFindMany = (prisma as any).audioFile.findMany as jest.Mock;
const mockTransaction = (prisma as any).$transaction as jest.Mock;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

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
  },
  synthesisAttempts: [{ id: "attempt-1" }],
});

describe("runQualityCheckTask reprocessing secondary dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockTaskFindUnique.mockResolvedValue({
      taskData: {
        metadata: {
          source: "qc_retry",
          autoCreatePendingOnReject: true,
        },
      },
    });
    mockBookFindUnique.mockResolvedValue({ metadata: {} });
    mockBookUpdate.mockResolvedValue({});
    mockAudioFindMany.mockResolvedValue([buildAudioFile()]);
    mockTaskUpdate.mockResolvedValue({});
    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
  });

  it("should create secondary pending item when auto_rejected is enabled", async () => {
    const tx = {
      qualityCheckResult: {
        create: jest.fn().mockResolvedValue({ id: "qc-1" }),
      },
      audioFile: {
        update: jest.fn().mockResolvedValue({}),
      },
      manualReviewItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "review-reprocessing-1",
            chapterId: "chapter-1",
            segmentId: "segment-1",
            sentenceId: "sentence-1",
            issueType: "FAST_GATE",
            priority: "high",
            assignedTo: "operator-a",
            issueDetail: {
              score: 61,
            },
            resolutionNote: "qc_retry_task:audio-task-1",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "review-pending-1" }),
      },
    };

    mockTransaction.mockImplementation(async (callback: (innerTx: any) => Promise<unknown>) => {
      return callback(tx as any);
    });

    await runQualityCheckTask({
      taskId: "quality-task-1",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(tx.manualReviewItem.update).toHaveBeenCalledWith({
      where: { id: "review-reprocessing-1" },
      data: expect.objectContaining({
        status: "rejected",
        resolutionType: "auto_rejected",
      }),
    });
    expect(tx.manualReviewItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "pending",
        issueType: "FAST_GATE",
        sentenceId: "sentence-1",
      }),
    });
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "quality-task-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          secondaryDispatchCount: 1,
          source: "qc_retry",
        }),
      })
    );
  });
});

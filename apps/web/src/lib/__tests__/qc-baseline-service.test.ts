// 一旦我被更新，请更新我的开头注释
// input: 基线服务依赖 mock/质量任务数据
// output: 基线查询与固化断言
// pos: Phase D 服务测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    manualReviewItem: {
      count: jest.fn(),
    },
    processingTask: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  captureQualityBaselineForBook,
  getQualityBaselineStateForBook,
  parseCaptureQualityBaselinePayload,
} from "@/lib/qc-baseline-service";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockCountReviewItems = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindTasks = (prisma as any).processingTask.findMany as jest.Mock;

const buildQualityTask = ({
  id,
  source,
  manualReviewCount,
}: {
  id: string;
  source: string;
  manualReviewCount: number;
}) => ({
  id,
  bookId: "book-1",
  taskType: "QUALITY_CHECK",
  status: "completed",
  progress: 100,
  totalItems: 10,
  processedItems: 10,
  taskData: {
    message: "质检完成",
    metadata: {
      source,
      passCount: 7,
      repairCount: 2,
      manualReviewCount,
      hardFailCount: 1,
      issueTypeCounts: {
        CER: 1,
        SPEAKER: 2,
      },
      q0q3Summary: {
        averageScores: {
          q0: 90,
          q1: 88,
          q2: 76,
          q3: 72,
        },
        q2Cer: {
          availableCount: 6,
          missingCount: 4,
          average: 0.1132,
        },
        q3SpeakerSimilarity: {
          availableCount: 5,
          missingCount: 5,
          average: 0.8123,
        },
      },
      signalSourceSummary: {
        "q2:cer": 6,
        "q3:speaker": 5,
      },
    },
  },
  errorMessage: null,
  startedAt: new Date("2026-03-07T10:00:00.000Z"),
  completedAt: new Date("2026-03-07T10:10:00.000Z"),
  createdAt: new Date("2026-03-07T10:00:00.000Z"),
  updatedAt: new Date("2026-03-07T10:10:00.000Z"),
  externalTaskId: null,
});

describe("qc-baseline-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountReviewItems.mockResolvedValue(3);
    mockUpdateBook.mockResolvedValue({});
  });

  it("should parse capture payload with default sample source path", () => {
    expect(parseCaptureQualityBaselinePayload({})).toEqual({
      label: "s30_1_pre_signal_supply",
      sampleSourcePath: "uploads/sample.txt",
      capturedBy: null,
      notes: null,
      taskId: undefined,
    });
  });

  it("should capture baseline from latest non-calibration quality task", async () => {
    mockFindBook.mockResolvedValueOnce({
      id: "book-1",
      metadata: {
        qualityCheck: {
          baselineSnapshots: [],
        },
      },
      _count: {
        qualityCheckResults: 10,
        audioFiles: 10,
        scriptSentences: 10,
      },
    });
    mockFindTasks.mockResolvedValueOnce([
      buildQualityTask({
        id: "task-calibration-1",
        source: "calibration_eval",
        manualReviewCount: 0,
      }),
      buildQualityTask({
        id: "task-quality-1",
        source: "upload_api",
        manualReviewCount: 3,
      }),
    ]);

    const result = await captureQualityBaselineForBook({
      bookId: "book-1",
      payload: parseCaptureQualityBaselinePayload({
        capturedBy: "tester",
      }),
    });

    expect(result.snapshot).toEqual(
      expect.objectContaining({
        label: "s30_1_pre_signal_supply",
        sampleSourcePath: "uploads/sample.txt",
        capturedBy: "tester",
        summary: expect.objectContaining({
          taskId: "task-quality-1",
          source: "upload_api",
          manualReviewCount: 3,
          hardFailCount: 1,
          issueTypeCounts: {
            CER: 1,
            SPEAKER: 2,
          },
        }),
      })
    );
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            latestBaselineSnapshot: expect.objectContaining({
              sampleSourcePath: "uploads/sample.txt",
            }),
            baselineSnapshots: expect.arrayContaining([
              expect.objectContaining({
                sampleSourcePath: "uploads/sample.txt",
              }),
            ]),
          }),
        }),
      },
    });
  });

  it("should expose current summary for phase d checks", async () => {
    mockFindBook.mockResolvedValueOnce({
      id: "book-1",
      metadata: {
        qualityCheck: {
          baselineSnapshots: [
            {
              id: "baseline-1",
              label: "prev",
            },
          ],
        },
      },
      _count: {
        qualityCheckResults: 12,
        audioFiles: 10,
        scriptSentences: 10,
      },
    });
    mockFindTasks.mockResolvedValueOnce([
      buildQualityTask({
        id: "task-quality-2",
        source: "upload_api",
        manualReviewCount: 2,
      }),
    ]);

    const result = await getQualityBaselineStateForBook({
      bookId: "book-1",
    });

    expect(result.baselines).toEqual([
      {
        id: "baseline-1",
        label: "prev",
      },
    ]);
    expect(result.currentSummary).toEqual(
      expect.objectContaining({
        taskId: "task-quality-2",
        pendingReviewCount: 3,
        counts: {
          qualityCheckCount: 12,
          audioFileCount: 10,
          scriptSentenceCount: 10,
        },
      })
    );
  });

  it("should reject when there is no completed non-calibration quality task", async () => {
    mockFindBook.mockResolvedValueOnce({
      id: "book-1",
      metadata: {},
      _count: {
        qualityCheckResults: 0,
        audioFiles: 0,
        scriptSentences: 0,
      },
    });
    mockFindTasks.mockResolvedValueOnce([
      buildQualityTask({
        id: "task-calibration-only",
        source: "calibration_eval",
        manualReviewCount: 0,
      }),
    ]);

    await expect(
      getQualityBaselineStateForBook({
        bookId: "book-1",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

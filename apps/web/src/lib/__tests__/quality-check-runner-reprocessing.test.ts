// 一旦我被更新，请更新我的开头注释
// input: 质检任务上下文/数据库事务 mock
// output: reprocessing 自动回写与二次派单断言
// pos: 任务执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  Decimal: class Decimal {
    private readonly raw: number;

    constructor(value: string | number) {
      this.raw = Number(value);
    }

    toNumber(): number {
      return this.raw;
    }
  },
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
      count: jest.fn(),
    },
    chapterQualityAudit: {
      create: jest.fn(),
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
const mockAudioCount = (prisma as any).audioFile.count as jest.Mock;
const mockChapterAuditCreate = (prisma as any).chapterQualityAudit.create as jest.Mock;
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
    emotionLabel: "calm",
    emotionIntensity: 0.55,
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
          syncSignalsBeforeRun: false,
        },
      },
    });
    mockBookFindUnique.mockResolvedValue({ metadata: {} });
    mockBookUpdate.mockResolvedValue({});
    mockAudioFindMany.mockResolvedValue([buildAudioFile()]);
    mockAudioCount.mockResolvedValue(1);
    mockChapterAuditCreate.mockResolvedValue({ id: "chapter-audit-base" });
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
      chapterQualityAudit: {
        create: jest.fn().mockResolvedValue({ id: "chapter-audit-1" }),
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
        resolutionType: "auto_recovery_exhausted",
        issueDetail: expect.objectContaining({
          source: "qc_retry",
        }),
      }),
    });
    expect(tx.manualReviewItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "pending",
        issueType: "FAST_GATE",
        sentenceId: "sentence-1",
        issueDetail: expect.objectContaining({
          source: "qc_retry",
        }),
      }),
    });
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "quality-task-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          secondaryDispatchCount: 1,
          secondaryDispatchSkippedByThresholdCount: 0,
          source: "qc_retry",
        }),
      })
    );
  });

  it("should stop secondary dispatch when auto rejected count exceeds threshold", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({
      taskData: {
        metadata: {
          source: "qc_retry",
          autoCreatePendingOnReject: true,
          syncSignalsBeforeRun: false,
          maxAutoRejectedCount: 1,
        },
      },
    });

    const tx = {
      qualityCheckResult: {
        create: jest.fn().mockResolvedValue({ id: "qc-2" }),
      },
      audioFile: {
        update: jest.fn().mockResolvedValue({}),
      },
      chapterQualityAudit: {
        create: jest.fn().mockResolvedValue({ id: "chapter-audit-2" }),
      },
      manualReviewItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "review-reprocessing-2",
            chapterId: "chapter-1",
            segmentId: "segment-1",
            sentenceId: "sentence-1",
            issueType: "FAST_GATE",
            priority: "high",
            assignedTo: "operator-a",
            issueDetail: {
              score: 58,
              autoRejectedCount: 1,
            },
            resolutionNote: "qc_retry_task:audio-task-2",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "review-pending-2" }),
      },
    };

    mockTransaction.mockImplementation(async (callback: (innerTx: any) => Promise<unknown>) => {
      return callback(tx as any);
    });

    await runQualityCheckTask({
      taskId: "quality-task-2",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(tx.manualReviewItem.create).not.toHaveBeenCalled();
    expect(tx.manualReviewItem.update).toHaveBeenCalledWith({
      where: { id: "review-reprocessing-2" },
      data: expect.objectContaining({
        status: "rejected",
        resolutionType: "auto_recovery_exhausted",
        issueDetail: expect.objectContaining({
          source: "qc_retry",
          secondaryDispatch: "threshold_blocked",
        }),
      }),
    });
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "quality-task-2",
      expect.objectContaining({
        metadata: expect.objectContaining({
          secondaryDispatchCount: 0,
          secondaryDispatchSkippedByThresholdCount: 1,
        }),
      })
    );
  });

  it("should sync manual_review_batch reprocessing without secondary dispatch", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({
      taskData: {
        metadata: {
          source: "manual_review_batch",
          syncSignalsBeforeRun: false,
          retryReviewItemIds: ["review-batch-1"],
        },
      },
    });

    const tx = {
      qualityCheckResult: {
        create: jest.fn().mockResolvedValue({ id: "qc-batch-1" }),
      },
      audioFile: {
        update: jest.fn().mockResolvedValue({}),
      },
      chapterQualityAudit: {
        create: jest.fn().mockResolvedValue({ id: "chapter-audit-batch-1" }),
      },
      manualReviewItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "review-batch-1",
            chapterId: "chapter-1",
            segmentId: "segment-1",
            sentenceId: "sentence-1",
            issueType: "FAST_GATE",
            priority: "normal",
            assignedTo: "operator-b",
            issueDetail: {
              score: 63,
            },
            resolutionNote: "manual_review_batch_task:audio-task-11",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "review-batch-pending" }),
      },
    };

    mockTransaction.mockImplementation(async (callback: (innerTx: any) => Promise<unknown>) => {
      return callback(tx as any);
    });

    await runQualityCheckTask({
      taskId: "quality-task-batch-1",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(tx.manualReviewItem.update).toHaveBeenCalledWith({
      where: { id: "review-batch-1" },
      data: expect.objectContaining({
        issueDetail: expect.objectContaining({
          source: "manual_review_batch",
        }),
      }),
    });
    expect(tx.manualReviewItem.create).not.toHaveBeenCalled();
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "quality-task-batch-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "manual_review_batch",
          secondaryDispatchCount: 0,
        }),
      })
    );
  });

  it("should keep calibration_eval in dry-run mode without touching production state", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({
      taskData: {
        metadata: {
          source: "calibration_eval",
          syncSignalsBeforeRun: false,
          calibrationEval: {
            enabled: true,
            dryRun: true,
            reportId: "report-1",
            sampleSetId: "sample-set-1",
            sampleLabels: [
              {
                audioFileId: "audio-1",
                expectedVerdict: "manual_review",
                issueType: "EMOTION",
                source: "manual_review",
              },
            ],
          },
        },
      },
    });
    mockBookFindUnique.mockResolvedValueOnce({
      metadata: {
        qualityCheck: {
          deepGateThresholdGovernance: {
            reports: [
              {
                id: "report-1",
                status: "evaluated",
                createdAt: "2026-03-06T12:00:00.000Z",
                sampleSize: 1,
                baselineTemplate: {},
                candidateTemplate: {},
                baselineSummary: {},
                candidateSummary: {},
                comparison: {},
                publishedVersion: null,
                sampleSetId: "sample-set-1",
                replayTaskId: "qc-old",
                replayTaskStatus: "queued",
              },
            ],
            releases: [],
            sampleSets: [
              {
                id: "sample-set-1",
                createdAt: "2026-03-06T12:00:00.000Z",
                createdBy: "ops",
                sampleLimit: 20,
                sampleSize: 1,
                source: "quality_results_snapshot",
                audioFileIds: ["audio-1"],
                qualityResultIds: ["qc-history-1"],
                samples: [],
                latestReplayTaskId: "qc-old",
              },
            ],
            activeVersion: 0,
            activeReleaseId: null,
            lastEvaluatedReportId: "report-1",
          },
        },
      },
    });

    const tx = {
      qualityCheckResult: {
        create: jest.fn().mockResolvedValue({ id: "qc-calibration-1" }),
      },
      audioFile: {
        update: jest.fn().mockResolvedValue({}),
      },
      manualReviewItem: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockTransaction.mockImplementation(async (callback: (innerTx: any) => Promise<unknown>) => {
      return callback(tx as any);
    });

    await runQualityCheckTask({
      taskId: "quality-task-calibration-1",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-1"],
    });

    expect(tx.audioFile.update).not.toHaveBeenCalled();
    expect(tx.manualReviewItem.findMany).not.toHaveBeenCalled();
    expect(mockChapterAuditCreate).not.toHaveBeenCalled();
    expect(tx.qualityCheckResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        detail: expect.objectContaining({
          source: "calibration_eval",
          calibrationLabel: expect.objectContaining({
            expectedVerdict: "manual_review",
            issueType: "EMOTION",
            source: "manual_review",
            reportId: "report-1",
            sampleSetId: "sample-set-1",
            dryRun: true,
          }),
        }),
      }),
    });
    expect(mockMergeTaskData).toHaveBeenCalledWith(
      "quality-task-calibration-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "calibration_eval",
          calibrationEval: expect.objectContaining({
            enabled: true,
            reportId: "report-1",
            sampleSetId: "sample-set-1",
            labeledCount: 1,
            exactMatchCount: 1,
          }),
        }),
      })
    );
    expect(mockBookUpdate).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            deepGateThresholdGovernance: expect.objectContaining({
              reports: expect.arrayContaining([
                expect.objectContaining({
                  id: "report-1",
                  replayTaskId: "quality-task-calibration-1",
                  replayTaskStatus: "completed",
                }),
              ]),
            }),
          }),
        }),
      },
    });
  });
});

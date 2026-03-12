// 一旦我被更新，请更新我的开头注释
// input: runner 参数/依赖 mock
// output: 失败段复核入队与状态回写断言
// pos: 台本任务执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    scriptSentence: {
      deleteMany: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      update: jest.fn(),
    },
    manualReviewItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  updateProcessingTaskProgress: jest.fn(),
}));

jest.mock("@/lib/script-generator", () => ({
  getScriptGenerator: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { getScriptGenerator } from "@/lib/script-generator";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";

const mockPrisma = prisma as any;
const mockGetScriptGenerator = getScriptGenerator as jest.MockedFunction<
  typeof getScriptGenerator
>;

const createFailedScript = () => ({
  dialogueLines: [
    {
      id: "line-1",
      segmentId: "seg-1",
      chapterId: "chapter-1",
      orderInSegment: 0,
      text: "第一段",
      isNarration: true,
      characterName: "旁白",
      tone: "中性",
    },
  ],
  summary: {
    totalLines: 1,
    dialogueCount: 0,
    narrationCount: 1,
    totalSegments: 2,
    processedSegments: 1,
    failedSegments: 1,
    failedSegmentIds: ["seg-2"],
    failedSegmentDetails: [
      {
        segmentId: "seg-2",
        chapterId: "chapter-1",
        orderIndex: 1,
        stage: "script_validation",
        errorCode: "SCRIPT_VALIDATION_FAILED",
        message: "段落台本校验失败",
        provider: "script-validator",
        retryable: false,
        coverageRatio: 0.86,
        issueCodes: ["LOW_COVERAGE"],
        issueMessages: ["原文覆盖率过低"],
        issuePreviews: ["第二段"],
        segmentPreview: "第二段原文",
      },
    ],
    characterDistribution: {},
    emotionDistribution: {},
  },
  segments: [
    {
      segmentId: "seg-1",
      lineCount: 1,
      characters: ["旁白"],
    },
  ],
});

describe("script-generation-runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    mockPrisma.book.findUnique.mockResolvedValue({ id: "book-1", metadata: {} });
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.processingTask.update.mockResolvedValue({});
    mockPrisma.scriptSentence.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.manualReviewItem.findFirst.mockResolvedValue(null);
    mockPrisma.manualReviewItem.create.mockResolvedValue({ id: "review-1" });
    mockPrisma.manualReviewItem.update.mockResolvedValue({});
  });

  it("should create script validation manual review item and mark book as manual_review_pending", async () => {
    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn().mockResolvedValue(createFailedScript()),
      generatePartialScript: jest.fn(),
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-1",
      bookId: "book-1",
      options: {},
    });

    expect(mockPrisma.manualReviewItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        chapterId: "chapter-1",
        segmentId: "seg-2",
        issueType: "SCRIPT_VALIDATION",
        status: "pending",
        priority: "high",
        issueDetail: expect.objectContaining({
          scriptSubtype: "COVERAGE",
        }),
      }),
    });

    expect(mockPrisma.processingTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: expect.stringContaining("台本生成部分失败"),
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            isPartialFailure: true,
            failedSegmentIds: ["seg-2"],
            reviewSync: expect.objectContaining({
              issueType: "SCRIPT_VALIDATION",
              created: 1,
              pending: 1,
            }),
          }),
        }),
      }),
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "manual_review_pending",
        metadata: expect.objectContaining({
          failedSegmentIds: ["seg-2"],
          scriptFailureManualReviewPending: 1,
        }),
      }),
    });
  });

  it("should reuse existing pending manual review item instead of creating duplicates", async () => {
    mockPrisma.manualReviewItem.findFirst.mockResolvedValue({ id: "review-existing" });
    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn().mockResolvedValue(createFailedScript()),
      generatePartialScript: jest.fn(),
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-2",
      bookId: "book-1",
      options: {},
    });

    expect(mockPrisma.manualReviewItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.manualReviewItem.update).toHaveBeenCalledWith({
      where: { id: "review-existing" },
      data: expect.objectContaining({
        status: "pending",
        priority: "high",
        issueDetail: expect.objectContaining({
          scriptSubtype: "COVERAGE",
        }),
        resolutionType: null,
      }),
    });
  });

  it("should honor limitToSegments without requiring startFromSegmentId", async () => {
    const generateScript = jest.fn();
    const generatePartialScript = jest.fn().mockResolvedValue({
      ...createFailedScript(),
      summary: {
        ...createFailedScript().summary,
        totalSegments: 2,
      },
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript,
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-limit",
      bookId: "book-1",
      options: {},
      extraParams: {
        limitToSegments: 2,
      },
    });

    expect(generateScript).not.toHaveBeenCalled();
    expect(generatePartialScript).toHaveBeenCalledWith(
      "book-1",
      {},
      {
        startFromSegmentId: undefined,
        startFromOrderIndex: undefined,
        limitToSegments: 2,
      },
      expect.any(Function)
    );
  });
});

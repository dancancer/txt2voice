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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    manualReviewItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

jest.mock(
  "@/lib/agent-runtime/runtime/run-script-production-workflow",
  () => ({
    runScriptProductionWorkflow: jest.fn(),
  })
);

import prisma from "@/lib/prisma";
import { getScriptGenerator } from "@/lib/script-generator";
import { runScriptProductionWorkflow } from "@/lib/agent-runtime/runtime/run-script-production-workflow";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";

const mockPrisma = prisma as any;
const mockGetScriptGenerator = getScriptGenerator as jest.MockedFunction<
  typeof getScriptGenerator
>;
const mockRunScriptProductionWorkflow =
  runScriptProductionWorkflow as jest.MockedFunction<
    typeof runScriptProductionWorkflow
  >;
const mockTaskFindUnique = mockPrisma.processingTask.findUnique as jest.Mock;

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
        segmentContent: "第二段原文，有校验问题",
        rawResponse:
          '{"dialogues":[{"id":"line-seg-2","sourceText":"第二段原文","text":"改写后的第二段","speaker":"旁白","tone":"中性"}],"characters":[]}',
        structuredResult: {
          dialogues: [
            {
              id: "line-seg-2",
              sourceText: "第二段原文",
              text: "改写后的第二段",
              speaker: "旁白",
              tone: "中性",
            },
          ],
          characters: [],
        },
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

const createSuccessfulScript = () => ({
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
    totalSegments: 1,
    processedSegments: 1,
    failedSegments: 0,
    failedSegmentIds: [],
    failedSegmentDetails: [],
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
    mockTaskFindUnique.mockResolvedValue({ taskData: {} });
    mockPrisma.book.update.mockResolvedValue({});
    mockPrisma.processingTask.update.mockResolvedValue({});
    mockPrisma.scriptSentence.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.manualReviewItem.findFirst.mockResolvedValue(null);
    mockPrisma.manualReviewItem.create.mockResolvedValue({ id: "review-1" });
    mockPrisma.manualReviewItem.update.mockResolvedValue({});
    mockPrisma.manualReviewItem.updateMany.mockResolvedValue({ count: 0 });

    mockRunScriptProductionWorkflow.mockImplementation(async (input: any) => {
      input.onExecutionEvent?.({
        provider: "openai",
        model: "gpt-4.1-mini",
        status: "submitted",
        prompt: "prompt",
        attempt: 1,
      });
      const generator = mockGetScriptGenerator();
      let result;
      if (input.mode === "regenerate") {
        result = await generator.regenerateSegmentScript(
          input.bookId,
          input.segmentIds || [],
          input.options,
          input.onProgress
        );
      } else if (input.mode === "partial") {
        result = await generator.generatePartialScript(
          input.bookId,
          input.options,
          {
            startFromSegmentId: input.startFromSegmentId,
            startFromOrderIndex: input.startFromOrderIndex,
            limitToSegments: input.limitToSegments,
          },
          input.onProgress
        );
      } else {
        result = await generator.generateScript(
          input.bookId,
          input.options,
          input.onProgress
        );
      }

      input.onExecutionEvent?.({
        provider: "openai",
        model: "gpt-4.1-mini",
        status: "completed",
        prompt: "prompt",
        latencyMs: 120,
        waitMs: 30,
        attempt: 2,
        retriesUsed: 1,
      });
      return result;
    });
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
          segmentContent: "第二段原文，有校验问题",
          rawResponse: expect.stringContaining('"dialogues"'),
          structuredResult: expect.objectContaining({
            dialogues: expect.any(Array),
          }),
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

  it("should route full generation through runtime bridge instead of legacy generator", async () => {
    mockRunScriptProductionWorkflow.mockResolvedValue(createSuccessfulScript());

    await runScriptGenerationTask({
      taskId: "task-runtime-bridge-full",
      bookId: "book-1",
      options: { batchSize: 1 } as any,
    });

    expect(mockGetScriptGenerator).not.toHaveBeenCalled();
    expect(mockRunScriptProductionWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        options: { batchSize: 1 },
        mode: "full",
        onProgress: expect.any(Function),
        onExecutionEvent: expect.any(Function),
      })
    );
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

  it("should resolve existing script validation review items after successful partial rerun", async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      id: "book-1",
      metadata: {
        failedSegmentIds: ["seg-9"],
        failedSegments: 1,
      },
    });

    const generatePartialScript = jest.fn().mockResolvedValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "修复后的台词",
          isNarration: true,
          characterName: "旁白",
          tone: "中性",
        },
      ],
      summary: {
        totalLines: 1,
        dialogueCount: 0,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        failedSegmentDetails: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [
        {
          segmentId: "seg-2",
          lineCount: 1,
          characters: ["旁白"],
        },
      ],
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn(),
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-success",
      bookId: "book-1",
      options: {},
      extraParams: {
        limitToSegments: 1,
      },
    });

    expect(mockPrisma.manualReviewItem.updateMany).toHaveBeenCalledWith({
      where: {
        bookId: "book-1",
        issueType: "SCRIPT_VALIDATION",
        segmentId: {
          in: ["seg-2"],
        },
        status: {
          in: ["pending", "reprocessing"],
        },
      },
      data: expect.objectContaining({
        status: "resolved",
        resolutionType: "auto_resolved",
        resolutionNote: expect.stringContaining("task-success"),
        resolvedAt: expect.any(Date),
      }),
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "manual_review_pending",
        metadata: expect.objectContaining({
          failedSegmentIds: ["seg-9"],
          failedSegments: 1,
        }),
      }),
    });
  });

  it("should keep manual_review_pending after targeted rerun when other failed segments remain", async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      id: "book-1",
      status: "manual_review_pending",
      metadata: {
        failedSegmentIds: ["seg-9"],
        failedSegments: 1,
        totalScriptLines: 120,
        dialogueCount: 80,
        narrationCount: 40,
        totalSegments: 20,
      },
    });

    const generatePartialScript = jest.fn().mockResolvedValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "修复后的台词",
          isNarration: true,
          characterName: "旁白",
          tone: "中性",
        },
      ],
      summary: {
        totalLines: 1,
        dialogueCount: 0,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        failedSegmentDetails: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [
        {
          segmentId: "seg-2",
          lineCount: 1,
          characters: ["旁白"],
        },
      ],
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn(),
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-targeted-success",
      bookId: "book-1",
      options: {},
      extraParams: {
        startFromSegmentId: "seg-2",
        startFromOrderIndex: 1,
      },
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "manual_review_pending",
        metadata: expect.objectContaining({
          failedSegmentIds: ["seg-9"],
          failedSegments: 1,
        }),
      }),
    });
  });

  it("should preserve full-book counters after targeted partial rerun", async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      id: "book-1",
      status: "script_generated",
      metadata: {
        failedSegmentIds: [],
        failedSegments: 0,
        totalScriptLines: 120,
        dialogueCount: 80,
        narrationCount: 40,
        totalSegments: 20,
      },
    });

    const generatePartialScript = jest.fn().mockResolvedValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "修复后的台词",
          isNarration: true,
          characterName: "旁白",
          tone: "中性",
        },
      ],
      summary: {
        totalLines: 1,
        dialogueCount: 0,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        failedSegmentDetails: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [
        {
          segmentId: "seg-2",
          lineCount: 1,
          characters: ["旁白"],
        },
      ],
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn(),
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-partial-counters",
      bookId: "book-1",
      options: {},
      extraParams: {
        startFromSegmentId: "seg-2",
        startFromOrderIndex: 1,
      },
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "script_generated",
        metadata: expect.objectContaining({
          totalScriptLines: 120,
          dialogueCount: 80,
          narrationCount: 40,
          totalSegments: 20,
          failedSegments: 0,
          failedSegmentIds: [],
        }),
      }),
    });
  });

  it("should keep processed status after first incremental generation from a clean book", async () => {
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      id: "book-1",
      status: "processed",
      metadata: {
        failedSegmentIds: [],
        failedSegments: 0,
        totalSegments: 20,
      },
    });

    const generatePartialScript = jest.fn().mockResolvedValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "修复后的台词",
          isNarration: true,
          characterName: "旁白",
          tone: "中性",
        },
      ],
      summary: {
        totalLines: 1,
        dialogueCount: 0,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        failedSegmentDetails: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [
        {
          segmentId: "seg-2",
          lineCount: 1,
          characters: ["旁白"],
        },
      ],
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn(),
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-first-incremental",
      bookId: "book-1",
      options: {},
      extraParams: {
        startFromSegmentId: "seg-2",
        startFromOrderIndex: 1,
      },
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "processed",
        metadata: expect.objectContaining({
          failedSegments: 0,
          failedSegmentIds: [],
        }),
      }),
    });
  });

  it("should restore previous stable status after sample run instead of leaving generating_script", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({
      taskData: {
        metadata: {
          previousBookStatus: "processed",
        },
      },
    });
    mockPrisma.book.findUnique.mockResolvedValueOnce({
      id: "book-1",
      status: "generating_script",
      metadata: {
        failedSegmentIds: [],
        failedSegments: 0,
      },
    });

    const generatePartialScript = jest.fn().mockResolvedValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "样本台词",
          isNarration: true,
          characterName: "旁白",
          tone: "中性",
        },
      ],
      summary: {
        totalLines: 1,
        dialogueCount: 0,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        failedSegmentDetails: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [
        {
          segmentId: "seg-2",
          lineCount: 1,
          characters: ["旁白"],
        },
      ],
    });

    mockGetScriptGenerator.mockReturnValue({
      generateScript: jest.fn(),
      generatePartialScript,
      regenerateSegmentScript: jest.fn(),
    } as any);

    await runScriptGenerationTask({
      taskId: "task-sample-status",
      bookId: "book-1",
      options: {},
      extraParams: {
        limitToSegments: 1,
      },
    });

    expect(mockPrisma.book.update).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "processed",
      }),
    });
  });

  it("should attach aggregated llm job metrics to successful task metadata", async () => {
    mockGetScriptGenerator.mockImplementation(() => {
      let executionObserver: ((event: Record<string, unknown>) => void) | null = null;

      return {
        setExecutionObserver: (observer: typeof executionObserver) => {
          executionObserver = observer;
        },
        generateScript: jest.fn().mockImplementation(async () => {
          executionObserver?.({
            status: "submitted",
            provider: "openai",
          });
          executionObserver?.({
            status: "completed",
            provider: "openai",
            model: "gpt-test",
            latencyMs: 120,
            waitMs: 30,
            retriesUsed: 1,
            attempt: 2,
          });

          return {
            dialogueLines: [
              {
                id: "line-1",
                segmentId: "seg-1",
                chapterId: "chapter-1",
                orderInSegment: 0,
                text: "成功台词",
                isNarration: true,
                characterName: "旁白",
                tone: "中性",
              },
            ],
            summary: {
              totalLines: 1,
              dialogueCount: 0,
              narrationCount: 1,
              totalSegments: 1,
              processedSegments: 1,
              failedSegments: 0,
              failedSegmentIds: [],
              failedSegmentDetails: [],
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
          };
        }),
        generatePartialScript: jest.fn(),
        regenerateSegmentScript: jest.fn(),
      } as any;
    });

    await runScriptGenerationTask({
      taskId: "task-llm-metrics",
      bookId: "book-1",
      options: {},
    });

    expect(mockPrisma.processingTask.update).toHaveBeenCalledWith({
      where: { id: "task-llm-metrics" },
      data: expect.objectContaining({
        status: "completed",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            llmMetrics: expect.objectContaining({
              submitted: 1,
              completed: 1,
              failed: 0,
              retried: 1,
              averageLatencyMs: 120,
              averageWaitMs: 30,
              providers: [
                expect.objectContaining({
                  provider: "openai",
                  completed: 1,
                  failed: 0,
                  retried: 1,
                }),
              ],
            }),
          }),
        }),
      }),
    });
  });
});

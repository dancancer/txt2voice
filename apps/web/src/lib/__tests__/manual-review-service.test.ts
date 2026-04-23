// 一旦我被更新，请更新我的开头注释
// input: 查询参数/复核动作/服务依赖 mock
// output: 人工复核服务行为断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    manualReviewItem: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workflowRun: {
      findMany: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueAudioGenerationJob: jest.fn(),
  enqueueScriptGenerationJob: jest.fn(),
  cancelProcessingTaskJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(),
}));

jest.mock(
  "@/lib/agent-runtime/runtime/script-production/manual-review-processor",
  () => ({
  buildSegmentProcessingResultFromStructuredResult: jest.fn(),
  persistSegmentProcessingResult: jest.fn(),
})
);

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  cancelProcessingTaskJob,
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  buildSegmentProcessingResultFromStructuredResult,
  persistSegmentProcessingResult,
} from "@/lib/agent-runtime/runtime/script-production/manual-review-processor";
import {
  parseManualReviewBatchResolvePayload,
  listManualReviewItems,
  parseManualReviewQuery,
  parseManualReviewResolvePayload,
  regenerateAllPendingManualReviewItems,
  saveManualReviewScriptEdit,
  resolveManualReviewItemsInBatch,
  resolveManualReviewItem,
  toManualReviewCsv,
} from "@/lib/manual-review-service";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";

const mockCount = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindMany = (prisma as any).manualReviewItem.findMany as jest.Mock;
const mockFindUnique = (prisma as any).manualReviewItem.findUnique as jest.Mock;
const mockUpdate = (prisma as any).manualReviewItem.update as jest.Mock;
const mockTransaction = (prisma as any).$transaction as jest.Mock;
const mockFindFirstTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockFindWorkflowRuns = (prisma as any).workflowRun.findMany as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockEnqueueAudio = enqueueAudioGenerationJob as jest.MockedFunction<
  typeof enqueueAudioGenerationJob
>;
const mockEnqueueScript = enqueueScriptGenerationJob as jest.MockedFunction<
  typeof enqueueScriptGenerationJob
>;
const mockCancelTaskJob = cancelProcessingTaskJob as jest.MockedFunction<
  typeof cancelProcessingTaskJob
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;
const mockBuildSegmentProcessingResult =
  buildSegmentProcessingResultFromStructuredResult as jest.MockedFunction<
    typeof buildSegmentProcessingResultFromStructuredResult
  >;
const mockPersistSegmentResult =
  persistSegmentProcessingResult as jest.MockedFunction<
    typeof persistSegmentProcessingResult
  >;
const mockTxManualReviewUpdate = jest.fn();

const baseItem = (overrides: Record<string, unknown> = {}) => ({
  id: "review-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-1",
  sentenceId: "sentence-1",
  audioFileId: "audio-1",
  attemptId: "attempt-1",
  qcResultId: "qc-1",
  issueType: "FAST_GATE",
  priority: "normal",
  status: "pending",
  issueDetail: {
    reasons: ["pace_too_fast"],
    repairPlan: ["decrease_speed_0.05"],
    score: 72,
  },
  assignedTo: null,
  resolutionType: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: new Date("2026-03-05T12:40:00.000Z"),
  updatedAt: new Date("2026-03-05T12:40:00.000Z"),
  scriptSentence: {
    id: "sentence-1",
    text: "样例台词",
    roleType: "dialogue",
    emotionLabel: "calm",
    priority: "high",
  },
  audioFile: {
    id: "audio-1",
    fileName: "a1.mp3",
    duration: 3.22,
    status: "completed",
    qualityScore: 72.5,
    qualityVerdict: "repair",
    qualityStatus: "repair",
  },
  qualityCheckResult: {
    id: "qc-1",
    verdict: "manual_review",
    score: 72.5,
    hardFail: false,
    reasons: ["pace_too_fast"],
    detail: { repairPlan: ["decrease_speed_0.05"] },
    createdAt: new Date("2026-03-05T12:41:00.000Z"),
  },
  ...overrides,
});

describe("manual-review-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateBook.mockResolvedValue({});
    mockFindBook.mockResolvedValue({
      id: "book-1",
      characterProfiles: [],
    });
    mockTransaction.mockImplementation(async (callback: any) =>
      callback({
        manualReviewItem: {
          update: mockTxManualReviewUpdate,
        },
      })
    );
    mockCancelTaskJob.mockResolvedValue({
      canceled: false,
      state: null,
      exists: false,
    });
  });

  it("should parse query with default pending status", () => {
    const query = parseManualReviewQuery(new URLSearchParams("page=2&limit=10"));

    expect(query).toMatchObject({
      page: 2,
      limit: 10,
      offset: 10,
      status: "pending",
    });
  });

  it("should throw when query status is invalid", () => {
    expect(() =>
      parseManualReviewQuery(new URLSearchParams("status=invalid"))
    ).toThrow(ValidationError);
  });

  it("should normalize resolve action aliases", () => {
    const payload = parseManualReviewResolvePayload({
      action: "重生",
      note: "重跑并复听",
      provider: "voxcpm",
    });

    expect(payload).toMatchObject({
      action: "regenerate",
      note: "重跑并复听",
      provider: "voxcpm",
      autoMerge: false,
    });
  });

  it("should parse batch resolve payload", () => {
    const payload = parseManualReviewBatchResolvePayload({
      itemIds: ["review-1", "review-2", "review-1"],
      action: "通过",
    });

    expect(payload).toMatchObject({
      action: "approve",
      itemIds: ["review-1", "review-2"],
    });
  });

  it("should list manual review items with summary", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    mockFindMany.mockResolvedValueOnce([baseItem()]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
    });

    expect(result.data).toHaveLength(1);
    expect(result.summary).toMatchObject({
      pendingCount: 3,
      reprocessingCount: 1,
      resolvedCount: 4,
      rejectedCount: 2,
      total: 10,
    });
    expect(mockCount).toHaveBeenNthCalledWith(1, {
      where: {
        bookId: "book-1",
        status: "pending",
      },
    });
  });

  it("should recover missing script preview data from runtime draft output", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
        sentenceId: null,
        audioFileId: null,
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        issueDetail: {
          taskId: "task-script-1",
          stage: "script_validation",
          errorCode: "SCRIPT_VALIDATION_FAILED",
          segmentContent: "这一段完整原文。",
          segmentPreview: "这一段完整原文。",
          rawResponse: null,
          structuredResult: null,
          issueMessages: ["原文覆盖率过低"],
        },
      }),
    ]);
    mockFindWorkflowRuns.mockResolvedValueOnce([
      {
        id: "workflow-1",
        processingTaskId: "task-script-1",
        stageRuns: [
          {
            id: "stage-script-1",
            stageId: "segment_scripting",
            agentRuns: [
              {
                id: "agent-script-1",
                inputSummary: {
                  segmentId: "segment-1",
                },
                outputSummary: {
                  provider: "deepseek",
                  model: "deepseek-chat",
                  segmentScriptDraft: {
                    segmentId: "segment-1",
                    createdAt: "2026-03-29T13:20:00.000Z",
                    lines: [
                      {
                        id: "line-1",
                        sourceText: "这一段完整原文。",
                        text: "当前生成台词",
                        speaker: "旁白",
                        orderInSegment: 0,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
    });

    expect(result.data[0]?.issueDetail).toMatchObject({
      taskId: "task-script-1",
      structuredResult: {
        segmentId: "segment-1",
        createdAt: "2026-03-29T13:20:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "这一段完整原文。",
            text: "当前生成台词",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
      rawResponseUnavailableReason: "当前任务运行时未持久化原始响应，已从运行时草稿回填原始生成结果。",
    });
    expect(mockFindWorkflowRuns).toHaveBeenCalledWith({
      where: {
        processingTaskId: {
          in: ["task-script-1"],
        },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      include: {
        stageRuns: {
          where: {
            stageId: {
              in: ["segment_scripting", "segment_repair"],
            },
          },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          include: {
            agentRuns: {
              where: {
                OR: [
                  {
                    agentId: "script-generation-agent",
                    status: "completed",
                  },
                  {
                    agentId: "repair-agent",
                    status: {
                      in: ["completed", "failed"],
                    },
                  },
                ],
              },
              orderBy: [
                { completedAt: "desc" },
                { startedAt: "desc" },
                { id: "desc" },
              ],
            },
          },
        },
      },
    });
  });

  it("should recover repair failed artifact payload from segment repair runtime output", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
        sentenceId: null,
        audioFileId: null,
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        issueDetail: {
          taskId: "task-script-2",
          stage: "segment_repair",
          errorCode: "SEGMENT_MANUAL_REVIEW_REQUIRED",
          segmentContent: "这一段完整原文。",
          segmentPreview: "这一段完整原文。",
          rawResponse: null,
          structuredResult: null,
          issueMessages: ["repair_failed_artifact_trimmed"],
        },
      }),
    ]);
    mockFindWorkflowRuns.mockResolvedValueOnce([
      {
        id: "workflow-2",
        processingTaskId: "task-script-2",
        stageRuns: [
          {
            id: "stage-repair-1",
            stageId: "segment_repair",
            agentRuns: [
              {
                id: "agent-repair-1",
                inputSummary: {
                  segmentId: "segment-1",
                },
                outputSummary: {
                  failedArtifact: {
                    rawResponse: "{\"lines\":[{\"id\":\"line-1\"}]}",
                    structuredResult: {
                      segmentId: "segment-1",
                      createdAt: "2026-03-29T13:20:00.000Z",
                      lines: [
                        {
                          id: "line-1",
                          sourceText: "这一段完整原文。",
                          text: "修复失败时保留下来的台词",
                          speaker: "旁白",
                          orderInSegment: 0,
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
    });

    expect(result.data[0]?.issueDetail).toMatchObject({
      taskId: "task-script-2",
      rawResponse: "{\"lines\":[{\"id\":\"line-1\"}]}",
      structuredResult: {
        segmentId: "segment-1",
        createdAt: "2026-03-29T13:20:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "这一段完整原文。",
            text: "修复失败时保留下来的台词",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
    });
  });

  it("should recover repaired draft payload from segment repair runtime output", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
        sentenceId: null,
        audioFileId: null,
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        issueDetail: {
          taskId: "task-script-3",
          stage: "quality_judgement",
          errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
          segmentContent: "这一段完整原文。",
          segmentPreview: "这一段完整原文。",
          rawResponse: null,
          structuredResult: null,
          issueMessages: ["unresolved_speakers_present"],
        },
      }),
    ]);
    mockFindWorkflowRuns.mockResolvedValueOnce([
      {
        id: "workflow-3",
        processingTaskId: "task-script-3",
        stageRuns: [
          {
            id: "stage-repair-2",
            stageId: "segment_repair",
            agentRuns: [
              {
                id: "agent-repair-2",
                inputSummary: {
                  segmentId: "segment-1",
                },
                outputSummary: {
                  repairedDraft: {
                    segmentId: "segment-1",
                    createdAt: "2026-03-29T13:21:00.000Z",
                    rawResponse:
                      "{\"lines\":[{\"id\":\"line-2\",\"speaker\":\"关玮\"}]}",
                    lines: [
                      {
                        id: "line-2",
                        sourceText: "这一段完整原文。",
                        text: "修复后保留下来的台词",
                        speaker: "关玮",
                        orderInSegment: 0,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    ]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
    });

    expect(result.data[0]?.issueDetail).toMatchObject({
      taskId: "task-script-3",
      rawResponse: "{\"lines\":[{\"id\":\"line-2\",\"speaker\":\"关玮\"}]}",
      structuredResult: {
        segmentId: "segment-1",
        createdAt: "2026-03-29T13:21:00.000Z",
        lines: [
          {
            id: "line-2",
            sourceText: "这一段完整原文。",
            text: "修复后保留下来的台词",
            speaker: "关玮",
            orderInSegment: 0,
          },
        ],
      },
    });
  });

  it("should resolve item as approved", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockUpdate.mockResolvedValueOnce(
      baseItem({
        status: "resolved",
        resolutionType: "approved",
        resolutionNote: "人工确认通过",
        resolvedAt: new Date("2026-03-05T13:00:00.000Z"),
      })
    );

    const result = await resolveManualReviewItem({
      bookId: "book-1",
      itemId: "review-1",
      payload: {
        action: "approve",
        note: "人工确认通过",
        autoMerge: false,
      },
    });

    expect(result.retryTask).toBeNull();
    expect(result.item.status).toBe("resolved");
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueAudio).not.toHaveBeenCalled();
  });

  it("should enqueue single audio retry for regenerate action", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-retry-1",
      status: "processing",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-retry-1",
      dedupeKey: "audio:single:sentence-1",
      reused: false,
      state: "waiting",
    });
    mockUpdate.mockResolvedValueOnce(
      baseItem({
        status: "reprocessing",
        resolutionType: "regenerate",
        resolutionNote: "retry_task:task-retry-1",
      })
    );

    const result = await resolveManualReviewItem({
      bookId: "book-1",
      itemId: "review-1",
      payload: {
        action: "regenerate",
        note: undefined,
        assignedTo: "qa-1",
        voiceProfileId: "voice-1",
        provider: "voxcpm",
        autoMerge: false,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUDIO_GENERATION",
      }),
    });
    expect(mockEnqueueAudio).toHaveBeenCalledWith({
      taskId: "task-retry-1",
      bookId: "book-1",
      type: "single",
      scriptSentenceIds: ["sentence-1"],
      voiceProfileId: "voice-1",
      autoMerge: false,
      options: {
        provider: "voxcpm",
        skipExisting: false,
        overwriteExisting: true,
      },
    });
    expect(result.retryTask).toMatchObject({
      taskId: "task-retry-1",
      taskType: "AUDIO_GENERATION",
      status: "processing",
    });
    expect(result.item.status).toBe("reprocessing");
  });

  it("should enqueue script regeneration for script validation item without sentenceId", async () => {
    mockFindUnique.mockResolvedValueOnce(
      baseItem({
        id: "review-script-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      })
    );
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-script-retry-1",
      status: "processing",
    });
    mockEnqueueScript.mockResolvedValueOnce({
      jobId: "task-script-retry-1",
      dedupeKey: "script:segment-script-1",
      reused: false,
      state: "waiting",
    });
    mockUpdate.mockResolvedValueOnce(
      baseItem({
        id: "review-script-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        status: "reprocessing",
        resolutionType: "regenerate",
        resolutionNote: "retry_task:task-script-retry-1",
      })
    );

    const result = await resolveManualReviewItem({
      bookId: "book-1",
      itemId: "review-script-1",
      payload: {
        action: "regenerate",
        note: undefined,
        assignedTo: "qa-1",
        autoMerge: false,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "SCRIPT_GENERATION",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            source: "manual_review",
            manualReviewItemId: "review-script-1",
            segmentIds: ["segment-script-1"],
          }),
        }),
      }),
    });
    expect(mockEnqueueScript).toHaveBeenCalledWith({
      taskId: "task-script-retry-1",
      bookId: "book-1",
      options: {},
      extraParams: {
        regenerateSegments: true,
        segmentIds: ["segment-script-1"],
      },
    });
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: { status: "generating_script" },
    });
    expect(result.retryTask).toMatchObject({
      taskId: "task-script-retry-1",
      taskType: "SCRIPT_GENERATION",
      status: "processing",
    });
    expect(result.item.id).toBe("review-script-1");
    expect(result.item.status).toBe("reprocessing");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "review-script-1" },
      data: {
        status: "reprocessing",
        resolutionType: "regenerate",
        resolutionNote: "retry_task:task-script-retry-1",
        assignedTo: "qa-1",
        resolvedAt: null,
      },
      include: expect.anything(),
    });
  });

  it("should save manual edited structured script result and resolve review item", async () => {
    mockFindUnique.mockResolvedValueOnce(
      baseItem({
        id: "review-script-edit-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-edit-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        issueDetail: {
          stage: "script_validation",
          errorCode: "SCRIPT_VALIDATION_FAILED",
          segmentContent: "这一段完整原文。",
          structuredResult: {
            dialogues: [
              {
                id: "line-1",
                sourceText: "这一段完整原文。",
                text: "这一段完整原文。",
                speaker: "旁白",
                tone: "中性",
              },
            ],
            characters: [],
          },
        },
      })
    );
    mockBuildSegmentProcessingResult.mockReturnValue({
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "segment-script-edit-1",
          chapterId: "chapter-1",
          orderInSegment: 0,
          text: "这一段完整原文。",
          rawSpeaker: "旁白",
          characterName: "旁白",
          tone: "中性",
          isNarration: true,
        },
      ],
      characterCandidates: [],
    });
    mockPersistSegmentResult.mockResolvedValueOnce(undefined);
    mockTxManualReviewUpdate.mockResolvedValueOnce(
      baseItem({
        id: "review-script-edit-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-edit-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
        status: "resolved",
        resolutionType: "manual_edit_saved",
        issueDetail: {
          stage: "script_validation",
          errorCode: "SCRIPT_VALIDATION_FAILED",
          segmentContent: "这一段完整原文。",
          structuredResult: {
            dialogues: [
              {
                id: "line-1",
                sourceText: "这一段完整原文。",
                text: "这一段完整原文。",
                speaker: "旁白",
                tone: "中性",
              },
            ],
            characters: [],
          },
          manualEditedStructuredResult: {
            dialogues: [
              {
                id: "line-1",
                sourceText: "这一段完整原文。",
                text: "这一段完整原文。",
                speaker: "旁白",
                tone: "中性",
              },
            ],
            characters: [],
          },
        },
      })
    );

    const result = await saveManualReviewScriptEdit({
      bookId: "book-1",
      itemId: "review-script-edit-1",
      payload: {
        structuredResult: {
          dialogues: [
            {
              id: "line-1",
              sourceText: "这一段完整原文。",
              text: "这一段完整原文。",
              speaker: "旁白",
              tone: "中性",
            },
          ],
          characters: [],
        },
      },
    });

    expect(mockBuildSegmentProcessingResult).toHaveBeenCalledWith({
      segment: {
        id: "segment-script-edit-1",
        chapterId: "chapter-1",
        orderIndex: -1,
        content: "这一段完整原文。",
      },
      mode: "manual_edit",
      structuredResult: {
        dialogues: [
          expect.objectContaining({
            text: "这一段完整原文。",
          }),
        ],
        characters: [],
      },
      characterMap: expect.any(Map),
      options: expect.any(Object),
    });
    expect(mockPersistSegmentResult).toHaveBeenCalledWith({
      bookId: "book-1",
      segmentId: "segment-script-edit-1",
      result: expect.objectContaining({
        dialogueLines: expect.any(Array),
      }),
      db: expect.any(Object),
      characterMap: expect.any(Map),
      characterProfiles: [],
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockTxManualReviewUpdate).toHaveBeenCalledWith({
      where: { id: "review-script-edit-1" },
      data: expect.objectContaining({
        status: "resolved",
        resolutionType: "manual_edit_saved",
        resolvedAt: expect.any(Date),
        issueDetail: expect.objectContaining({
          manualEditedStructuredResult: expect.objectContaining({
            dialogues: expect.any(Array),
          }),
        }),
      }),
      include: expect.anything(),
    });
    expect(result.item.status).toBe("resolved");
  });

  it("should batch approve manual review items", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({ id: "review-11" }),
      baseItem({ id: "review-12" }),
    ]);
    mockUpdate
      .mockResolvedValueOnce(
        baseItem({
          id: "review-11",
          status: "resolved",
          resolutionType: "approved",
        })
      )
      .mockResolvedValueOnce(
        baseItem({
          id: "review-12",
          status: "resolved",
          resolutionType: "approved",
        })
      );

    const result = await resolveManualReviewItemsInBatch({
      bookId: "book-1",
      payload: {
        itemIds: ["review-11", "review-12"],
        action: "approve",
        autoMerge: false,
      },
    });

    expect(result.action).toBe("approve");
    expect(result.processedCount).toBe(2);
    expect(result.retryTask).toBeNull();
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("should enqueue batch regenerate task for manual review items", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({ id: "review-21", sentenceId: "sentence-21" }),
      baseItem({ id: "review-22", sentenceId: "sentence-22" }),
    ]);
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-manual-batch-1",
      status: "processing",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-manual-batch-1",
      dedupeKey: "audio:batch:sentence-21,sentence-22",
      reused: false,
      state: "waiting",
    });
    mockUpdate
      .mockResolvedValueOnce(
        baseItem({
          id: "review-21",
          status: "reprocessing",
          resolutionType: "batch_regenerate",
        })
      )
      .mockResolvedValueOnce(
        baseItem({
          id: "review-22",
          status: "reprocessing",
          resolutionType: "batch_regenerate",
        })
      );

    const result = await resolveManualReviewItemsInBatch({
      bookId: "book-1",
      payload: {
        itemIds: ["review-21", "review-22"],
        action: "regenerate",
        autoMerge: false,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUDIO_GENERATION",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            source: "manual_review_batch",
            selectedReviewItemIds: ["review-21", "review-22"],
          }),
        }),
      }),
    });
    expect(mockEnqueueAudio).toHaveBeenCalledWith({
      taskId: "task-manual-batch-1",
      bookId: "book-1",
      type: "batch",
      scriptSentenceIds: ["sentence-21", "sentence-22"],
      voiceProfileId: undefined,
      autoMerge: false,
      options: {
        provider: undefined,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
    expect(result.retryTask).toMatchObject({
      taskId: "task-manual-batch-1",
      taskType: "AUDIO_GENERATION",
      status: "processing",
    });
  });

  it("should enqueue batch script regeneration for script validation items without sentenceId", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        id: "review-script-21",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-21",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      }),
      baseItem({
        id: "review-script-22",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-22",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      }),
    ]);
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-script-batch-1",
      status: "processing",
    });
    mockEnqueueScript.mockResolvedValueOnce({
      jobId: "task-script-batch-1",
      dedupeKey: "script:segment-script-21,segment-script-22",
      reused: false,
      state: "waiting",
    });
    mockUpdate
      .mockResolvedValueOnce(
        baseItem({
          id: "review-script-21",
          issueType: "SCRIPT_VALIDATION",
          sentenceId: null,
          audioFileId: null,
          qcResultId: null,
          attemptId: null,
          segmentId: "segment-script-21",
          scriptSentence: null,
          audioFile: null,
          qualityCheckResult: null,
          status: "reprocessing",
          resolutionType: "batch_regenerate",
          resolutionNote: "manual_review_batch_task:task-script-batch-1",
        })
      )
      .mockResolvedValueOnce(
        baseItem({
          id: "review-script-22",
          issueType: "SCRIPT_VALIDATION",
          sentenceId: null,
          audioFileId: null,
          qcResultId: null,
          attemptId: null,
          segmentId: "segment-script-22",
          scriptSentence: null,
          audioFile: null,
          qualityCheckResult: null,
          status: "reprocessing",
          resolutionType: "batch_regenerate",
          resolutionNote: "manual_review_batch_task:task-script-batch-1",
        })
      );

    const result = await resolveManualReviewItemsInBatch({
      bookId: "book-1",
      payload: {
        itemIds: ["review-script-21", "review-script-22"],
        action: "regenerate",
        autoMerge: false,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "SCRIPT_GENERATION",
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            source: "manual_review_batch",
            selectedReviewItemIds: ["review-script-21", "review-script-22"],
            segmentIds: ["segment-script-21", "segment-script-22"],
          }),
        }),
      }),
    });
    expect(mockEnqueueScript).toHaveBeenCalledWith({
      taskId: "task-script-batch-1",
      bookId: "book-1",
      options: {},
      extraParams: {
        regenerateSegments: true,
        segmentIds: ["segment-script-21", "segment-script-22"],
      },
    });
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: { status: "generating_script" },
    });
    expect(result.retryTask).toMatchObject({
      taskId: "task-script-batch-1",
      taskType: "SCRIPT_GENERATION",
      status: "processing",
    });
    expect(result.processedCount).toBe(2);
    expect(result.items.map((item) => item.status)).toEqual([
      "reprocessing",
      "reprocessing",
    ]);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "review-script-21" },
      data: {
        status: "reprocessing",
        resolutionType: "batch_regenerate",
        resolutionNote: "manual_review_batch_task:task-script-batch-1",
        assignedTo: null,
        resolvedAt: null,
      },
      include: expect.anything(),
    });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "review-script-22" },
      data: {
        status: "reprocessing",
        resolutionType: "batch_regenerate",
        resolutionNote: "manual_review_batch_task:task-script-batch-1",
        assignedTo: null,
        resolvedAt: null,
      },
      include: expect.anything(),
    });
  });

  it("should reject batch regenerate when any item is missing sentenceId", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({ id: "review-31", sentenceId: "sentence-31" }),
      baseItem({ id: "review-32", sentenceId: null }),
    ]);

    await expect(
      resolveManualReviewItemsInBatch({
        bookId: "book-1",
        payload: {
          itemIds: ["review-31", "review-32"],
          action: "regenerate",
          autoMerge: false,
        },
      })
    ).rejects.toThrow("review-32");

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueAudio).not.toHaveBeenCalled();
  });

  it("should regenerate all pending review items for both script and audio queues", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        id: "review-script-all-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-all-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      }),
      baseItem({
        id: "review-audio-all-1",
        issueType: "CER",
        sentenceId: "sentence-audio-all-1",
        segmentId: null,
      }),
    ]);
    mockFindFirstTask.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCreateTask
      .mockResolvedValueOnce({
        id: "task-all-script-1",
        status: "processing",
      })
      .mockResolvedValueOnce({
        id: "task-all-audio-1",
        status: "processing",
      });
    mockEnqueueScript.mockResolvedValueOnce({
      jobId: "task-all-script-1",
      dedupeKey: "script:segment-script-all-1",
      reused: false,
      state: "waiting",
    });
    mockEnqueueAudio.mockResolvedValueOnce({
      jobId: "task-all-audio-1",
      dedupeKey: "audio:single:sentence-audio-all-1",
      reused: false,
      state: "waiting",
    });
    mockUpdate
      .mockResolvedValueOnce(
        baseItem({
          id: "review-script-all-1",
          issueType: "SCRIPT_VALIDATION",
          sentenceId: null,
          audioFileId: null,
          qcResultId: null,
          attemptId: null,
          segmentId: "segment-script-all-1",
          scriptSentence: null,
          audioFile: null,
          qualityCheckResult: null,
          status: "reprocessing",
          resolutionType: "bulk_regenerate_pending",
        })
      )
      .mockResolvedValueOnce(
        baseItem({
          id: "review-audio-all-1",
          issueType: "CER",
          sentenceId: "sentence-audio-all-1",
          segmentId: null,
          status: "reprocessing",
          resolutionType: "bulk_regenerate_pending",
        })
      );

    const result = await regenerateAllPendingManualReviewItems({
      bookId: "book-1",
    });

    expect(result).toMatchObject({
      reviewItemCount: 2,
      processedCount: 2,
      scriptTask: {
        taskId: "task-all-script-1",
        taskType: "SCRIPT_GENERATION",
        status: "processing",
      },
      audioTask: {
        taskId: "task-all-audio-1",
        taskType: "AUDIO_GENERATION",
        status: "processing",
      },
    });
    expect(mockEnqueueScript).toHaveBeenCalledWith({
      taskId: "task-all-script-1",
      bookId: "book-1",
      options: {},
      extraParams: {
        regenerateSegments: true,
        segmentIds: ["segment-script-all-1"],
      },
    });
    expect(mockEnqueueAudio).toHaveBeenCalledWith({
      taskId: "task-all-audio-1",
      bookId: "book-1",
      type: "single",
      scriptSentenceIds: ["sentence-audio-all-1"],
      voiceProfileId: undefined,
      autoMerge: false,
      options: {
        provider: undefined,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
  });

  it("should fail when pending script review items are missing segmentId", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        id: "review-script-missing-target",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: null,
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      }),
    ]);

    await expect(
      regenerateAllPendingManualReviewItems({
        bookId: "book-1",
      })
    ).rejects.toThrow(
      "全量重生失败：以下脚本复核项缺少 segmentId：review-script-missing-target"
    );

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueScript).not.toHaveBeenCalled();
    expect(mockEnqueueAudio).not.toHaveBeenCalled();
  });

  it("should compensate queued script task when audio enqueue fails during regenerate-all-pending", async () => {
    mockFindMany.mockResolvedValueOnce([
      baseItem({
        id: "review-script-all-1",
        issueType: "SCRIPT_VALIDATION",
        sentenceId: null,
        audioFileId: null,
        qcResultId: null,
        attemptId: null,
        segmentId: "segment-script-all-1",
        scriptSentence: null,
        audioFile: null,
        qualityCheckResult: null,
      }),
      baseItem({
        id: "review-audio-all-1",
        issueType: "CER",
        sentenceId: "sentence-audio-all-1",
        segmentId: null,
      }),
    ]);
    mockFindFirstTask.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCreateTask
      .mockResolvedValueOnce({
        id: "task-all-script-1",
        status: "pending",
      })
      .mockResolvedValueOnce({
        id: "task-all-audio-1",
        status: "pending",
      });
    mockEnqueueScript.mockResolvedValueOnce({
      jobId: "task-all-script-1",
      dedupeKey: "script:segment-script-all-1",
      reused: false,
      state: "waiting",
    });
    mockEnqueueAudio.mockRejectedValueOnce(new Error("audio queue down"));
    mockCancelTaskJob.mockResolvedValueOnce({
      canceled: true,
      state: "waiting",
      exists: true,
    });
    mockMergeTaskData
      .mockResolvedValueOnce({
        message: "人工复核全量音频重生任务入队失败",
      } as any)
      .mockResolvedValueOnce({
        message: "人工复核全量台本重跑任务已回滚",
      } as any);
    mockUpdateTask.mockResolvedValue({});

    await expect(
      regenerateAllPendingManualReviewItems({
        bookId: "book-1",
      })
    ).rejects.toThrow("audio queue down");

    expect(mockCancelTaskJob).toHaveBeenCalledWith(
      "SCRIPT_GENERATION",
      "task-all-script-1"
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateBook).not.toHaveBeenCalled();
  });

  it("should build manual review csv payload", () => {
    const csv = toManualReviewCsv([
      {
        ...baseItem({
          issueType: SCRIPT_VALIDATION_ISSUE_TYPE,
          issueSubtype: "COVERAGE",
          issueDetail: {
            issueMessages: ["原文覆盖率过低", "尾部存在未覆盖内容"],
            issuePreviews: ["第二段原文"],
            segmentPreview: "第二段原文，有校验问题",
            coverageRatio: 0.82,
          },
        }),
        sentence: {
          id: "sentence-1",
          text: "第一句台词",
          roleType: "dialogue",
          emotionLabel: "calm",
          priority: "normal",
        },
      } as any,
    ]);

    expect(csv).toContain("itemId,status,issueType");
    expect(csv).toContain("issueSubtype,issueSubtypeLabel,priority");
    expect(csv).toContain("verdict,recommendedAction,scriptSummary,scriptIssueMessages,resolutionType");
    expect(csv).toContain("review-1");
    expect(csv).toContain("第一句台词");
    expect(csv).toContain("覆盖率不足");
    expect(csv).toContain("重生");
    expect(csv).toContain("原文覆盖率过低 | 尾部存在未覆盖内容");
  });

  it("should fail regenerate when item has no sentenceId", async () => {
    mockFindUnique.mockResolvedValueOnce(
      baseItem({
        sentenceId: null,
      })
    );

    await expect(
      resolveManualReviewItem({
        bookId: "book-1",
        itemId: "review-1",
        payload: {
          action: "regenerate",
          autoMerge: false,
        },
      })
    ).rejects.toThrow("当前复核项缺少 sentenceId");
  });

  it("should mark retry task failed when enqueue fails", async () => {
    mockFindUnique.mockResolvedValueOnce(baseItem());
    mockFindFirstTask.mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-retry-2",
      status: "processing",
    });
    mockEnqueueAudio.mockRejectedValueOnce(new Error("queue down"));
    mockMergeTaskData.mockResolvedValueOnce({
      message: "人工复核重生任务入队失败",
    } as any);
    mockUpdateTask.mockResolvedValueOnce({});

    await expect(
      resolveManualReviewItem({
        bookId: "book-1",
        itemId: "review-1",
        payload: {
          action: "regenerate",
          autoMerge: false,
        },
      })
    ).rejects.toThrow("queue down");

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "task-retry-2" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "queue down",
      }),
    });
  });
});

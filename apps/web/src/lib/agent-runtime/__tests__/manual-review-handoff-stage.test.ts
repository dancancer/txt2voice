jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    manualReviewItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import type { AgentRunRecord, ToolCallRecord } from "../runtime/run-agent";
import {
  runManualReviewHandoffStage,
  type RunManualReviewHandoffStageResult,
} from "../runtime/stages/run-manual-review-handoff-stage";

const mockPrisma = prisma as any;

const asCompletedResult = (
  result: RunManualReviewHandoffStageResult
): Extract<RunManualReviewHandoffStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }

  return result;
};

const createRuntimeDeps = () => {
  let nextId = 0;
  const agentRuns: Array<AgentRunRecord & { completedAt?: Date }> = [];
  const toolCalls: Array<
    ToolCallRecord & {
      createdAt?: Date;
      completedAt?: Date;
    }
  > = [];

  return {
    createId: () => `runtime-${nextId++}`,
    appendTrace: async () => undefined,
    createStageRun: async () => undefined,
    updateStageRun: async () => undefined,
    createAgentRun: async (record: AgentRunRecord & { completedAt?: Date }) => {
      agentRuns.push(record);
    },
    updateAgentRun: async (record: AgentRunRecord & { completedAt?: Date }) => {
      const target = agentRuns.find((item) => item.id === record.id);
      if (target) {
        Object.assign(target, record);
      }
    },
    createToolCall: async (record: ToolCallRecord & { createdAt?: Date }) => {
      toolCalls.push(record);
    },
    updateToolCall: async (
      record: ToolCallRecord & { completedAt?: Date }
    ) => {
      const target = toolCalls.find((item) => item.id === record.id);
      if (target) {
        Object.assign(target, record);
      }
    },
    agentRuns,
    toolCalls,
  };
};

describe("manual review handoff stage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockPrisma)
    );
    mockPrisma.manualReviewItem.findFirst.mockResolvedValue(null);
    mockPrisma.manualReviewItem.findMany.mockResolvedValue([]);
    mockPrisma.manualReviewItem.create.mockResolvedValue({ id: "review-1" });
    mockPrisma.manualReviewItem.update.mockResolvedValue({});
    mockPrisma.manualReviewItem.updateMany.mockResolvedValue({ count: 0 });
  });

  it("syncs review items through an explicit runtime tool call", async () => {
    const runtimeDeps = createRuntimeDeps();
    mockPrisma.manualReviewItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "review-1" }]);

    const result = await runManualReviewHandoffStage({
      workflowRunId: "wf-review-1",
      taskId: "task-1",
      bookId: "book-1",
      failures: [
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
          rawResponse: "{\"dialogues\":[]}",
          structuredResult: {
            dialogues: [],
          },
        },
      ],
      processedSegmentIds: ["seg-1"],
      failedSegmentIds: ["seg-2"],
      ...runtimeDeps,
    });

    const completed = asCompletedResult(result);
    expect(completed.summary).toEqual({
      issueType: "SCRIPT_VALIDATION",
      created: 1,
      updated: 0,
      pending: 1,
      resolved: 0,
    });
    expect(runtimeDeps.toolCalls).toEqual([
      expect.objectContaining({
        toolName: "sync-manual-review-items",
        status: "completed",
        argumentsSummary: expect.objectContaining({
          failureCount: 1,
          processedSegmentCount: 1,
          failedSegmentCount: 1,
        }),
        resultSummary: expect.objectContaining({
          pending: 1,
          resolved: 0,
        }),
      }),
    ]);
  });

  it("keeps distinct review items for different failure signatures on the same segment", async () => {
    const runtimeDeps = createRuntimeDeps();
    mockPrisma.manualReviewItem.findMany
      .mockResolvedValueOnce([
        {
          id: "review-existing",
          segmentId: "seg-2",
          issueType: "SCRIPT_VALIDATION",
          status: "pending",
          issueDetail: {
            scriptSubtype: "COVERAGE",
            errorCode: "SCRIPT_VALIDATION_FAILED",
            issueCodes: ["LOW_COVERAGE"],
          },
        },
      ])
      .mockResolvedValueOnce([{ id: "review-existing" }, { id: "review-new" }]);

    const result = await runManualReviewHandoffStage({
      workflowRunId: "wf-review-signature-split",
      taskId: "task-2",
      bookId: "book-1",
      failures: [
        {
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderIndex: 1,
          stage: "script_validation",
          errorCode: "SCRIPT_VALIDATION_FAILED",
          message: "覆盖率不足",
          provider: "script-validator",
          retryable: false,
          coverageRatio: 0.82,
          issueCodes: ["LOW_COVERAGE"],
          issueMessages: ["原文覆盖率过低"],
          issuePreviews: ["第二段"],
          segmentPreview: "第二段原文",
          segmentContent: "第二段原文，有校验问题",
          rawResponse: "{\"dialogues\":[]}",
          structuredResult: {
            dialogues: [],
          },
        },
        {
          segmentId: "seg-2",
          chapterId: "chapter-1",
          orderIndex: 1,
          stage: "quality_judgement",
          errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
          message: "低置信度，需要人工复核",
          provider: "quality-judge",
          retryable: false,
          coverageRatio: 0.98,
          issueCodes: ["QUALITY_MANUAL_REVIEW_REQUIRED"],
          issueMessages: ["低置信度，需要人工复核"],
          issuePreviews: ["第二段"],
          segmentPreview: "第二段原文",
          segmentContent: "第二段原文，有人工复核问题",
          rawResponse: "{\"score\":0.61}",
          structuredResult: {
            score: 0.61,
          },
        },
      ],
      processedSegmentIds: [],
      failedSegmentIds: ["seg-2"],
      ...runtimeDeps,
    });

    expect(asCompletedResult(result).summary).toEqual({
      issueType: "SCRIPT_VALIDATION",
      created: 1,
      updated: 1,
      pending: 2,
      resolved: 0,
    });
    expect(mockPrisma.manualReviewItem.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.manualReviewItem.create).toHaveBeenCalledTimes(1);
  });

  it("does not auto-resolve pending review items solely because a later run succeeded for the segment", async () => {
    const runtimeDeps = createRuntimeDeps();
    mockPrisma.manualReviewItem.findMany.mockResolvedValueOnce([
      {
        id: "review-open-1",
        segmentId: "seg-3",
        issueType: "SCRIPT_VALIDATION",
        status: "pending",
        issueDetail: {
          scriptSubtype: "OTHER",
          errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
          issueCodes: ["QUALITY_MANUAL_REVIEW_REQUIRED"],
        },
      },
    ]);

    const result = await runManualReviewHandoffStage({
      workflowRunId: "wf-review-no-auto-resolve",
      taskId: "task-3",
      bookId: "book-1",
      failures: [],
      processedSegmentIds: ["seg-3"],
      failedSegmentIds: [],
      ...runtimeDeps,
    });

    expect(asCompletedResult(result).summary).toEqual({
      issueType: "SCRIPT_VALIDATION",
      created: 0,
      updated: 0,
      pending: 1,
      resolved: 0,
    });
    expect(mockPrisma.manualReviewItem.updateMany).not.toHaveBeenCalled();
  });

  it("creates manual review items even when taskId is absent", async () => {
    const runtimeDeps = createRuntimeDeps();
    mockPrisma.manualReviewItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "review-1" }]);

    const result = await runManualReviewHandoffStage({
      workflowRunId: "wf-review-no-task",
      bookId: "book-1",
      failures: [
        {
          segmentId: "seg-3",
          chapterId: "chapter-1",
          orderIndex: 2,
          stage: "quality_judgement",
          errorCode: "QUALITY_MANUAL_REVIEW_REQUIRED",
          message: "需要人工复核",
          provider: "quality-judge",
          retryable: false,
          coverageRatio: 0.91,
          issueCodes: ["QUALITY_MANUAL_REVIEW_REQUIRED"],
          issueMessages: ["低置信度，需要人工复核"],
          issuePreviews: ["第三段"],
          segmentPreview: "第三段原文",
          segmentContent: "第三段原文，有人工复核问题",
          rawResponse: "{\"score\":0.61}",
          structuredResult: {
            score: 0.61,
          },
        },
      ],
      processedSegmentIds: [],
      failedSegmentIds: ["seg-3"],
      ...runtimeDeps,
    });

    expect(asCompletedResult(result).summary.created).toBe(1);
    expect(mockPrisma.manualReviewItem.create).toHaveBeenCalledTimes(1);
  });
});

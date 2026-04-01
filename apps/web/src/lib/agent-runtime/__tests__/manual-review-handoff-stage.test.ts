jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    manualReviewItem: {
      findFirst: jest.fn(),
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
    mockPrisma.manualReviewItem.create.mockResolvedValue({ id: "review-1" });
    mockPrisma.manualReviewItem.update.mockResolvedValue({});
    mockPrisma.manualReviewItem.updateMany.mockResolvedValue({ count: 1 });
  });

  it("syncs review items through an explicit runtime tool call", async () => {
    const runtimeDeps = createRuntimeDeps();

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
      resolved: 1,
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
          resolved: 1,
        }),
      }),
    ]);
  });
});

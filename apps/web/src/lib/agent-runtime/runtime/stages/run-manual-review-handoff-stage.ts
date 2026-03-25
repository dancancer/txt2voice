import type { SegmentFailureDetail } from "@/lib/script-generator/types";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";
import {
  createReviewTools,
  type ReviewTools,
} from "../../tools/review-tools";

interface ManualReviewHandoffRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (
    record: ToolCallRecord & { createdAt?: Date }
  ) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface RunManualReviewHandoffStageInput
  extends ManualReviewHandoffRuntimeDeps {
  workflowRunId: string;
  taskId?: string;
  bookId: string;
  failures: SegmentFailureDetail[];
  processedSegmentIds: string[];
  failedSegmentIds: string[];
  tools?: ReviewTools;
}

export interface ManualReviewHandoffSummary {
  issueType: string;
  created: number;
  updated: number;
  pending: number;
  resolved: number;
}

interface RunManualReviewHandoffStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  summary: ManualReviewHandoffSummary;
}

interface RunManualReviewHandoffStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunManualReviewHandoffStageResult =
  | RunManualReviewHandoffStageCompletedResult
  | RunManualReviewHandoffStageNonCompletedResult;

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toSummaryRecord = (summary: ManualReviewHandoffSummary): Record<string, unknown> => ({
  issueType: summary.issueType,
  created: summary.created,
  updated: summary.updated,
  pending: summary.pending,
  resolved: summary.resolved,
});

const toManualReviewHandoffSummary = (
  value: Record<string, unknown> | undefined
): ManualReviewHandoffSummary => ({
  issueType: typeof value?.issueType === "string" ? value.issueType : "SCRIPT_VALIDATION",
  created: typeof value?.created === "number" ? value.created : 0,
  updated: typeof value?.updated === "number" ? value.updated : 0,
  pending: typeof value?.pending === "number" ? value.pending : 0,
  resolved: typeof value?.resolved === "number" ? value.resolved : 0,
});

export const runManualReviewHandoffStage = async (
  input: RunManualReviewHandoffStageInput
): Promise<RunManualReviewHandoffStageResult> => {
  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "manual_review_handoff",
      agent: {
        id: "manual-review-handoff-agent",
        getInputSummary: () => ({
          taskId: input.taskId,
          bookId: input.bookId,
          failureCount: input.failures.length,
          processedSegmentCount: input.processedSegmentIds.length,
          failedSegmentCount: input.failedSegmentIds.length,
        }),
        execute: async ({ runToolCall }) => {
          const tools = input.tools || createReviewTools();
          const result = runToolCall
            ? await runToolCall({
                toolName: "sync-manual-review-items",
                argumentsSummary: {
                  taskId: input.taskId,
                  bookId: input.bookId,
                  failureCount: input.failures.length,
                  processedSegmentCount: input.processedSegmentIds.length,
                  failedSegmentCount: input.failedSegmentIds.length,
                },
                getResultSummary: (toolResult) => ({
                  issueType: toolResult.issueType,
                  pending: toolResult.pending,
                  resolved: toolResult.resolved,
                }),
                execute: () =>
                  tools.syncManualReviewItems({
                    taskId: input.taskId,
                    bookId: input.bookId,
                    failures: input.failures,
                    processedSegmentIds: input.processedSegmentIds,
                    failedSegmentIds: input.failedSegmentIds,
                  }),
              })
            : await tools.syncManualReviewItems({
                taskId: input.taskId,
                bookId: input.bookId,
                failures: input.failures,
                processedSegmentIds: input.processedSegmentIds,
                failedSegmentIds: input.failedSegmentIds,
              });

          return {
            status: "completed",
            output: toSummaryRecord(result),
          };
        },
      },
    },
    createId: input.createId ?? createRuntimeId,
    appendTrace: input.appendTrace ?? (async () => undefined),
    now: input.now,
    createStageRun: input.createStageRun ?? (async () => undefined),
    updateStageRun: input.updateStageRun,
    createAgentRun: input.createAgentRun,
    updateAgentRun: input.updateAgentRun,
    createToolCall: input.createToolCall,
    updateToolCall: input.updateToolCall,
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      agentRunId: stageResult.agent.runId,
      status: stageResult.status,
      error: stageResult.agent.error,
    };
  }

  return {
    stageRunId: stageResult.id,
    agentRunId: stageResult.agent.runId,
    status: "completed",
    summary: toManualReviewHandoffSummary(stageResult.agent.output),
  };
};

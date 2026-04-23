// 一旦我被更新，请更新我的开头注释
// input: validation cycle 草稿/repair stage 结果
// output: validation cycle 辅助函数
// pos: script production runtime
import type { SegmentScriptDraft } from "../../context";
import type { QualitySignals } from "../agents/quality-judge-agent";
import { createStageSummary } from "../script-production-runtime-helpers";
import type { SegmentRunResult } from "./shared-types";
import type { RunSingleSegmentParams } from "./run-single-segment-types";

export const toDraftStructuredResult = (draft: SegmentScriptDraft) => ({
  segmentId: draft.segmentId,
  createdAt: draft.createdAt,
  lines: draft.lines.map((line) => ({ ...line })),
});

export const toDraftFailureContext = (draft: SegmentScriptDraft) => ({
  rawResponse:
    typeof draft.rawResponse === "string" && draft.rawResponse.trim().length > 0
      ? draft.rawResponse
      : undefined,
  structuredResult: toDraftStructuredResult(draft),
});

export const createRecoverySignals = (
  warnings: string[]
): QualitySignals | undefined => {
  const upstreamWarnings = [...new Set(warnings.filter((item) => item.length > 0))];
  return upstreamWarnings.length > 0 ? { upstreamWarnings } : undefined;
};

export async function recordRepairStageOutcome(params: {
  context: RunSingleSegmentParams;
  repairStage: {
    stageRunId: string;
    agentRunId?: string;
    status: "completed" | "failed" | "retrying" | "repairing";
    error?: string;
    decision?: {
      action: string;
      reason?: string;
      retryable?: boolean;
    };
  };
  failureKind: "semantic_retry" | "input_refinement";
}) {
  const { context, repairStage, failureKind } = params;

  await context.runtimeStore.updateStageRun({
    id: repairStage.stageRunId,
    workflowRunId: context.workflowRunId,
    stageId: "segment_repair",
    status: repairStage.status,
    summary: createStageSummary({
      segment: context.segment,
      stageId: "segment_repair",
      summary: {
        failureKind,
        decisionAction:
          repairStage.status === "completed"
            ? repairStage.decision?.action
            : "failed",
        decisionReason:
          repairStage.status === "completed"
            ? repairStage.decision?.reason
            : repairStage.error || "segment_repair_failed",
        retryable:
          repairStage.status === "completed"
            ? repairStage.decision?.retryable
            : repairStage.status === "retrying",
      },
    }),
    completedAt: (context.now ?? (() => new Date()))(),
  });

  context.onStageResult?.({
    id: repairStage.stageRunId,
    stageId: "segment_repair",
    status: repairStage.status,
    agent: {
      runId: repairStage.agentRunId,
      agentId: "repair-agent",
      status: repairStage.status,
      output:
        repairStage.status === "completed" && repairStage.decision
          ? { decision: repairStage.decision }
          : undefined,
      error: repairStage.status === "completed" ? undefined : repairStage.error,
    },
  });

  if (repairStage.status === "completed" && repairStage.decision) {
    await context.runtimeStore.createRuntimeArtifact({
      id: context.createId(),
      workflowRunId: context.workflowRunId,
      stageRunId: repairStage.stageRunId,
      agentRunId: repairStage.agentRunId ?? null,
      segmentId: context.segment.id,
      artifactKind: "repair-decision",
      artifactVersion: "v1",
      payload: {
        failureKind,
        decision: repairStage.decision,
      },
      createdAt: (context.now ?? (() => new Date()))(),
    });
  }
}

export const toTerminalResult = (
  result: SegmentRunResult,
  counters: SegmentRunResult["counters"]
): { status: "terminal"; result: SegmentRunResult } => ({
  status: "terminal",
  result: {
    ...result,
    counters,
  },
});

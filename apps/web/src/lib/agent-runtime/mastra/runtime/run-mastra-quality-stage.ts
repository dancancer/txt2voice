// 一旦我被更新，请更新我的开头注释
// input: quality stage 输入/mastra 运行时依赖
// output: mastra quality stage 入口
// pos: agent runtime mastra
import type { QualityVerdict } from "../../context";
import type { AgentRunRecord, ToolCallRecord } from "../../runtime/run-agent";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import type { SkillMetadataSnapshot } from "../../runtime/script-production-runtime-helpers";
import type {
  QualityReviewHandoff,
  QualityStageDecision,
  RunQualityStageInput,
  RunQualityStageResult,
} from "../../runtime/stages/run-quality-stage";
import { executeMastraQualityAgent } from "./run-mastra-quality-stage/execute-quality-agent";
import {
  createRuntimeId,
  resolveCoreQualityEvidenceKeys,
  type QualityStageRuntimeDeps,
} from "./run-mastra-quality-stage/helpers";

export const runMastraQualityStage = async (
  input: RunQualityStageInput,
  deps: QualityStageRuntimeDeps = {}
): Promise<RunQualityStageResult> => {
  const runtimeAgentId = "quality-judge-agent";
  const coreQualityEvidenceKeys = resolveCoreQualityEvidenceKeys(input);

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "quality_judgement",
      agent: {
        id: runtimeAgentId,
        inputSummary: {
          segmentId: input.segmentId,
          coverageRatio: input.validationReport.coverageRatio,
        },
        resolveFailure: () => "failed",
        execute: async () =>
          executeMastraQualityAgent({
            input,
            coreQualityEvidenceKeys,
          }),
      },
    },
    createId: deps.createId ?? input.createId ?? createRuntimeId,
    appendTrace:
      deps.appendTrace ?? input.appendTrace ?? (async () => undefined),
    now: deps.now ?? input.now,
    createStageRun:
      deps.createStageRun ??
      input.createStageRun ??
      (async (_record: StageRunRecord) => undefined),
    updateStageRun:
      deps.updateStageRun ??
      input.updateStageRun ??
      (async (_record: StageRunRecord) => undefined),
    createAgentRun:
      deps.createAgentRun ??
      input.createAgentRun ??
      (async (_record: AgentRunRecord) => undefined),
    updateAgentRun:
      deps.updateAgentRun ??
      input.updateAgentRun ??
      (async (_record: AgentRunRecord & { completedAt?: Date }) => undefined),
    createToolCall:
      deps.createToolCall ??
      input.createToolCall ??
      (async (_record: ToolCallRecord & { createdAt?: Date }) => undefined),
    updateToolCall:
      deps.updateToolCall ??
      input.updateToolCall ??
      (async (_record: ToolCallRecord & { completedAt?: Date }) => undefined),
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
      agentRunId: stageResult.agent.runId,
      status: stageResult.status,
      error: stageResult.agent.error,
    };
  }

  const fallbackVerdict: QualityVerdict = {
    segmentId: input.segmentId,
    verdict: "fail",
    score: 0,
    reasons: ["quality_stage_missing_verdict"],
  };

  return {
    stageRunId: stageResult.id,
    agentRunId: stageResult.agent.runId,
    status: "completed",
    decision:
      (stageResult.agent.output?.decision as QualityStageDecision | undefined) ??
      "auto_fail",
    verdict:
      (stageResult.agent.output?.verdict as QualityVerdict | undefined) ??
      fallbackVerdict,
    handoff: stageResult.agent.output?.handoff as
      | QualityReviewHandoff
      | undefined,
    skillMetadata: stageResult.agent.output?.skillMetadata as
      | SkillMetadataSnapshot
      | undefined,
  };
};

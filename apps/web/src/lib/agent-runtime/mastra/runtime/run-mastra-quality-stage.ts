// 一旦我被更新，请更新我的开头注释
// input: quality stage 输入
// output: Mastra quality stage 执行结果
// pos: agent runtime mastra
import { runStage } from "../../runtime/run-stage";
import type {
  QualityReviewHandoff,
  QualityStageDecision,
  RunQualityStageInput,
  RunQualityStageResult,
} from "../../runtime/stages/run-quality-stage";
import {
  createRuntimeId,
  defaultQualitySkillId,
  resolveCoreQualityEvidenceKeys,
  type QualityStageRuntimeDeps,
} from "./run-mastra-quality-stage/helpers";
import { executeMastraQualityAgent } from "./run-mastra-quality-stage/execute-quality-agent";
import type { QualityVerdict } from "../../context";

export const runMastraQualityStage = async (
  input: RunQualityStageInput,
  deps: QualityStageRuntimeDeps = {}
): Promise<RunQualityStageResult> => {
  const coreQualityEvidenceKeys = resolveCoreQualityEvidenceKeys(input);

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "quality_judgement",
      agent: {
        id: "quality-judge-agent",
        inputSummary: {
          segmentId: input.segmentId,
          coverageRatio: input.validationReport.coverageRatio,
        },
        resolveFailure: () => "failed",
        execute: () =>
          executeMastraQualityAgent({
            input,
            coreQualityEvidenceKeys,
          }),
      },
    },
    createId: deps.createId ?? input.createId ?? createRuntimeId,
    appendTrace: deps.appendTrace ?? input.appendTrace ?? (async () => undefined),
    now: deps.now ?? input.now,
    createStageRun:
      deps.createStageRun ?? input.createStageRun ?? (async () => undefined),
    updateStageRun: deps.updateStageRun ?? input.updateStageRun,
    createAgentRun: deps.createAgentRun ?? input.createAgentRun,
    updateAgentRun: deps.updateAgentRun ?? input.updateAgentRun,
    createToolCall: deps.createToolCall ?? input.createToolCall,
    updateToolCall: deps.updateToolCall ?? input.updateToolCall,
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
    handoff: stageResult.agent.output
      ?.handoff as QualityReviewHandoff | undefined,
  };
};

export { defaultQualitySkillId };

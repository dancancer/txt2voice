import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { QualityVerdict, SegmentScriptDraft, ValidationReport } from "../../context";
import type { StageExecutor } from "../executor-policy";
import {
  createQualityJudgeAgent,
  type QualitySignals,
} from "../agents/quality-judge-agent";
import {
  renderQualityJudgeUserPrompt,
  stringifyQualityPromptJson,
} from "../agents/quality-judge-agent";
import { validateAgentContract } from "../agent-contract";
import { loadSkillRuntimeBundle } from "../load-skill-runtime-bundle";
import { summarizePromptArtifact } from "../prompt-artifact-summary";
import { fitPromptToBudget, resolvePromptBudgetLimit } from "../prompt-budget";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../script-production-runtime-helpers";
import { validateSkillContract } from "../skill-contract";
import type { TraceDependencies } from "../write-trace";

interface QualityStageRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
  createAgentRun?: (record: AgentRunRecord) => Promise<void> | void;
  updateAgentRun?: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void> | void;
  createToolCall?: (record: ToolCallRecord & { createdAt?: Date }) => Promise<void> | void;
  updateToolCall?: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void> | void;
}

export interface RunQualityStageInput extends QualityStageRuntimeDeps {
  workflowRunId: string;
  segmentId: string;
  segmentScriptDraft: SegmentScriptDraft;
  validationReport: ValidationReport;
  qualitySignals?: QualitySignals;
  failedArtifact?: unknown;
  adapter?: LLMAdapter;
  workspaceRoot?: string;
  skillDir?: string;
  executor?: StageExecutor;
  shadowMode?: boolean;
  onShadowResult?: (
    result: RunQualityStageResult
  ) => Promise<void> | void;
  runMastraQualityStage?: (
    input: RunQualityStageInput
  ) => Promise<RunQualityStageResult>;
}

export interface QualityReviewHandoff {
  segmentId: string;
  summary: string;
  reasons: string[];
  evidence: {
    score: number;
    confidence: number;
    validation: {
      coverageRatio: number;
      issues: string[];
    };
  };
}

export type QualityStageDecision =
  | "auto_pass"
  | "auto_fail"
  | "manual_review_required";

interface RunQualityStageCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "completed";
  decision: QualityStageDecision;
  verdict: QualityVerdict;
  handoff?: QualityReviewHandoff;
  skillMetadata?: SkillMetadataSnapshot;
}

interface RunQualityStageNonCompletedResult {
  stageRunId: string;
  agentRunId?: string;
  status: "failed" | "retrying" | "repairing";
  error?: string;
}

export type RunQualityStageResult =
  | RunQualityStageCompletedResult
  | RunQualityStageNonCompletedResult;

interface QualitySkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

interface StageOutput {
  [key: string]: unknown;
  decision: QualityStageDecision;
  verdict: QualityVerdict;
  handoff?: QualityReviewHandoff;
}

const defaultQualitySkillId = "quality-judgement";
const DETERMINISTIC_HARD_FAIL_COVERAGE_THRESHOLD = 0.5;
const AUTO_REVIEW_SCORE_THRESHOLD = 0.8;
const AUTO_REVIEW_CONFIDENCE_THRESHOLD = 0.75;

const createRuntimeId = () =>
  `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const resolveWorkspaceRoot = (workspaceRoot?: string): string => {
  if (workspaceRoot) {
    return workspaceRoot;
  }

  let current = process.cwd();

  for (let index = 0; index < 8; index += 1) {
    const hasSkills = fs.existsSync(path.join(current, "skills"));
    const hasApps = fs.existsSync(path.join(current, "apps"));
    if (hasSkills && hasApps) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return process.cwd();
};

const resolveQualitySkillSource = (params: {
  workspaceRoot?: string;
  skillDir?: string;
}): QualitySkillSource => {
  if (params.skillDir) {
    const resolvedSkillDir = path.resolve(params.skillDir);
    const skillsDir = path.dirname(resolvedSkillDir);

    if (path.basename(skillsDir) !== "skills") {
      throw new Error(
        `skillDir must target <workspace>/skills/<skill-id>: ${params.skillDir}`
      );
    }

    return {
      workspaceRoot: path.dirname(skillsDir),
      skillId: path.basename(resolvedSkillDir),
      skillDir: resolvedSkillDir,
    };
  }

  const workspaceRoot = resolveWorkspaceRoot(params.workspaceRoot);
  return {
    workspaceRoot,
    skillId: defaultQualitySkillId,
    skillDir: path.join(workspaceRoot, "skills", defaultQualitySkillId),
  };
};

const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../adapters/llm-adapter");
  return createDefaultLLMAdapter();
};

const normalizeIssueReason = (issue: ValidationReport["issues"][number]): string =>
  `${issue.code}: ${issue.message}`.trim();

const collectIssueReasons = (validationReport: ValidationReport): string[] => {
  const reasons = validationReport.issues
    .map((issue) => normalizeIssueReason(issue))
    .filter((reason) => reason.length > 0);

  if (reasons.length > 0) {
    return reasons;
  }

  return ["deterministic_validation_failed"];
};

const collectIssueCodes = (validationReport: ValidationReport): string[] =>
  validationReport.issues
    .map((issue) => issue.code.trim())
    .filter((code) => code.length > 0);

const createManualReviewHandoff = (params: {
  segmentId: string;
  summary: string;
  reasons: string[];
  score: number;
  confidence: number;
  validationReport: ValidationReport;
}): QualityReviewHandoff => ({
  segmentId: params.segmentId,
  summary: params.summary,
  reasons: params.reasons,
  evidence: {
    score: params.score,
    confidence: params.confidence,
    validation: {
      coverageRatio: params.validationReport.coverageRatio,
      issues: collectIssueCodes(params.validationReport),
    },
  },
});

const resolveDeterministicDecision = (
  input: RunQualityStageInput
): StageOutput | null => {
  if (input.validationReport.valid) {
    return null;
  }

  const reasons = collectIssueReasons(input.validationReport);
  const fallbackScore = Number(input.validationReport.coverageRatio.toFixed(4));
  const verdict: QualityVerdict = {
    segmentId: input.segmentId,
    verdict: "fail",
    score: fallbackScore,
    reasons,
  };

  if (
    input.validationReport.coverageRatio < DETERMINISTIC_HARD_FAIL_COVERAGE_THRESHOLD
  ) {
    return {
      decision: "auto_fail",
      verdict,
    };
  }

  return {
    decision: "manual_review_required",
    verdict: {
      ...verdict,
      verdict: "manual_review",
    },
    handoff: createManualReviewHandoff({
      segmentId: input.segmentId,
      summary: "deterministic_validation_requires_manual_review",
      reasons,
      score: fallbackScore,
      confidence: 1,
      validationReport: input.validationReport,
    }),
  };
};

const resolveSemanticDecision = (params: {
  segmentId: string;
  verdict: QualityVerdict;
  confidence: number;
  summary: string;
  validationReport: ValidationReport;
  qualitySignals?: QualitySignals;
}): StageOutput => {
  const forceManualReview = params.qualitySignals?.forceManualReview === true;
  const lowScore = params.verdict.score < AUTO_REVIEW_SCORE_THRESHOLD;
  const lowConfidence = params.confidence < AUTO_REVIEW_CONFIDENCE_THRESHOLD;

  if (forceManualReview || lowScore || lowConfidence) {
    return {
      decision: "manual_review_required",
      verdict: {
        ...params.verdict,
        verdict: "manual_review",
      },
      handoff: createManualReviewHandoff({
        segmentId: params.segmentId,
        summary: params.summary,
        reasons: params.verdict.reasons,
        score: params.verdict.score,
        confidence: params.confidence,
        validationReport: params.validationReport,
      }),
    };
  }

  return {
    decision: "auto_pass",
    verdict: params.verdict,
  };
};

export const runQualityStageNative = async (
  input: RunQualityStageInput
): Promise<RunQualityStageResult> => {
  const runtimeAgentId = "quality-judge-agent";
  const promptBudget = {
    maxContextChars: 5000,
    reservedOutputChars: 1200,
  } as const;

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
        execute: async () => {
          const deterministicDecision = resolveDeterministicDecision(input);
          if (deterministicDecision) {
            return {
              status: "completed",
              output: deterministicDecision,
            };
          }
          const skillSource = resolveQualitySkillSource({
            workspaceRoot: input.workspaceRoot,
            skillDir: input.skillDir,
          });
          const skill = loadSkillRuntimeBundle(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          validateAgentContract({
            workspaceRoot: skillSource.workspaceRoot,
            agentSourceId: "quality-judge",
            stageId: "quality_judgement",
            skill: skill.definition,
            registeredTools: [],
          });
          validateSkillContract({
            skill: skill.definition,
            agentId: runtimeAgentId,
            expectedContextRequirements: [
              "segment_script_draft",
              "validation_report",
              "quality_signals",
              "failed_artifact",
            ],
            expectedOutputSchemaRef: "quality-verdict",
          });
          const failedArtifactSummary = summarizePromptArtifact(
            input.failedArtifact
          );
          const promptBudgetResult = fitPromptToBudget({
            systemPrompt: skill.systemPrompt,
            maxPromptChars: resolvePromptBudgetLimit(promptBudget),
            variables: {
              segment_script_draft_json: stringifyQualityPromptJson(
                input.segmentScriptDraft
              ),
              validation_report_json: stringifyQualityPromptJson(
                input.validationReport
              ),
              quality_signals_json: stringifyQualityPromptJson(
                input.qualitySignals ?? {}
              ),
              failed_artifact_json: stringifyQualityPromptJson(
                failedArtifactSummary
              ),
            },
            trimOrder: ["failed_artifact_json"],
            renderPrompt: (variables) =>
              skill.userPrompt
                .split("{{segment_script_draft_json}}")
                .join(variables.segment_script_draft_json)
                .split("{{validation_report_json}}")
                .join(variables.validation_report_json)
                .split("{{quality_signals_json}}")
                .join(variables.quality_signals_json)
                .split("{{failed_artifact_json}}")
                .join(variables.failed_artifact_json),
          });
          if (promptBudgetResult.overBudget) {
            return {
              status: "completed",
              output: {
                decision: "manual_review_required",
                verdict: {
                  segmentId: input.segmentId,
                  verdict: "manual_review",
                  score: 0,
                  reasons: ["quality_prompt_over_budget"],
                },
                handoff: createManualReviewHandoff({
                  segmentId: input.segmentId,
                  summary: "quality_prompt_over_budget",
                  reasons: ["quality_prompt_over_budget"],
                  score: 0,
                  confidence: 0,
                  validationReport: input.validationReport,
                }),
              },
            };
          }
          const adapter = await resolveAdapter(input.adapter);
          const agent = createQualityJudgeAgent({
            adapter,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentScriptDraft: input.segmentScriptDraft,
            validationReport: input.validationReport,
            qualitySignals: input.qualitySignals,
            failedArtifact:
              failedArtifactSummary ??
              input.failedArtifact ??
              null,
            modelPolicy: skill.definition.modelPolicy!,
            prompts: {
              systemPrompt: skill.systemPrompt,
              userPrompt: skill.userPrompt,
            },
          });
          const skillMetadata = buildSkillMetadataSnapshot(skill.definition);
          const decision = resolveSemanticDecision({
            segmentId: input.segmentId,
            verdict: result.verdict,
            confidence: result.confidence,
            summary: result.summary,
            validationReport: input.validationReport,
            qualitySignals: input.qualitySignals,
          });

          return {
            status: "completed",
            output: {
              ...decision,
              skillMetadata,
            },
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
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
  };
};

const buildShadowInput = (
  input: RunQualityStageInput
): RunQualityStageInput => ({
  ...input,
  shadowMode: false,
  onShadowResult: undefined,
  createStageRun: undefined,
  updateStageRun: undefined,
  createAgentRun: undefined,
  updateAgentRun: undefined,
  createToolCall: undefined,
  updateToolCall: undefined,
  appendTrace: async () => undefined,
});

export const runQualityStage = async (
  input: RunQualityStageInput
): Promise<RunQualityStageResult> => {
  const runMastraQualityStage =
    input.runMastraQualityStage ??
    (async () => {
      throw new Error(
        "Mastra runtime is disabled for quality-judgement until an independent executor path exists"
      );
    });

  if (input.executor === "mastra") {
    return runMastraQualityStage(input);
  }

  if (input.shadowMode) {
    const nativePromise = runQualityStageNative(input);
    const shadowPromise = runMastraQualityStage(buildShadowInput(input));
    const [nativeResult, shadowResult] = await Promise.all([
      nativePromise,
      shadowPromise.catch(() => null),
    ]);
    if (shadowResult) {
      await input.onShadowResult?.(shadowResult);
    }

    return nativeResult;
  }

  return runQualityStageNative(input);
};

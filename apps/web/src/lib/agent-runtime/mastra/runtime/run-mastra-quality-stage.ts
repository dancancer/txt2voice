import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import type {
  QualityVerdict,
  ValidationReport,
} from "../../context";
import {
  createQualityJudgeAgent,
  renderQualityJudgeUserPromptFromVariables,
  type QualitySignals,
} from "../../runtime/agents/quality-judge-agent";
import { validateAgentContract } from "../../runtime/agent-contract";
import { buildCharacterMemorySummary } from "../../runtime/character-memory/summary";
import { createCharacterMemorySnapshot } from "../../runtime/character-memory/store";
import {
  composeRuntimeSystemPrompt,
  loadSkillRuntimeBundle,
} from "../../runtime/load-skill-runtime-bundle";
import { summarizePromptArtifact } from "../../runtime/prompt-artifact-summary";
import { fitPromptToBudget, resolvePromptBudgetLimit } from "../../runtime/prompt-budget";
import type { AgentRunRecord, ToolCallRecord } from "../../runtime/run-agent";
import { runStage, type StageRunRecord } from "../../runtime/run-stage";
import {
  buildSkillMetadataSnapshot,
  type SkillMetadataSnapshot,
} from "../../runtime/script-production-runtime-helpers";
import { validateSkillContract } from "../../runtime/skill-contract";
import type { TraceDependencies } from "../../runtime/write-trace";
import type {
  QualityReviewHandoff,
  QualityStageDecision,
  RunQualityStageInput,
  RunQualityStageResult,
} from "../../runtime/stages/run-quality-stage";

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
  unresolvedSpeakers?: string[];
  aliasConflictCount?: number;
}): StageOutput => {
  const forceManualReview = params.qualitySignals?.forceManualReview === true;
  const lowScore = params.verdict.score < AUTO_REVIEW_SCORE_THRESHOLD;
  const lowConfidence = params.confidence < AUTO_REVIEW_CONFIDENCE_THRESHOLD;
  const hasUnresolvedSpeakers = (params.unresolvedSpeakers?.length ?? 0) > 0;
  const hasAliasConflicts = (params.aliasConflictCount ?? 0) > 0;

  if (
    forceManualReview ||
    lowScore ||
    lowConfidence ||
    hasUnresolvedSpeakers ||
    hasAliasConflicts
  ) {
    const reasons = [...params.verdict.reasons];

    if (hasUnresolvedSpeakers) {
      reasons.push("unresolved_speakers_present");
    }
    if (hasAliasConflicts) {
      reasons.push("alias_conflicts_present");
    }

    return {
      decision: "manual_review_required",
      verdict: {
        ...params.verdict,
        verdict: "manual_review",
        reasons,
      },
      handoff: createManualReviewHandoff({
        segmentId: params.segmentId,
        summary: params.summary,
        reasons,
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

export const runMastraQualityStage = async (
  input: RunQualityStageInput,
  deps: QualityStageRuntimeDeps = {}
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
          const agentContract = validateAgentContract({
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
              "character_memory_summary",
              "character_resolution_evidence",
            ],
            expectedOutputSchemaRef: "quality-verdict",
          });
          const failedArtifactSummary = summarizePromptArtifact(input.failedArtifact);
          const memorySnapshot = input.characterMemory
            ? createCharacterMemorySnapshot({
                memory: input.characterMemory,
              })
            : undefined;
          const characterMemorySummary = memorySnapshot
            ? buildCharacterMemorySummary(memorySnapshot)
            : "";
          const runtimeSystemPrompt = composeRuntimeSystemPrompt({
            agentInstructions: agentContract.agentInstructions,
            skillInstructions: skill.instructions,
            systemPrompt: skill.systemPrompt,
          });
          const promptBudgetResult = fitPromptToBudget({
            systemPrompt: runtimeSystemPrompt,
            maxPromptChars: resolvePromptBudgetLimit(promptBudget),
            variables: {
              segment_script_draft_json: JSON.stringify(
                input.segmentScriptDraft,
                null,
                2
              ),
              validation_report_json: JSON.stringify(input.validationReport, null, 2),
              quality_signals_json: JSON.stringify(input.qualitySignals ?? {}, null, 2),
              failed_artifact_json: JSON.stringify(failedArtifactSummary, null, 2),
              character_memory_summary: characterMemorySummary,
              character_resolution_evidence_json: JSON.stringify(
                input.characterResolutionEvidence ?? null,
                null,
                2
              ),
            },
            trimOrder: [
              "failed_artifact_json",
              "character_resolution_evidence_json",
              "character_memory_summary",
              "quality_signals_json",
              "validation_report_json",
              "segment_script_draft_json",
            ],
            variableStrategies: {
              failed_artifact_json: "json_summary",
              character_resolution_evidence_json: "json_summary",
              quality_signals_json: "json_summary",
              validation_report_json: "json_summary",
              segment_script_draft_json: "json_summary",
            },
            renderPrompt: (variables) =>
              renderQualityJudgeUserPromptFromVariables(skill.userPrompt, {
                segment_script_draft_json: variables.segment_script_draft_json,
                validation_report_json: variables.validation_report_json,
                quality_signals_json: variables.quality_signals_json,
                failed_artifact_json: variables.failed_artifact_json,
                character_memory_summary: variables.character_memory_summary,
                character_resolution_evidence_json:
                  variables.character_resolution_evidence_json,
              }),
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
          const agent = createQualityJudgeAgent({ adapter });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentScriptDraft: input.segmentScriptDraft,
            validationReport: input.validationReport,
            qualitySignals: input.qualitySignals,
            failedArtifact: failedArtifactSummary ?? input.failedArtifact ?? null,
            characterMemorySummary,
            characterResolutionEvidence: input.characterResolutionEvidence ?? null,
            modelPolicy: skill.definition.modelPolicy!,
            renderedUserPrompt: promptBudgetResult.prompt,
            prompts: {
              systemPrompt: runtimeSystemPrompt,
              userPrompt: skill.userPrompt,
            },
          });
          const skillMetadata = buildSkillMetadataSnapshot(skill.definition, {
            runtimeSystemPrompt,
            systemPrompt: skill.systemPrompt,
            userPrompt: skill.userPrompt,
          });
          const decision = resolveSemanticDecision({
            segmentId: input.segmentId,
            verdict: result.verdict,
            confidence: result.confidence,
            summary: result.summary,
            validationReport: input.validationReport,
            qualitySignals: input.qualitySignals,
            unresolvedSpeakers:
              input.characterResolutionEvidence?.unresolvedSpeakers,
            aliasConflictCount:
              input.characterResolutionEvidence?.aliasConflicts.length,
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
    createId: deps.createId ?? input.createId ?? createRuntimeId,
    appendTrace:
      deps.appendTrace ?? input.appendTrace ?? (async () => undefined),
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
    skillMetadata: stageResult.agent.output
      ?.skillMetadata as SkillMetadataSnapshot | undefined,
  };
};

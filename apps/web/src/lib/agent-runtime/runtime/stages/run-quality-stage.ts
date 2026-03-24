import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { QualityVerdict, SegmentScriptDraft, ValidationReport } from "../../context";
import { loadSkillDefinition } from "../../registry";
import {
  createQualityJudgeAgent,
  type QualitySignals,
} from "../agents/quality-judge-agent";
import { runStage, type StageRunRecord } from "../run-stage";
import type { TraceDependencies } from "../write-trace";

interface QualityStageRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: (record: StageRunRecord) => Promise<void> | void;
  updateStageRun?: (record: StageRunRecord) => Promise<void> | void;
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
  status: "completed";
  decision: QualityStageDecision;
  verdict: QualityVerdict;
  handoff?: QualityReviewHandoff;
}

interface RunQualityStageNonCompletedResult {
  stageRunId: string;
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

const readRequiredFile = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
};

const loadQualityPrompts = (skillDir: string) => ({
  systemPrompt: readRequiredFile(path.join(skillDir, "prompts/system.md")),
  userPrompt: readRequiredFile(path.join(skillDir, "prompts/user.md")),
});

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

const assertSkillCompatibleWithAgent = (
  skillId: string,
  compatibleAgents: string[],
  agentId: string
) => {
  if (compatibleAgents.includes(agentId)) {
    return;
  }

  throw new Error(`Skill ${skillId} is not compatible with ${agentId}`);
};

const assertSkillContract = (definition: {
  id: string;
  contextRequirements: string[];
  toolAllowlist: string[];
  outputSchemaRef: string;
}) => {
  const expectedRequirements = new Set([
    "segment_script_draft",
    "validation_report",
    "quality_signals",
    "failed_artifact",
  ]);

  if (
    definition.contextRequirements.length !== expectedRequirements.size ||
    definition.contextRequirements.some(
      (requirement) => !expectedRequirements.has(requirement)
    )
  ) {
    throw new Error(
      `Skill ${definition.id} has unsupported contextRequirements: expected ["segment_script_draft", "validation_report", "quality_signals", "failed_artifact"]`
    );
  }

  if (definition.toolAllowlist.length > 0) {
    throw new Error(`Skill ${definition.id} must declare empty toolAllowlist`);
  }

  if (definition.outputSchemaRef !== "quality-verdict") {
    throw new Error(
      `Skill ${definition.id} has unsupported outputSchemaRef: expected "quality-verdict"`
    );
  }
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

export const runQualityStage = async (
  input: RunQualityStageInput
): Promise<RunQualityStageResult> => {
  const runtimeAgentId = "quality-judge-agent";

  const stageResult = await runStage({
    workflowRunId: input.workflowRunId,
    stage: {
      id: "quality_judgement",
      agent: {
        id: runtimeAgentId,
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
          const skill = loadSkillDefinition(
            skillSource.workspaceRoot,
            skillSource.skillId
          );
          assertSkillCompatibleWithAgent(
            skill.definition.id,
            skill.definition.compatibleAgents,
            runtimeAgentId
          );
          assertSkillContract(skill.definition);
          const prompts = loadQualityPrompts(skillSource.skillDir);
          const adapter = await resolveAdapter(input.adapter);
          const agent = createQualityJudgeAgent({
            adapter,
          });
          const result = await agent.execute({
            segmentId: input.segmentId,
            segmentScriptDraft: input.segmentScriptDraft,
            validationReport: input.validationReport,
            qualitySignals: input.qualitySignals,
            failedArtifact: input.failedArtifact,
            prompts,
          });
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
            output: decision,
          };
        },
      },
    },
    createId: input.createId ?? createRuntimeId,
    appendTrace: input.appendTrace ?? (async () => undefined),
    now: input.now,
    createStageRun: input.createStageRun ?? (async () => undefined),
    updateStageRun: input.updateStageRun,
  });

  if (stageResult.status !== "completed") {
    return {
      stageRunId: stageResult.id,
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

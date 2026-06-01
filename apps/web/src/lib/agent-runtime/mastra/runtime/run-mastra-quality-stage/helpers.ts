// 一旦我被更新，请更新我的开头注释
// input: quality stage 输入/trace 依赖/skill 定位
// output: mastra quality stage 共享辅助函数/长段台本质检预算
// pos: agent runtime mastra
import fs from "fs";
import path from "path";

import type { LLMAdapter } from "../../../adapters/llm-adapter";
import type { QualityVerdict, ValidationReport } from "../../../context";
import type { TraceDependencies } from "../../../runtime/write-trace";
import type {
  QualityReviewHandoff,
  QualityStageDecision,
  RunQualityStageInput,
} from "../../../runtime/stages/run-quality-stage";
import type { QualitySignals } from "../../../runtime/agents/quality-judge-agent";

export interface QualityStageRuntimeDeps {
  createId?: TraceDependencies["createId"];
  appendTrace?: TraceDependencies["appendTrace"];
  now?: TraceDependencies["now"];
  createStageRun?: TraceDependencies["appendTrace"] extends (...args: infer _A) => infer _R
    ? (record: any) => Promise<void> | void
    : never;
  updateStageRun?: (record: any) => Promise<void> | void;
  createAgentRun?: (record: any) => Promise<void> | void;
  updateAgentRun?: (record: any) => Promise<void> | void;
  createToolCall?: (record: any) => Promise<void> | void;
  updateToolCall?: (record: any) => Promise<void> | void;
}

export interface QualitySkillSource {
  workspaceRoot: string;
  skillId: string;
  skillDir: string;
}

export interface StageOutput {
  [key: string]: unknown;
  decision: QualityStageDecision;
  verdict: QualityVerdict;
  handoff?: QualityReviewHandoff;
}

export const defaultQualitySkillId = "quality-judgement";
const DETERMINISTIC_HARD_FAIL_COVERAGE_THRESHOLD = 0.5;
const AUTO_REVIEW_SCORE_THRESHOLD = 0.8;
const AUTO_REVIEW_CONFIDENCE_THRESHOLD = 0.75;
export const QUALITY_STAGE_PROMPT_BUDGET = {
  maxContextChars: 50000,
  reservedOutputChars: 6000,
} as const;
const CORE_QUALITY_EVIDENCE_KEYS = new Set([
  "segment_script_draft_json",
  "validation_report_json",
  "character_resolution_evidence_json",
]);

export const resolveCoreQualityEvidenceKeys = (input: RunQualityStageInput) => {
  const keys = new Set(CORE_QUALITY_EVIDENCE_KEYS);

  if (input.characterResolutionEvidence == null) {
    keys.delete("character_resolution_evidence_json");
  }

  return keys;
};

export const createRuntimeId = () =>
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

export const resolveQualitySkillSource = (params: {
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

export const resolveAdapter = async (adapter?: LLMAdapter): Promise<LLMAdapter> => {
  if (adapter) {
    return adapter;
  }

  const { createDefaultLLMAdapter } = await import("../../../adapters/llm-adapter");
  return createDefaultLLMAdapter();
};

const normalizeIssueReason = (issue: ValidationReport["issues"][number]): string =>
  `${issue.code}: ${issue.message}`.trim();

export const collectIssueReasons = (validationReport: ValidationReport): string[] => {
  const reasons = validationReport.issues
    .map((issue: ValidationReport["issues"][number]) => normalizeIssueReason(issue))
    .filter((reason: string) => reason.length > 0);

  if (reasons.length > 0) {
    return reasons;
  }

  return ["deterministic_validation_failed"];
};

const collectIssueCodes = (validationReport: ValidationReport): string[] =>
  validationReport.issues
    .map((issue: ValidationReport["issues"][number]) => issue.code.trim())
    .filter((code: string) => code.length > 0);

export const createManualReviewHandoff = (params: {
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

export const resolveDeterministicDecision = (
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

export const resolveSemanticDecision = (params: {
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

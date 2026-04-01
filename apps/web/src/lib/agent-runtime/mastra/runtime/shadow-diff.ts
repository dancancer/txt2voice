import type { RunCharacterDiscoveryStageResult } from "../../runtime/stages/run-character-discovery-stage";
import type { RunQualityStageResult } from "../../runtime/stages/run-quality-stage";
import type { RunSegmentRepairStageResult } from "../../runtime/stages/run-segment-repair-stage";
import type { RunSegmentScriptingStageResult } from "../../runtime/stages/run-segment-scripting-stage";

type ShadowComparableStageResult =
  | RunCharacterDiscoveryStageResult
  | RunSegmentScriptingStageResult
  | RunSegmentRepairStageResult
  | RunQualityStageResult;

type ShadowDiffStageId =
  | "character_discovery"
  | "segment_scripting"
  | "segment_repair"
  | "quality_judgement";

interface ShadowComparableSummary {
  status: string;
  skillId?: string;
  outputSummary?: Record<string, unknown>;
  validationResult?: Record<string, unknown>;
  manualReviewJudgement?: Record<string, unknown>;
}

export interface ShadowDiffArtifactPayload {
  stageId: ShadowDiffStageId;
  segmentId?: string;
  matched: boolean;
  differingFields: string[];
  native: ShadowComparableSummary;
  shadow: ShadowComparableSummary;
}

const stableStringify = (value: unknown) => JSON.stringify(value ?? null);

const countRecordKeys = (value: Record<string, unknown> | undefined) =>
  value ? Object.keys(value).length : 0;

const summarizeCharacterDiscovery = (
  result: RunCharacterDiscoveryStageResult
): ShadowComparableSummary => ({
  status: result.status,
  skillId: result.status === "completed" ? result.artifact.skillId : undefined,
  outputSummary:
    result.status === "completed"
      ? {
          canonicalIdentityCount:
            result.artifact.characterMemoryDraft.canonicalIdentities?.length ?? 0,
          aliasEvidenceCount:
            result.artifact.characterMemoryDraft.aliasEvidence?.length ?? 0,
          assertedFactCount: countRecordKeys(
            result.artifact.characterMemoryDraft.assertedFacts
          ),
          inferredHintCount: countRecordKeys(
            result.artifact.characterMemoryDraft.inferredHints
          ),
        }
      : undefined,
});

const summarizeSegmentScripting = (
  result: RunSegmentScriptingStageResult
): ShadowComparableSummary => ({
  status: result.status,
  skillId: result.status === "completed" ? result.artifact.skillId : undefined,
  outputSummary:
    result.status === "completed"
      ? {
          lineCount: result.artifact.segmentScriptDraft.lines.length,
        }
      : undefined,
});

const summarizeSegmentRepair = (
  result: RunSegmentRepairStageResult
): ShadowComparableSummary => ({
  status: result.status,
  skillId:
    result.status === "completed" && result.artifact
      ? result.artifact.skillId
      : undefined,
  outputSummary:
    result.status === "completed"
      ? {
          decisionAction: result.decision.action,
          decisionReason: result.decision.reason,
          artifactLineCount: result.artifact?.segmentScriptDraft.lines.length ?? 0,
        }
      : undefined,
  validationResult:
    result.status === "completed"
      ? {
          retryable: result.decision.retryable,
        }
      : undefined,
  manualReviewJudgement:
    result.status === "completed"
      ? {
          required: result.decision.action === "manual_review",
          action: result.decision.action,
        }
      : undefined,
});

const summarizeQuality = (
  result: RunQualityStageResult
): ShadowComparableSummary => ({
  status: result.status,
  outputSummary:
    result.status === "completed"
      ? {
          decision: result.decision,
          verdict: result.verdict.verdict,
          score: result.verdict.score,
        }
      : undefined,
  validationResult:
    result.status === "completed"
      ? {
          reasons: result.verdict.reasons,
        }
      : undefined,
  manualReviewJudgement:
    result.status === "completed"
      ? {
          required: result.decision === "manual_review_required",
          reasons: result.handoff?.reasons ?? [],
          summary: result.handoff?.summary,
        }
      : undefined,
});

const summarizeStageResult = (
  stageId: ShadowDiffStageId,
  result: ShadowComparableStageResult
): ShadowComparableSummary => {
  switch (stageId) {
    case "character_discovery":
      return summarizeCharacterDiscovery(result as RunCharacterDiscoveryStageResult);
    case "segment_scripting":
      return summarizeSegmentScripting(result as RunSegmentScriptingStageResult);
    case "segment_repair":
      return summarizeSegmentRepair(result as RunSegmentRepairStageResult);
    case "quality_judgement":
      return summarizeQuality(result as RunQualityStageResult);
  }
};

export const createShadowDiffPayload = (params: {
  stageId: ShadowDiffStageId;
  segmentId?: string;
  nativeResult: ShadowComparableStageResult;
  shadowResult: ShadowComparableStageResult;
}): ShadowDiffArtifactPayload => {
  const native = summarizeStageResult(params.stageId, params.nativeResult);
  const shadow = summarizeStageResult(params.stageId, params.shadowResult);
  const differingFields = [
    "status",
    "skillId",
    "outputSummary",
    "validationResult",
    "manualReviewJudgement",
  ].filter(
    (field) =>
      stableStringify(native[field as keyof ShadowComparableSummary]) !==
      stableStringify(shadow[field as keyof ShadowComparableSummary])
  );

  return {
    stageId: params.stageId,
    segmentId: params.segmentId,
    matched: differingFields.length === 0,
    differingFields,
    native,
    shadow,
  };
};

// 一旦我被更新，请更新我的开头注释
// input: 阶段证据/checkpoint/版本指纹
// output: 自动编排下一步决策与 checkpoint patch
// pos: 自动编排纯决策模块
import {
  AUTO_PIPELINE_STAGE_ORDER,
  type AutoPipelineCheckpoint,
  type AutoPipelineCheckpointMap,
  type AutoPipelineCheckpointPatch,
  type AutoPipelineDecision,
  type AutoPipelineSourceFingerprint,
  type AutoPipelineStage,
  type AutoPipelineStageVersion,
} from "./common";

export interface AutoPipelineStageEvidence {
  artifactCount?: number;
  hasArtifacts?: boolean;
  blockingManualReviewCount?: number;
  failedTask?: {
    taskId: string;
    retryable: boolean;
    error?: string | null;
  } | null;
}

export interface AutoPipelineDecisionInput {
  stage: AutoPipelineStage;
  checkpoint?: AutoPipelineCheckpoint | null;
  sourceFingerprint: AutoPipelineSourceFingerprint;
  stageVersion: AutoPipelineStageVersion;
  artifactHash: string;
  evidence?: AutoPipelineStageEvidence;
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as any)[key])}`)
    .join(",")}}`;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  stableJson(left) === stableJson(right);

const decision = (
  input: Omit<AutoPipelineDecision, "retryable" | "manualReviewRequired"> &
    Partial<Pick<AutoPipelineDecision, "retryable" | "manualReviewRequired">>
): AutoPipelineDecision => ({
  retryable: false,
  manualReviewRequired: false,
  ...input,
});

export const buildCheckpointPatch = (
  checkpoint: AutoPipelineCheckpoint
): AutoPipelineCheckpointPatch => ({
  checkpoints: {
    [checkpoint.stage]: {
      ...checkpoint,
      invalidatedAt: checkpoint.invalidatedAt ?? null,
      invalidationReason: checkpoint.invalidationReason ?? null,
    },
  },
});

export const markCheckpointInvalid = ({
  checkpoints,
  stage,
  reason,
  invalidatedAt = new Date().toISOString(),
}: {
  checkpoints: AutoPipelineCheckpointMap;
  stage: AutoPipelineStage;
  reason: string;
  invalidatedAt?: string;
}): AutoPipelineCheckpointPatch => {
  const start = AUTO_PIPELINE_STAGE_ORDER.indexOf(stage);
  const invalidated: AutoPipelineCheckpointMap = {};

  for (const nextStage of AUTO_PIPELINE_STAGE_ORDER.slice(start)) {
    const checkpoint = checkpoints[nextStage];
    if (!checkpoint) {
      continue;
    }

    invalidated[nextStage] = {
      ...checkpoint,
      invalidatedAt,
      invalidationReason: reason,
    };
  }

  return { checkpoints: invalidated };
};

const checkpointMatches = ({
  checkpoint,
  sourceFingerprint,
  stageVersion,
  artifactHash,
}: {
  checkpoint: AutoPipelineCheckpoint;
  sourceFingerprint: AutoPipelineSourceFingerprint;
  stageVersion: AutoPipelineStageVersion;
  artifactHash: string;
}): boolean =>
  !checkpoint.invalidatedAt &&
  Boolean(checkpoint.completedAt) &&
  checkpoint.artifactHash === artifactHash &&
  sameValue(checkpoint.sourceFingerprint, sourceFingerprint) &&
  sameValue(checkpoint.stageVersion, stageVersion);

export const buildStageDecision = ({
  stage,
  checkpoint,
  sourceFingerprint,
  stageVersion,
  artifactHash,
  evidence = {},
}: AutoPipelineDecisionInput): AutoPipelineDecision => {
  if ((evidence.blockingManualReviewCount ?? 0) > 0) {
    return decision({
      action: "manual_review",
      stage,
      reason: "blocking_manual_review",
      manualReviewRequired: true,
    });
  }

  if (evidence.failedTask) {
    return decision({
      action: evidence.failedTask.retryable ? "retry" : "fail",
      stage,
      reason: evidence.failedTask.error || "stage_task_failed",
      retryable: evidence.failedTask.retryable,
    });
  }

  if (
    checkpoint &&
    evidence.hasArtifacts !== false &&
    checkpointMatches({ checkpoint, sourceFingerprint, stageVersion, artifactHash })
  ) {
    return decision({
      action: "skip",
      stage,
      reason: "checkpoint_current",
    });
  }

  return decision({
    action: "run",
    stage,
    reason: checkpoint?.invalidatedAt ? "checkpoint_invalidated" : "checkpoint_missing_or_stale",
  });
};

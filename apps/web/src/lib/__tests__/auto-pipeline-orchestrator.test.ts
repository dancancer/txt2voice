import {
  buildCheckpointPatch,
  buildStageDecision,
  markCheckpointInvalid,
} from "@/lib/auto-pipeline/orchestrator";
import type {
  AutoPipelineCheckpoint,
  AutoPipelineSourceFingerprint,
  AutoPipelineStageVersion,
} from "@/lib/auto-pipeline/common";

const sourceFingerprint: AutoPipelineSourceFingerprint = {
  uploadedFilePath: "/books/a.txt",
  originalFilename: "a.txt",
  fileSize: 100,
  optionsHash: "text-options@1",
};

const stageVersion: AutoPipelineStageVersion = {
  version: "script@1",
  inputs: {
    promptHash: "prompt-a",
  },
};

const checkpoint = (
  overrides: Partial<AutoPipelineCheckpoint> = {}
): AutoPipelineCheckpoint => ({
  stage: "script_generation",
  sourceFingerprint,
  stageVersion,
  artifactHash: "artifact-a",
  taskId: "task-1",
  completedAt: "2026-01-01T00:00:00.000Z",
  invalidatedAt: null,
  invalidationReason: null,
  ...overrides,
});

describe("auto pipeline orchestrator", () => {
  it("builds completed checkpoint patches without side effects", () => {
    expect(buildCheckpointPatch(checkpoint())).toEqual({
      checkpoints: {
        script_generation: checkpoint(),
      },
    });
  });

  it("skips a stage only when checkpoint evidence is current", () => {
    expect(
      buildStageDecision({
        stage: "script_generation",
        checkpoint: checkpoint(),
        sourceFingerprint,
        stageVersion,
        artifactHash: "artifact-a",
        evidence: { hasArtifacts: true },
      })
    ).toMatchObject({
      action: "skip",
      reason: "checkpoint_current",
      retryable: false,
      manualReviewRequired: false,
    });
  });

  it("runs when source fingerprint is stale", () => {
    expect(
      buildStageDecision({
        stage: "script_generation",
        checkpoint: checkpoint(),
        sourceFingerprint: {
          ...sourceFingerprint,
          fileSize: 200,
        },
        stageVersion,
        artifactHash: "artifact-a",
      }).action
    ).toBe("run");
  });

  it("runs when stage version or artifact hash is stale", () => {
    const staleVersion = buildStageDecision({
      stage: "script_generation",
      checkpoint: checkpoint(),
      sourceFingerprint,
      stageVersion: {
        ...stageVersion,
        version: "script@2",
      },
      artifactHash: "artifact-a",
    });
    const staleArtifact = buildStageDecision({
      stage: "script_generation",
      checkpoint: checkpoint(),
      sourceFingerprint,
      stageVersion,
      artifactHash: "artifact-b",
    });

    expect(staleVersion.action).toBe("run");
    expect(staleArtifact.action).toBe("run");
  });

  it("invalidates the requested stage and all downstream checkpoints", () => {
    const patch = markCheckpointInvalid({
      checkpoints: {
        text_processing: checkpoint({ stage: "text_processing" }),
        script_generation: checkpoint({ stage: "script_generation" }),
        audio_generation: checkpoint({ stage: "audio_generation" }),
        quality_check: checkpoint({ stage: "quality_check" }),
      },
      stage: "script_generation",
      reason: "source_changed",
      invalidatedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(patch.checkpoints.text_processing).toBeUndefined();
    expect(patch.checkpoints.script_generation?.invalidationReason).toBe(
      "source_changed"
    );
    expect(patch.checkpoints.audio_generation?.invalidationReason).toBe(
      "source_changed"
    );
    expect(patch.checkpoints.quality_check?.invalidationReason).toBe(
      "source_changed"
    );
  });

  it("does not skip invalidated checkpoints", () => {
    expect(
      buildStageDecision({
        stage: "script_generation",
        checkpoint: checkpoint({
          invalidatedAt: "2026-01-02T00:00:00.000Z",
          invalidationReason: "source_changed",
        }),
        sourceFingerprint,
        stageVersion,
        artifactHash: "artifact-a",
      })
    ).toMatchObject({
      action: "run",
      reason: "checkpoint_invalidated",
    });
  });

  it("retries retryable failed stage tasks", () => {
    expect(
      buildStageDecision({
        stage: "audio_generation",
        sourceFingerprint,
        stageVersion,
        artifactHash: "audio-a",
        evidence: {
          failedTask: {
            taskId: "task-audio",
            retryable: true,
            error: "temporary provider failure",
          },
        },
      })
    ).toMatchObject({
      action: "retry",
      retryable: true,
      reason: "temporary provider failure",
    });
  });

  it("fails non-retryable failed stage tasks", () => {
    expect(
      buildStageDecision({
        stage: "text_processing",
        sourceFingerprint,
        stageVersion,
        artifactHash: "text-a",
        evidence: {
          failedTask: {
            taskId: "task-text",
            retryable: false,
            error: "uploaded file missing",
          },
        },
      }).action
    ).toBe("fail");
  });

  it("routes blocking review evidence to manual review", () => {
    expect(
      buildStageDecision({
        stage: "quality_check",
        sourceFingerprint,
        stageVersion,
        artifactHash: "quality-a",
        evidence: {
          blockingManualReviewCount: 1,
        },
      })
    ).toMatchObject({
      action: "manual_review",
      manualReviewRequired: true,
      reason: "blocking_manual_review",
    });
  });

  it("does not skip when required artifacts are absent", () => {
    expect(
      buildStageDecision({
        stage: "script_generation",
        checkpoint: checkpoint(),
        sourceFingerprint,
        stageVersion,
        artifactHash: "artifact-a",
        evidence: { hasArtifacts: false },
      }).action
    ).toBe("run");
  });
});

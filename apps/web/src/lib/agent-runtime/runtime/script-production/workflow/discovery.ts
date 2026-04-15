import {
  EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
  EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
} from "../../../protocol/events";
import { ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT } from "../../../protocol/artifacts";
import { calculateScriptSummary } from "../summary";
import {
  createDiscoveryRefreshCharacterMemorySnapshot,
} from "../../character-memory/store";
import { runCharacterDiscoveryPass } from "../run-character-discovery-pass";
import { runIncrementalCharacterDiscoveryRefresh } from "../../character-memory/refresh";
import { runStage } from "../../run-stage";
import {
  buildRuntimeMetadata,
  buildWorkflowSummary,
  createObservedAdapter,
  createObservedDefaultAdapter,
} from "../../script-production-runtime-helpers";
import { createToolCallAdapters } from "./tracking";
import type {
  ScriptProductionRuntimeStore,
} from "../../script-production-runtime-store";
import type { LLMAdapter } from "../../../adapters/llm-adapter";
import type {
  WorkflowCoordinatorResult,
  WorkflowInput,
  WorkflowNow,
  WorkflowTrackingAdapters,
  WorkflowBook,
  ScriptProductionExecutionState,
} from "./types";

const applySkillMetadata = (params: {
  state: ScriptProductionExecutionState;
  stageResult: any;
  segmentId?: string;
}) => {
  const { state, stageResult, segmentId } = params;
  state.coordinatorStageResults.push(stageResult);
  const skillMetadata = stageResult.agent.output?.skillMetadata;
  if (
    skillMetadata &&
    typeof skillMetadata === "object" &&
    !Array.isArray(skillMetadata)
  ) {
    state.stageSkillMetadata[stageResult.stageId] =
      skillMetadata as Record<string, unknown>;
    state.stageSkillMetadataIndex.push({
      stageRunId: stageResult.id,
      stageId: stageResult.stageId,
      ...(segmentId ? { segmentId } : {}),
      metadata: skillMetadata as Record<string, unknown>,
    });
  }
};

export const runPrepareAndCharacterDiscovery = async ({
  workflowRunId,
  workflowDefinitionId,
  input,
  adapter,
  runtimeStore,
  characterProfiles,
  characterMap,
  characterMemorySnapshot,
  segments,
  state,
  createId,
  now,
  startedAt,
  runCharacterDiscoveryStage,
  runPersistStage,
  tracking,
}: {
  workflowRunId: string;
  workflowDefinitionId: string;
  input: WorkflowInput;
  adapter?: LLMAdapter;
  runtimeStore: ScriptProductionRuntimeStore;
  characterProfiles: WorkflowBook["characterProfiles"];
  characterMap: Map<string, string>;
  characterMemorySnapshot: any;
  segments: Array<any>;
  state: ScriptProductionExecutionState;
  createId: () => string;
  now: WorkflowNow;
  startedAt: Date;
  runCharacterDiscoveryStage: any;
  runPersistStage: any;
  tracking: WorkflowTrackingAdapters;
}): Promise<{
  observedAdapter: LLMAdapter;
  characterMemorySnapshot: any;
  earlyResult?: WorkflowCoordinatorResult;
}> => {
  const toolCallAdapters = createToolCallAdapters({ runtimeStore, now });
  const prepareStage = await runStage({
    workflowRunId,
    stage: {
      id: "prepare",
      agent: {
        id: "coordinator-agent",
        execute: async () => ({
          status: "completed",
          output: {
            mode: input.mode,
            selectedSegmentCount: segments.length,
          },
        }),
      },
    },
    createId,
    appendTrace: tracking.appendTrackedTrace,
    now,
    createStageRun: tracking.createTrackedStageRun,
    updateStageRun: tracking.updateTrackedStageRun,
    createAgentRun: tracking.createTrackedAgentRun,
    updateAgentRun: tracking.updateTrackedAgentRun,
    ...toolCallAdapters,
  });
  await runtimeStore.updateStageRun({
    id: prepareStage.id,
    workflowRunId,
    stageId: "prepare",
    status: prepareStage.status,
    summary: {
      stageId: "prepare",
      mode: input.mode,
      selectedSegmentCount: segments.length,
    },
    completedAt: now(),
  });
  state.coordinatorStageResults.push(prepareStage);
  await runtimeStore.createRuntimeArtifact({
    id: createId(),
    workflowRunId,
    stageRunId: prepareStage.id,
    artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
    artifactVersion: "v1",
    payload: characterMemorySnapshot,
    createdAt: now(),
  });
  await tracking.appendTrackedTrace({
    id: createId(),
    kind: EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
    createdAt: now().toISOString(),
    workflowRunId,
    stageRunId: prepareStage.id,
    status: "completed",
    payload: {
      memoryVersion: characterMemorySnapshot.version,
      canonicalIdentityCount: characterMemorySnapshot.canonicalIdentities.length,
    },
  });

  const observedAdapter = adapter
    ? createObservedAdapter({
        adapter,
        onExecutionEvent: input.onExecutionEvent,
        trace: { workflowRunId, createId, appendTrace: tracking.appendTrackedTrace, now },
      })
    : createObservedDefaultAdapter({
        onExecutionEvent: input.onExecutionEvent,
        trace: { workflowRunId, createId, appendTrace: tracking.appendTrackedTrace, now },
      });

  const characterDiscoveryResult = await runCharacterDiscoveryPass({
    workflowRunId,
    bookId: input.bookId,
    segments,
    adapter: observedAdapter,
    runtimeStore,
    characterProfiles,
    characterMap,
    createId,
    now,
    createStageRun: tracking.createTrackedStageRun,
    updateStageRun: tracking.updateTrackedStageRun,
    createAgentRun: tracking.createTrackedAgentRun,
    updateAgentRun: tracking.updateTrackedAgentRun,
    appendTrace: tracking.appendTrackedTrace,
    onStageResult: (stageResult: any) =>
      applySkillMetadata({ state, stageResult }),
    runCharacterDiscoveryStage,
    runPersistStage,
    ...toolCallAdapters,
  });
  state.persistedCharacterCount += characterDiscoveryResult.persistedCharacterCount;

  let nextSnapshot = characterMemorySnapshot;

  if (characterDiscoveryResult.failure) {
    state.characterDiscoveryStatus = "failed";
    state.characterDiscoveryFailure = {
      code: characterDiscoveryResult.failure.errorCode,
      message: characterDiscoveryResult.failure.message,
    };
    state.workflowIssues.push({
      code: characterDiscoveryResult.failure.errorCode,
      stage: characterDiscoveryResult.failure.stage,
      message: characterDiscoveryResult.failure.message,
      retryable: characterDiscoveryResult.failure.retryable,
    });

    if (nextSnapshot.canonicalIdentities.length === 0) {
      await tracking.appendTrackedTrace({
        id: createId(),
        kind: EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
        createdAt: now().toISOString(),
        workflowRunId,
        status: "failed",
        payload: {
          errorCode: characterDiscoveryResult.failure.errorCode,
          message: characterDiscoveryResult.failure.message,
          retryable: characterDiscoveryResult.failure.retryable,
        },
      });
      const completedAt = now();
      const workflowSummary = buildWorkflowSummary({
        mode: input.mode,
        selectedSegmentIds: segments.map((segment) => segment.id),
        totalSegments: segments.length,
        processedSegments: 0,
        failedSegmentIds: [],
        persistedSentenceCount: state.persistedSentenceCount,
        persistedCharacterCount: state.persistedCharacterCount,
        formatRepairCount: state.formatRepairCount,
        semanticRetryCount: state.semanticRetryCount,
        manualReviewRequiredCount: state.manualReviewRequiredCount,
        qualityRejectedCount: state.qualityRejectedCount,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        segmentOutcomeIndex: state.segmentOutcomeIndex,
        characterMemoryVersion: nextSnapshot.version,
        degradedMode: false,
        characterDiscoveryStatus: state.characterDiscoveryStatus,
        characterDiscoveryFailure: state.characterDiscoveryFailure,
        workflowIssues: state.workflowIssues,
        stageSkillMetadata: state.stageSkillMetadata,
        stageSkillMetadataIndex: state.stageSkillMetadataIndex,
      });
      const runtimeMetadata = buildRuntimeMetadata({
        workflowRunId,
        workflowId: workflowDefinitionId,
        status: "failed",
        mode: input.mode,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        summary: workflowSummary,
        traceEventCount: state.traceEventCount,
        stageRunCount: state.stageRunCount,
      });

      return {
        observedAdapter,
        characterMemorySnapshot: nextSnapshot,
        earlyResult: {
          status: "failed",
          summary: workflowSummary as unknown as Record<string, unknown>,
          stages: state.coordinatorStageResults,
          result: {
            dialogueLines: [],
            summary: calculateScriptSummary([], {
              totalSegments: segments.length,
              failedSegmentIds: [],
              failedSegmentDetails: [characterDiscoveryResult.failure],
            }),
            segments: [],
            runtimeMetadata,
          },
        },
      };
    }

    state.degradedMode = true;
    nextSnapshot = {
      ...nextSnapshot,
      status: "degraded",
      diagnostics: {
        ...nextSnapshot.diagnostics,
        issues: [
          ...nextSnapshot.diagnostics.issues,
          characterDiscoveryResult.failure.errorCode,
        ],
      },
    };
    await runtimeStore.createRuntimeArtifact({
      id: createId(),
      workflowRunId,
      artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
      artifactVersion: "v1",
      payload: nextSnapshot,
      createdAt: now(),
    });
    await tracking.appendTrackedTrace({
      id: createId(),
      kind: EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
      createdAt: now().toISOString(),
      workflowRunId,
      status: "failed",
      payload: {
        errorCode: characterDiscoveryResult.failure.errorCode,
        message: characterDiscoveryResult.failure.message,
        retryable: characterDiscoveryResult.failure.retryable,
        memoryVersion: nextSnapshot.version,
      },
    });
  } else {
    state.characterDiscoveryStatus = "completed";
    if (characterDiscoveryResult.persistedCharacterCount > 0) {
      nextSnapshot = createDiscoveryRefreshCharacterMemorySnapshot(
        characterProfiles,
        {
          version: nextSnapshot.version + 1,
          now,
        }
      );
      await runtimeStore.createRuntimeArtifact({
        id: createId(),
        workflowRunId,
        artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
        artifactVersion: "v1",
        payload: nextSnapshot,
        createdAt: now(),
      });
    }
  }

  return {
    observedAdapter,
    characterMemorySnapshot: nextSnapshot,
  };
};

export const refreshCharacterMemoryForSegment = async ({
  workflowRunId,
  bookId,
  segment,
  observedAdapter,
  runtimeStore,
  characterProfiles,
  characterMap,
  characterMemorySnapshot,
  state,
  createId,
  now,
  runCharacterDiscoveryStage,
  runPersistStage,
  tracking,
}: {
  workflowRunId: string;
  bookId: string;
  segment: any;
  observedAdapter: LLMAdapter;
  runtimeStore: ScriptProductionRuntimeStore;
  characterProfiles: WorkflowBook["characterProfiles"];
  characterMap: Map<string, string>;
  characterMemorySnapshot: any;
  state: ScriptProductionExecutionState;
  createId: () => string;
  now: WorkflowNow;
  runCharacterDiscoveryStage: any;
  runPersistStage: any;
  tracking: WorkflowTrackingAdapters;
}) => {
  const toolCallAdapters = createToolCallAdapters({ runtimeStore, now });
  const refreshResult = await runIncrementalCharacterDiscoveryRefresh({
    workflowRunId,
    bookId,
    segment,
    adapter: observedAdapter,
    runtimeStore,
    characterProfiles,
    characterMap,
    createId,
    now,
    createStageRun: tracking.createTrackedStageRun,
    updateStageRun: tracking.updateTrackedStageRun,
    createAgentRun: tracking.createTrackedAgentRun,
    updateAgentRun: tracking.updateTrackedAgentRun,
    appendTrace: tracking.appendTrackedTrace,
    onStageResult: (stageResult: any) =>
      applySkillMetadata({ state, stageResult, segmentId: segment.id }),
    runCharacterDiscoveryStage,
    runPersistStage,
    ...toolCallAdapters,
  });

  let nextSnapshot = characterMemorySnapshot;
  state.persistedCharacterCount += refreshResult.persistedCharacterCount;
  if (refreshResult.persistedCharacterCount > 0) {
    nextSnapshot = createDiscoveryRefreshCharacterMemorySnapshot(
      characterProfiles,
      {
        version: nextSnapshot.version + 1,
        now,
      }
    );
    await runtimeStore.createRuntimeArtifact({
      id: createId(),
      workflowRunId,
      artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
      artifactVersion: "v1",
      payload: nextSnapshot,
      createdAt: now(),
    });
  }

  if (refreshResult.failure) {
    state.degradedMode = true;
    state.workflowIssues.push({
      code: refreshResult.failure.errorCode,
      stage: refreshResult.failure.stage,
      message: refreshResult.failure.message,
      retryable: refreshResult.failure.retryable,
    });
    await tracking.appendTrackedTrace({
      id: createId(),
      kind: EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
      createdAt: now().toISOString(),
      workflowRunId,
      status: "failed",
      payload: {
        segmentId: segment.id,
        errorCode: refreshResult.failure.errorCode,
        message: refreshResult.failure.message,
        retryable: refreshResult.failure.retryable,
      },
    });
  }

  return nextSnapshot;
};

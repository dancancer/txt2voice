import { TTSError } from "@/lib/error-handler";
import { createBootstrapCharacterMemorySnapshot } from "./character-memory/store";
import { loadBookForGeneration, resolvePartialSegments } from "./script-production/workflow-source";
import { buildCharacterMap } from "./script-production/storage/character-utils";
import { loadScriptProductionWorkflowDefinition } from "./script-production-workflow-definition";
import { createScriptProductionRuntimeStore } from "./script-production-runtime-store";
import { runWorkflow } from "./run-workflow";
import { runPersistStage } from "./stages/run-persist-stage";
import { runCharacterDiscoveryStage } from "./stages/run-character-discovery-stage";
import { runManualReviewHandoffStage } from "./stages/run-manual-review-handoff-stage";
import { runQualityStage } from "./stages/run-quality-stage";
import { runSegmentRepairStage } from "./stages/run-segment-repair-stage";
import { runSegmentScriptingStage } from "./stages/run-segment-scripting-stage";
import { runSingleSegment } from "./script-production/run-single-segment";
import { createRuntimeId, resolveWorkflowSegments } from "./script-production-runtime-helpers";
import type {
  RunScriptProductionWorkflowInput,
  ScriptProductionBook,
  ScriptProductionWorkflowMode,
} from "./script-production/shared-types";
import {
  createScriptProductionExecutionState,
  type ScriptProductionWorkflowDeps,
  type ScriptProductionWorkflowResult,
} from "./script-production/workflow/types";
import { createWorkflowTrackingAdapters } from "./script-production/workflow/tracking";
import {
  refreshCharacterMemoryForSegment,
  runPrepareAndCharacterDiscovery,
} from "./script-production/workflow/discovery";
import { finalizeScriptProductionWorkflow } from "./script-production/workflow/finalize";

export type { ScriptProductionWorkflowMode } from "./script-production/shared-types";
export type { RunScriptProductionWorkflowInput } from "./script-production/shared-types";
export {
  loadScriptProductionWorkflowDefinition,
  SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES,
} from "./script-production-workflow-definition";

export const runScriptProductionWorkflow = async (
  input: RunScriptProductionWorkflowInput,
  deps: ScriptProductionWorkflowDeps = {}
): Promise<ScriptProductionWorkflowResult> => {
  const loadBook = deps.loadBookForGeneration || loadBookForGeneration;
  const resolvePartial = deps.resolvePartialSegments || resolvePartialSegments;
  const runDiscoveryStage =
    deps.runCharacterDiscoveryStage || runCharacterDiscoveryStage;
  const runManualReviewStage =
    deps.runManualReviewHandoffStage || runManualReviewHandoffStage;
  const runScriptingStage =
    deps.runSegmentScriptingStage || runSegmentScriptingStage;
  const runRepairStage = deps.runSegmentRepairStage || runSegmentRepairStage;
  const runQualityJudgeStage = deps.runQualityStage || runQualityStage;
  const runPersistCommitStage = deps.runPersistStage || runPersistStage;
  const createId = deps.createId || createRuntimeId;
  const now = deps.now ?? (() => new Date());
  const runtimeStore = deps.runtimeStore || createScriptProductionRuntimeStore();
  const workflowDefinition = loadScriptProductionWorkflowDefinition();

  const book = (await loadBook({
    bookId: input.bookId,
    segmentIds: input.mode === "regenerate" ? input.segmentIds : undefined,
  })) as ScriptProductionBook;

  const segments = resolveWorkflowSegments({
    mode: input.mode,
    allSegments: Array.isArray(book.textSegments) ? book.textSegments : [],
    segmentIds: input.segmentIds,
    startFromSegmentId: input.startFromSegmentId,
    startFromOrderIndex: input.startFromOrderIndex,
    limitToSegments: input.limitToSegments,
    resolvePartial,
  });

  if (segments.length === 0) {
    throw new TTSError(
      input.mode === "regenerate" ? "没有找到指定的段落" : "没有可处理的文本段落",
      "TTS_SERVICE_DOWN",
      "mastra-script-production"
    );
  }

  const characterProfiles = Array.isArray(book.characterProfiles)
    ? book.characterProfiles
    : [];
  const characterMap = buildCharacterMap(characterProfiles);
  let characterMemorySnapshot = createBootstrapCharacterMemorySnapshot(characterProfiles, now);
  const state = createScriptProductionExecutionState();
  const startedAt = now();
  const tracking = createWorkflowTrackingAdapters({
    runtimeStore,
    now,
    state,
  });

  const workflowResult = await runWorkflow({
    workflow: workflowDefinition,
    entryPayload: {
      mode: input.mode,
      selectedSegmentIds: segments.map((segment) => segment.id),
    },
    adapters: {
      createId,
      createWorkflowRun: async (record) => {
        await runtimeStore.createWorkflowRun({
          ...record,
          bookId: input.bookId,
          processingTaskId: input.taskId ?? null,
          runtimeConfig: {
            mode: input.mode,
            runtimeBackend: "mastra",
          },
          startedAt,
        });
      },
      updateWorkflowRun: async (record) => {
        await runtimeStore.updateWorkflowRun({
          ...record,
          summary: record.summary,
          completedAt: record.completedAt ?? now(),
        });
      },
      createStageRun: tracking.createTrackedStageRun,
      updateStageRun: tracking.updateTrackedStageRun,
      createAgentRun: tracking.createTrackedAgentRun,
      updateAgentRun: tracking.updateTrackedAgentRun,
      createToolCall: async (record) => {
        await runtimeStore.createToolCall({
          ...record,
          createdAt: record.createdAt ?? now(),
        });
      },
      updateToolCall: async (record) => {
        await runtimeStore.updateToolCall({
          ...record,
          completedAt: record.completedAt ?? now(),
        });
      },
      appendTrace: tracking.appendTrackedTrace,
    },
    coordinator: async ({ workflowRunId }) => {
      const discovery = await runPrepareAndCharacterDiscovery({
        workflowRunId,
        workflowDefinitionId: workflowDefinition.id,
        input,
        adapter: deps.adapter,
        runtimeStore,
        characterProfiles,
        characterMap,
        characterMemorySnapshot,
        segments,
        state,
        createId,
        now,
        startedAt,
        runCharacterDiscoveryStage: runDiscoveryStage,
        runPersistStage: runPersistCommitStage,
        tracking,
      });

      characterMemorySnapshot = discovery.characterMemorySnapshot;
      if (discovery.earlyResult) {
        return discovery.earlyResult;
      }

      for (const [segmentIndex, segment] of segments.entries()) {
        if (segmentIndex > 0) {
          characterMemorySnapshot = await refreshCharacterMemoryForSegment({
            workflowRunId,
            bookId: input.bookId,
            segment,
            observedAdapter: discovery.observedAdapter,
            runtimeStore,
            characterProfiles,
            characterMap,
            characterMemorySnapshot,
            state,
            createId,
            now,
            runCharacterDiscoveryStage: runDiscoveryStage,
            runPersistStage: runPersistCommitStage,
            tracking,
          });
        }

        const result = await runSingleSegment({
          workflowRunId,
          bookId: input.bookId,
          segment,
          adapter: discovery.observedAdapter,
          runtimeStore,
          characterProfiles,
          characterMap,
          createId,
          now,
          semanticRetryDepth: 0,
          inputRefinementDepth: 0,
          createStageRun: tracking.createTrackedStageRun,
          updateStageRun: tracking.updateTrackedStageRun,
          createAgentRun: tracking.createTrackedAgentRun,
          updateAgentRun: tracking.updateTrackedAgentRun,
          createToolCall: async (record) => {
            await runtimeStore.createToolCall({
              ...record,
              createdAt: record.createdAt ?? now(),
            });
          },
          updateToolCall: async (record) => {
            await runtimeStore.updateToolCall({
              ...record,
              completedAt: record.completedAt ?? now(),
            });
          },
          appendTrace: tracking.appendTrackedTrace,
          onStageResult: (stageResult) => {
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
                segmentId: segment.id,
                metadata: skillMetadata as Record<string, unknown>,
              });
            }
          },
          runSegmentScriptingStage: runScriptingStage,
          runSegmentRepairStage: runRepairStage,
          runQualityStage: runQualityJudgeStage,
          runPersistStage: runPersistCommitStage,
        });

        state.persistedSentenceCount += result.counters.persistedSentenceCount;
        state.persistedCharacterCount += result.counters.persistedCharacterCount;
        state.formatRepairCount += result.counters.formatRepairCount;
        state.semanticRetryCount += result.counters.semanticRetryCount;

        if (result.status === "failed") {
          state.failedSegmentIds.push(segment.id);
          state.failedSegmentDetails.push(result.failure);
          state.segmentOutcomeIndex.push({
            segmentId: segment.id,
            finalStatus: "failed",
            terminalStage: result.failure.stage,
            errorCode: result.failure.errorCode,
          });
          if (
            result.failure.stage === "segment_repair" &&
            result.failure.errorCode === "SEGMENT_MANUAL_REVIEW_REQUIRED"
          ) {
            state.manualReviewRequiredCount += 1;
          }
          if (result.failure.stage === "quality_judgement") {
            state.qualityRejectedCount += 1;
            if (result.failure.errorCode === "QUALITY_MANUAL_REVIEW_REQUIRED") {
              state.manualReviewRequiredCount += 1;
            }
          }
          continue;
        }

        const manualReviewFailure = result.manualReviewFailure;
        state.dialogueLines.push(...result.dialogueLines);
        state.segmentSummaries.push(result.summary);
        state.persistedSegments += 1;
        state.segmentOutcomeIndex.push({
          segmentId: segment.id,
          finalStatus: manualReviewFailure ? "manual_review" : "success",
          terminalStage: manualReviewFailure ? manualReviewFailure.stage : "persist",
          errorCode: manualReviewFailure?.errorCode,
        });
        if (manualReviewFailure) {
          state.failedSegmentDetails.push(manualReviewFailure);
          if (manualReviewFailure.stage === "quality_judgement") {
            state.qualityRejectedCount += 1;
            if (manualReviewFailure.errorCode === "QUALITY_MANUAL_REVIEW_REQUIRED") {
              state.manualReviewRequiredCount += 1;
            }
          }
        }

        if (input.onProgress) {
          await input.onProgress(state.persistedSegments, segments.length);
        }
      }

      return finalizeScriptProductionWorkflow({
        workflowRunId,
        workflowDefinitionId: workflowDefinition.id,
        runtimeStore,
        createId,
        now,
        startedAt,
        inputMode: input.mode,
        inputTaskId: input.taskId,
        bookId: input.bookId,
        segments,
        characterMemoryVersion: characterMemorySnapshot.version,
        state,
        runManualReviewStage,
        tracking,
      });
    },
  });

  return workflowResult.result as ScriptProductionWorkflowResult;
};

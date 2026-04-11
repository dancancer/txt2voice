import { TTSError } from "@/lib/error-handler";
import {
  createBootstrapCharacterMemorySnapshot,
  createDiscoveryRefreshCharacterMemorySnapshot,
} from "./character-memory/store";
import {
  loadBookForGeneration,
  resolvePartialSegments,
} from "./script-production/workflow-source";
import { buildCharacterMap } from "./script-production/storage/character-utils";
import type {
  DialogueLine,
  SegmentFailureDetail,
  SegmentSummary,
} from "./script-production/types";
import { calculateScriptSummary } from "./script-production/summary";
import type { LLMAdapter } from "../adapters/llm-adapter";
import type { ExecutionEvent } from "../protocol/events";
import {
  EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
  EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
} from "../protocol/events";
import { ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT } from "../protocol/artifacts";
import {
  buildRuntimeMetadata,
  buildWorkflowSummary,
  createObservedAdapter,
  createObservedDefaultAdapter,
  createRuntimeId,
  resolveWorkflowSegments,
  type ScriptProductionRuntimeMetadata,
} from "./script-production-runtime-helpers";
import {
  loadScriptProductionWorkflowDefinition,
} from "./script-production-workflow-definition";
import {
  createScriptProductionRuntimeStore,
  type ScriptProductionRuntimeStore,
} from "./script-production-runtime-store";
import { runStage, type RunStageResult, type StageRunRecord } from "./run-stage";
import { runWorkflow } from "./run-workflow";
import { runPersistStage } from "./stages/run-persist-stage";
import { runCharacterDiscoveryStage } from "./stages/run-character-discovery-stage";
import { runManualReviewHandoffStage } from "./stages/run-manual-review-handoff-stage";
import { runQualityStage } from "./stages/run-quality-stage";
import { runSegmentRepairStage } from "./stages/run-segment-repair-stage";
import { runSegmentScriptingStage } from "./stages/run-segment-scripting-stage";
import { runCharacterDiscoveryPass } from "./script-production/run-character-discovery-pass";
import { runIncrementalCharacterDiscoveryRefresh } from "./character-memory/refresh";
import { runSingleSegment } from "./script-production/run-single-segment";
import type {
  RunScriptProductionWorkflowInput,
  ScriptProductionBook,
  ScriptProductionWorkflowMode,
} from "./script-production/shared-types";

export type { ScriptProductionWorkflowMode } from "./script-production/shared-types";
export type { RunScriptProductionWorkflowInput } from "./script-production/shared-types";
export {
  loadScriptProductionWorkflowDefinition,
  SCRIPT_PRODUCTION_RUNTIME_SUBSTAGES,
} from "./script-production-workflow-definition";

type ScriptProductionWorkflowResult = { dialogueLines: DialogueLine[]; summary: ReturnType<typeof calculateScriptSummary>; segments: SegmentSummary[]; runtimeMetadata?: ScriptProductionRuntimeMetadata; };

interface ScriptProductionWorkflowDeps {
  adapter?: LLMAdapter;
  loadBookForGeneration?: typeof loadBookForGeneration;
  resolvePartialSegments?: typeof resolvePartialSegments;
  runCharacterDiscoveryStage?: typeof runCharacterDiscoveryStage;
  runManualReviewHandoffStage?: typeof runManualReviewHandoffStage;
  runSegmentScriptingStage?: typeof runSegmentScriptingStage;
  runSegmentRepairStage?: typeof runSegmentRepairStage;
  runQualityStage?: typeof runQualityStage;
  runPersistStage?: typeof runPersistStage;
  runtimeStore?: ScriptProductionRuntimeStore;
  createId?: () => string;
  now?: () => Date;
}

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
  let characterMemorySnapshot = createBootstrapCharacterMemorySnapshot(
    characterProfiles,
    now
  );
  const dialogueLines: DialogueLine[] = [];
  const segmentSummaries: SegmentSummary[] = [];
  const failedSegmentIds: string[] = [];
  const failedSegmentDetails: SegmentFailureDetail[] = [];
  const segmentOutcomeIndex: Array<{
    segmentId: string;
    finalStatus: "success" | "failed";
    terminalStage: string;
    errorCode?: string;
  }> = [];
  const coordinatorStageResults: RunStageResult[] = [];
  let persistedSentenceCount = 0;
  let persistedCharacterCount = 0;
  let formatRepairCount = 0;
  let semanticRetryCount = 0;
  let manualReviewRequiredCount = 0;
  let qualityRejectedCount = 0;
  let traceEventCount = 0;
  let stageRunCount = 0;
  const stageSkillMetadata: Record<string, Record<string, unknown>> = {};
  const stageSkillMetadataIndex: Array<{
    stageRunId: string;
    stageId: string;
    segmentId?: string;
    metadata: Record<string, unknown>;
  }> = [];
  const workflowIssues: Array<{
    code: string;
    stage: string;
    message: string;
    retryable?: boolean;
  }> = [];
  let degradedMode = false;
  let characterDiscoveryStatus: "completed" | "failed" | "skipped" = "skipped";
  let characterDiscoveryFailure:
    | {
        code: string;
        message: string;
      }
    | undefined;

  let persistedSegments = 0;
  const startedAt = now();

  const createTrackedStageRun = async (record: StageRunRecord) => {
    stageRunCount += 1;
    await runtimeStore.createStageRun({
      ...record,
      startedAt: now(),
    });
  };

  const updateTrackedStageRun = async (record: StageRunRecord) => {
    await runtimeStore.updateStageRun({
      ...record,
      completedAt: now(),
    });
  };

  const createTrackedAgentRun = async (
    record: import("./run-agent").AgentRunRecord
  ) => {
    await runtimeStore.createAgentRun({
      ...record,
      startedAt: now(),
    });
  };

  const updateTrackedAgentRun = async (
    record: import("./run-agent").AgentRunRecord & { completedAt?: Date }
  ) => {
    await runtimeStore.updateAgentRun({
      ...record,
      completedAt: record.completedAt ?? now(),
    });
  };

  const appendTrackedTrace = async (event: ExecutionEvent) => {
    traceEventCount += 1;
    await runtimeStore.appendTrace(event);
  };

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
      createStageRun: createTrackedStageRun,
      updateStageRun: updateTrackedStageRun,
      createAgentRun: createTrackedAgentRun,
      updateAgentRun: updateTrackedAgentRun,
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
      appendTrace: appendTrackedTrace,
    },
    coordinator: async ({ workflowRunId }) => {
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
        appendTrace: appendTrackedTrace,
        now: deps.now,
        createStageRun: createTrackedStageRun,
        updateStageRun: updateTrackedStageRun,
        createAgentRun: createTrackedAgentRun,
        updateAgentRun: updateTrackedAgentRun,
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
      coordinatorStageResults.push(prepareStage);
      await runtimeStore.createRuntimeArtifact({
        id: createId(),
        workflowRunId,
        stageRunId: prepareStage.id,
        artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
        artifactVersion: "v1",
        payload: characterMemorySnapshot,
        createdAt: now(),
      });
      await appendTrackedTrace({
        id: createId(),
        kind: EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
        createdAt: now().toISOString(),
        workflowRunId,
        stageRunId: prepareStage.id,
        status: "completed",
        payload: {
          memoryVersion: characterMemorySnapshot.version,
          canonicalIdentityCount:
            characterMemorySnapshot.canonicalIdentities.length,
        },
      });

      const observedAdapter = deps.adapter
        ? createObservedAdapter({
            adapter: deps.adapter,
            onExecutionEvent: input.onExecutionEvent,
            trace: {
              workflowRunId,
              createId,
              appendTrace: appendTrackedTrace,
              now,
            },
          })
        : createObservedDefaultAdapter({
            onExecutionEvent: input.onExecutionEvent,
            trace: {
              workflowRunId,
              createId,
              appendTrace: appendTrackedTrace,
              now,
            },
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
        now: deps.now,
        createStageRun: createTrackedStageRun,
        updateStageRun: updateTrackedStageRun,
        createAgentRun: createTrackedAgentRun,
        updateAgentRun: updateTrackedAgentRun,
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
        appendTrace: appendTrackedTrace,
        onStageResult: (stageResult) => {
          coordinatorStageResults.push(stageResult);
          const skillMetadata = stageResult.agent.output?.skillMetadata;
          if (
            skillMetadata &&
            typeof skillMetadata === "object" &&
            !Array.isArray(skillMetadata)
          ) {
            stageSkillMetadata[stageResult.stageId] =
              skillMetadata as Record<string, unknown>;
            stageSkillMetadataIndex.push({
              stageRunId: stageResult.id,
              stageId: stageResult.stageId,
              metadata: skillMetadata as Record<string, unknown>,
            });
          }
        },
        runCharacterDiscoveryStage: runDiscoveryStage,
        runPersistStage: runPersistCommitStage,
      });
      persistedCharacterCount += characterDiscoveryResult.persistedCharacterCount;
      if (characterDiscoveryResult.failure) {
        characterDiscoveryStatus = "failed";
        characterDiscoveryFailure = {
          code: characterDiscoveryResult.failure.errorCode,
          message: characterDiscoveryResult.failure.message,
        };
        workflowIssues.push({
          code: characterDiscoveryResult.failure.errorCode,
          stage: characterDiscoveryResult.failure.stage,
          message: characterDiscoveryResult.failure.message,
          retryable: characterDiscoveryResult.failure.retryable,
        });
        if (characterMemorySnapshot.canonicalIdentities.length === 0) {
          await appendTrackedTrace({
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
            persistedSentenceCount,
            persistedCharacterCount,
            formatRepairCount,
            semanticRetryCount,
            manualReviewRequiredCount,
            qualityRejectedCount,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            segmentOutcomeIndex,
            characterMemoryVersion: characterMemorySnapshot.version,
            degradedMode: false,
            characterDiscoveryStatus,
            characterDiscoveryFailure,
            workflowIssues,
            stageSkillMetadata,
            stageSkillMetadataIndex,
          });
          const runtimeMetadata = buildRuntimeMetadata({
            workflowRunId,
            workflowId: workflowDefinition.id,
            status: "failed",
            mode: input.mode,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            summary: workflowSummary,
            traceEventCount,
            stageRunCount,
          });

          return {
            status: "failed",
            summary: workflowSummary as unknown as Record<string, unknown>,
            stages: coordinatorStageResults,
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
          };
        }
        degradedMode = true;
        characterMemorySnapshot = {
          ...characterMemorySnapshot,
          status: "degraded",
          diagnostics: {
            ...characterMemorySnapshot.diagnostics,
            issues: [
              ...characterMemorySnapshot.diagnostics.issues,
              characterDiscoveryResult.failure.errorCode,
            ],
          },
        };
        await runtimeStore.createRuntimeArtifact({
          id: createId(),
          workflowRunId,
          artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
          artifactVersion: "v1",
          payload: characterMemorySnapshot,
          createdAt: now(),
        });
        await appendTrackedTrace({
          id: createId(),
          kind: EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
          createdAt: now().toISOString(),
          workflowRunId,
          status: "failed",
          payload: {
            errorCode: characterDiscoveryResult.failure.errorCode,
            message: characterDiscoveryResult.failure.message,
            retryable: characterDiscoveryResult.failure.retryable,
            memoryVersion: characterMemorySnapshot.version,
          },
        });
      } else {
        characterDiscoveryStatus = "completed";
        if (characterDiscoveryResult.persistedCharacterCount > 0) {
          characterMemorySnapshot = createDiscoveryRefreshCharacterMemorySnapshot(
            characterProfiles,
            {
              version: characterMemorySnapshot.version + 1,
              now,
            }
          );
          await runtimeStore.createRuntimeArtifact({
            id: createId(),
            workflowRunId,
            artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
            artifactVersion: "v1",
            payload: characterMemorySnapshot,
            createdAt: now(),
          });
        }
      }

      for (const [segmentIndex, segment] of segments.entries()) {
        if (segmentIndex > 0) {
          const refreshResult = await runIncrementalCharacterDiscoveryRefresh({
            workflowRunId,
            bookId: input.bookId,
            segment,
            adapter: observedAdapter,
            runtimeStore,
            characterProfiles,
            characterMap,
            createId,
            now: deps.now,
            createStageRun: createTrackedStageRun,
            updateStageRun: updateTrackedStageRun,
            createAgentRun: createTrackedAgentRun,
            updateAgentRun: updateTrackedAgentRun,
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
            appendTrace: appendTrackedTrace,
            onStageResult: (stageResult) => {
              coordinatorStageResults.push(stageResult);
              const skillMetadata = stageResult.agent.output?.skillMetadata;
          if (
            skillMetadata &&
            typeof skillMetadata === "object" &&
            !Array.isArray(skillMetadata)
          ) {
            stageSkillMetadata[stageResult.stageId] =
              skillMetadata as Record<string, unknown>;
            stageSkillMetadataIndex.push({
              stageRunId: stageResult.id,
              stageId: stageResult.stageId,
              segmentId: segment.id,
              metadata: skillMetadata as Record<string, unknown>,
            });
          }
        },
            runCharacterDiscoveryStage: runDiscoveryStage,
            runPersistStage: runPersistCommitStage,
          });

          persistedCharacterCount += refreshResult.persistedCharacterCount;
          if (refreshResult.persistedCharacterCount > 0) {
            characterMemorySnapshot = createDiscoveryRefreshCharacterMemorySnapshot(
              characterProfiles,
              {
                version: characterMemorySnapshot.version + 1,
                now,
              }
            );
            await runtimeStore.createRuntimeArtifact({
              id: createId(),
              workflowRunId,
              artifactKind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
              artifactVersion: "v1",
              payload: characterMemorySnapshot,
              createdAt: now(),
            });
          }

          if (refreshResult.failure) {
            degradedMode = true;
            workflowIssues.push({
              code: refreshResult.failure.errorCode,
              stage: refreshResult.failure.stage,
              message: refreshResult.failure.message,
              retryable: refreshResult.failure.retryable,
            });
            await appendTrackedTrace({
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
        }

        const result = await runSingleSegment({
          workflowRunId,
          bookId: input.bookId,
          segment,
          adapter: observedAdapter,
          runtimeStore,
          characterProfiles,
          characterMap,
          createId,
          now: deps.now,
          semanticRetryDepth: 0,
          inputRefinementDepth: 0,
          createStageRun: createTrackedStageRun,
          updateStageRun: updateTrackedStageRun,
          createAgentRun: createTrackedAgentRun,
          updateAgentRun: updateTrackedAgentRun,
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
          appendTrace: appendTrackedTrace,
          onStageResult: (stageResult) => {
            coordinatorStageResults.push(stageResult);
            const skillMetadata = stageResult.agent.output?.skillMetadata;
            if (
              skillMetadata &&
              typeof skillMetadata === "object" &&
              !Array.isArray(skillMetadata)
            ) {
              stageSkillMetadata[stageResult.stageId] =
                skillMetadata as Record<string, unknown>;
              stageSkillMetadataIndex.push({
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

        persistedSentenceCount += result.counters.persistedSentenceCount;
        persistedCharacterCount += result.counters.persistedCharacterCount;
        formatRepairCount += result.counters.formatRepairCount;
        semanticRetryCount += result.counters.semanticRetryCount;

        if (result.status === "failed") {
          failedSegmentIds.push(segment.id);
          failedSegmentDetails.push(result.failure);
          segmentOutcomeIndex.push({
            segmentId: segment.id,
            finalStatus: "failed",
            terminalStage: result.failure.stage,
            errorCode: result.failure.errorCode,
          });
          if (result.failure.stage === "segment_repair") {
            if (result.failure.errorCode === "SEGMENT_MANUAL_REVIEW_REQUIRED") {
              manualReviewRequiredCount += 1;
            }
          }
          if (result.failure.stage === "quality_judgement") {
            qualityRejectedCount += 1;
            if (result.failure.errorCode === "QUALITY_MANUAL_REVIEW_REQUIRED") {
              manualReviewRequiredCount += 1;
            }
          }
          continue;
        }

        dialogueLines.push(...result.dialogueLines);
        segmentSummaries.push(result.summary);
        persistedSegments += 1;
        segmentOutcomeIndex.push({
          segmentId: segment.id,
          finalStatus: "success",
          terminalStage: "persist",
        });

        if (input.onProgress) {
          await input.onProgress(persistedSegments, segments.length);
        }
      }

      const manualReviewStage = await runManualReviewStage({
        workflowRunId,
        taskId: input.taskId,
        bookId: input.bookId,
        failures: failedSegmentDetails,
        processedSegmentIds: segmentSummaries.map((segment) => segment.segmentId),
        failedSegmentIds,
        createId,
        now: deps.now,
        createStageRun: createTrackedStageRun,
        updateStageRun: updateTrackedStageRun,
        createAgentRun: createTrackedAgentRun,
        updateAgentRun: updateTrackedAgentRun,
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
        appendTrace: appendTrackedTrace,
      });
      const manualReviewSync =
        manualReviewStage.status === "completed"
          ? manualReviewStage.summary
          : {
              issueType: "SCRIPT_VALIDATION",
              created: 0,
              updated: 0,
              pending: 0,
              resolved: 0,
            };
      await runtimeStore.updateStageRun({
        id: manualReviewStage.stageRunId,
        workflowRunId,
        stageId: "manual_review_handoff",
        status: manualReviewStage.status,
        summary: {
          stageId: "manual_review_handoff",
          ...manualReviewSync,
        },
        completedAt: now(),
      });
      coordinatorStageResults.push({
        id: manualReviewStage.stageRunId,
        stageId: "manual_review_handoff",
        status: manualReviewStage.status,
        agent: {
          runId: manualReviewStage.agentRunId,
          agentId: "manual-review-handoff-agent",
          status: manualReviewStage.status,
          output:
            manualReviewStage.status === "completed"
              ? { ...manualReviewStage.summary }
              : undefined,
          error:
            manualReviewStage.status === "completed"
              ? undefined
              : manualReviewStage.error,
        },
      });
      if (manualReviewSync.pending > 0) {
        await appendTrackedTrace({
          id: createId(),
          kind: "manual_review_escalated",
          createdAt: now().toISOString(),
          workflowRunId,
          stageRunId: manualReviewStage.stageRunId,
          agentRunId: manualReviewStage.agentRunId,
          status: "completed",
          payload: {
            pending: manualReviewSync.pending,
            created: manualReviewSync.created,
            updated: manualReviewSync.updated,
            issueType: manualReviewSync.issueType,
          },
        });
      }

      const completedAt = now();
      const workflowSummary = buildWorkflowSummary({
        mode: input.mode,
        selectedSegmentIds: segments.map((segment) => segment.id),
        totalSegments: segments.length,
        processedSegments: persistedSegments,
        failedSegmentIds,
        persistedSentenceCount,
        persistedCharacterCount,
        formatRepairCount,
        semanticRetryCount,
        manualReviewRequiredCount,
        qualityRejectedCount,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        segmentOutcomeIndex,
        manualReviewSync,
        characterMemoryVersion: characterMemorySnapshot.version,
        degradedMode,
        characterDiscoveryStatus,
        characterDiscoveryFailure,
        workflowIssues,
        stageSkillMetadata,
        stageSkillMetadataIndex,
      });
      const completeStage = await runStage({
        workflowRunId,
        stage: {
          id: "complete",
          agent: {
            id: "coordinator-agent",
            execute: async () => ({
              status: "completed",
              output: {
                failedSegments: failedSegmentIds.length,
                processedSegments: persistedSegments,
              },
            }),
          },
        },
        createId,
        appendTrace: appendTrackedTrace,
        now: deps.now,
        createStageRun: createTrackedStageRun,
        updateStageRun: updateTrackedStageRun,
        createAgentRun: createTrackedAgentRun,
        updateAgentRun: updateTrackedAgentRun,
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
      });
      await runtimeStore.updateStageRun({
        id: completeStage.id,
        workflowRunId,
        stageId: "complete",
        status: completeStage.status,
        summary: {
          stageId: "complete",
          failedSegments: failedSegmentIds.length,
          processedSegments: persistedSegments,
        },
        completedAt: now(),
      });
      coordinatorStageResults.push(completeStage);
      const runtimeStatus =
        failedSegmentIds.length > 0 ? "failed" : "completed";

      const runtimeMetadata = buildRuntimeMetadata({
        workflowRunId,
        workflowId: workflowDefinition.id,
        status: runtimeStatus,
        mode: input.mode,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        summary: workflowSummary,
        traceEventCount,
        stageRunCount,
      });

      return {
        status: runtimeStatus,
        summary: workflowSummary as unknown as Record<string, unknown>,
        stages: coordinatorStageResults,
        result: {
          dialogueLines,
          summary: calculateScriptSummary(dialogueLines, {
            totalSegments: segments.length,
            failedSegmentIds,
            failedSegmentDetails,
          }),
          segments: segmentSummaries,
          runtimeMetadata,
        },
      };
    },
  });

  return workflowResult.result as ScriptProductionWorkflowResult;
};

import { calculateScriptSummary } from "../summary";
import { buildRuntimeMetadata, buildWorkflowSummary } from "../../script-production-runtime-helpers";
import { runStage } from "../../run-stage";
import { createToolCallAdapters } from "./tracking";
import type { ScriptProductionRuntimeStore } from "../../script-production-runtime-store";
import type {
  ScriptProductionExecutionState,
  WorkflowCoordinatorResult,
  WorkflowNow,
  WorkflowTrackingAdapters,
} from "./types";

export const finalizeScriptProductionWorkflow = async ({
  workflowRunId,
  workflowDefinitionId,
  runtimeStore,
  createId,
  now,
  startedAt,
  inputMode,
  inputTaskId,
  bookId,
  segments,
  characterMemoryVersion,
  state,
  runManualReviewStage,
  tracking,
}: {
  workflowRunId: string;
  workflowDefinitionId: string;
  runtimeStore: ScriptProductionRuntimeStore;
  createId: () => string;
  now: WorkflowNow;
  startedAt: Date;
  inputMode: any;
  inputTaskId?: string;
  bookId: string;
  segments: Array<{ id: string }>;
  characterMemoryVersion: number;
  state: ScriptProductionExecutionState;
  runManualReviewStage: any;
  tracking: WorkflowTrackingAdapters;
}): Promise<WorkflowCoordinatorResult> => {
  const toolCallAdapters = createToolCallAdapters({ runtimeStore, now });
  const manualReviewStage = await runManualReviewStage({
    workflowRunId,
    taskId: inputTaskId,
    bookId,
    failures: state.failedSegmentDetails,
    processedSegmentIds: state.segmentSummaries.map((segment) => segment.segmentId),
    failedSegmentIds: state.failedSegmentIds,
    createId,
    now,
    createStageRun: tracking.createTrackedStageRun,
    updateStageRun: tracking.updateTrackedStageRun,
    createAgentRun: tracking.createTrackedAgentRun,
    updateAgentRun: tracking.updateTrackedAgentRun,
    appendTrace: tracking.appendTrackedTrace,
    ...toolCallAdapters,
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
  state.coordinatorStageResults.push({
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
    await tracking.appendTrackedTrace({
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
    mode: inputMode,
    selectedSegmentIds: segments.map((segment) => segment.id),
    totalSegments: segments.length,
    processedSegments: state.persistedSegments,
    failedSegmentIds: state.failedSegmentIds,
    persistedSentenceCount: state.persistedSentenceCount,
    persistedCharacterCount: state.persistedCharacterCount,
    formatRepairCount: state.formatRepairCount,
    semanticRetryCount: state.semanticRetryCount,
    manualReviewRequiredCount: state.manualReviewRequiredCount,
    qualityRejectedCount: state.qualityRejectedCount,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    segmentOutcomeIndex: state.segmentOutcomeIndex,
    manualReviewSync,
    characterMemoryVersion,
    degradedMode: state.degradedMode,
    characterDiscoveryStatus: state.characterDiscoveryStatus,
    characterDiscoveryFailure: state.characterDiscoveryFailure,
    workflowIssues: state.workflowIssues,
    stageSkillMetadata: state.stageSkillMetadata,
    stageSkillMetadataIndex: state.stageSkillMetadataIndex,
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
            failedSegments: state.failedSegmentIds.length,
            processedSegments: state.persistedSegments,
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
    id: completeStage.id,
    workflowRunId,
    stageId: "complete",
    status: completeStage.status,
    summary: {
      stageId: "complete",
      failedSegments: state.failedSegmentIds.length,
      processedSegments: state.persistedSegments,
    },
    completedAt: now(),
  });
  state.coordinatorStageResults.push(completeStage);
  const runtimeStatus =
    state.failedSegmentIds.length > 0 ? "failed" : "completed";

  const runtimeMetadata = buildRuntimeMetadata({
    workflowRunId,
    workflowId: workflowDefinitionId,
    status: runtimeStatus,
    mode: inputMode,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    summary: workflowSummary,
    traceEventCount: state.traceEventCount,
    stageRunCount: state.stageRunCount,
  });

  return {
    status: runtimeStatus,
    summary: workflowSummary as unknown as Record<string, unknown>,
    stages: state.coordinatorStageResults,
    result: {
      dialogueLines: state.dialogueLines,
      summary: calculateScriptSummary(state.dialogueLines, {
        totalSegments: segments.length,
        failedSegmentIds: state.failedSegmentIds,
        failedSegmentDetails: state.failedSegmentDetails,
      }),
      segments: state.segmentSummaries,
      runtimeMetadata,
    },
  };
};

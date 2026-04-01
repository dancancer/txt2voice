import type { SegmentScriptDraft } from "../../context";
import {
  createFailureDetail,
  createStageSummary,
  extractFailureArtifactContext,
  remapFailureToParentSegment,
} from "../script-production-runtime-helpers";
import {
  buildInputRefinementSegments,
  mergeRefinedSegmentDrafts,
  resolveFailureArtifact,
} from "../script-production-runtime-helpers";
import { runSegmentRepairStage } from "../stages/run-segment-repair-stage";
import { runSegmentScriptingStage } from "../stages/run-segment-scripting-stage";
import {
  createEmptySegmentCounters,
  mergeSegmentCounters,
  type SegmentRunResult,
  type SegmentRuntimeCounters,
} from "./shared-types";
import type {
  RecursiveRunSingleSegment,
  RunSingleSegmentParams,
} from "./run-single-segment-types";

const MAX_INPUT_REFINEMENT_DEPTH = 2;

type DraftResolutionResult =
  | {
      status: "success";
      draft: SegmentScriptDraft;
      counters: SegmentRuntimeCounters;
    }
  | {
      status: "failed";
      failure: Extract<SegmentRunResult, { status: "failed" }>["failure"];
      counters: SegmentRuntimeCounters;
    };

export const resolveSegmentDraft = async (
  params: RunSingleSegmentParams,
  recurse: RecursiveRunSingleSegment
): Promise<DraftResolutionResult> => {
  const runScriptingStage =
    params.runSegmentScriptingStage || runSegmentScriptingStage;
  const runRepairStage = params.runSegmentRepairStage || runSegmentRepairStage;

  let counters = createEmptySegmentCounters();
  const scriptStage = await runScriptingStage({
    workflowRunId: params.workflowRunId,
    segmentId: params.segment.id,
    segmentText: params.segment.content,
    adapter: params.adapter,
    createId: params.createId,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    createAgentRun: params.createAgentRun,
    updateAgentRun: params.updateAgentRun,
    appendTrace: params.appendTrace,
  });

  await params.runtimeStore.updateStageRun({
    id: scriptStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "segment_scripting",
    status: scriptStage.status,
    summary: createStageSummary({
      segment: params.segment,
      stageId: "segment_scripting",
      summary:
        scriptStage.status === "completed"
          ? {
              skillId: scriptStage.artifact.skillId,
              lineCount: scriptStage.artifact.segmentScriptDraft.lines.length,
              sourceLength: params.segment.content.length,
            }
          : {
              errorCode: "SEGMENT_SCRIPTING_FAILED",
              message: scriptStage.error || "segment_scripting_failed",
            },
    }),
    completedAt: (params.now ?? (() => new Date()))(),
  });
  params.onStageResult?.({
    id: scriptStage.stageRunId,
    stageId: "segment_scripting",
    status: scriptStage.status,
    agent: {
      runId: scriptStage.agentRunId,
      agentId: "script-generation-agent",
      status: scriptStage.status,
      output:
        scriptStage.status === "completed"
          ? {
              skillId: scriptStage.artifact.skillId,
            }
          : undefined,
      error: scriptStage.status === "completed" ? undefined : scriptStage.error,
    },
  });

  if (scriptStage.status === "completed") {
    return {
      status: "success",
      draft: scriptStage.artifact.segmentScriptDraft,
      counters,
    };
  }

  if (scriptStage.status !== "repairing") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "segment_scripting",
        errorCode: "SEGMENT_SCRIPTING_FAILED",
        message: scriptStage.error || "segment_scripting_failed",
        retryable: scriptStage.status === "retrying",
      }),
      counters,
    };
  }

  counters = {
    ...counters,
    formatRepairCount: counters.formatRepairCount + 1,
  };
  await params.appendTrace({
    id: params.createId(),
    kind: "repair_started",
    createdAt: (params.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.workflowRunId,
    status: "started",
    payload: {
      segmentId: params.segment.id,
      failureKind: "format_repair",
    },
  });
  const repairStage = await runRepairStage({
    workflowRunId: params.workflowRunId,
    segmentId: params.segment.id,
    segmentText: params.segment.content,
    failureKind: "format_repair",
    failedArtifact: resolveFailureArtifact(scriptStage),
    repairDepth: 0,
    adapter: params.adapter,
    createId: params.createId,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    createAgentRun: params.createAgentRun,
    updateAgentRun: params.updateAgentRun,
    createToolCall: params.createToolCall,
    updateToolCall: params.updateToolCall,
    appendTrace: params.appendTrace,
  });

  await params.runtimeStore.updateStageRun({
    id: repairStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "segment_repair",
    status: repairStage.status,
    summary: createStageSummary({
      segment: params.segment,
      stageId: "segment_repair",
      summary: {
        failureKind: "format_repair",
        decisionAction:
          repairStage.status === "completed"
            ? repairStage.decision.action
            : "failed",
        decisionReason:
          repairStage.status === "completed"
            ? repairStage.decision.reason
            : repairStage.error || "segment_repair_failed",
        retryable:
          repairStage.status === "completed"
            ? repairStage.decision.retryable
            : repairStage.status === "retrying",
      },
    }),
    completedAt: (params.now ?? (() => new Date()))(),
  });
  params.onStageResult?.({
    id: repairStage.stageRunId,
    stageId: "segment_repair",
    status: repairStage.status,
    agent: {
      runId: repairStage.agentRunId,
      agentId: "repair-agent",
      status: repairStage.status,
      output:
        repairStage.status === "completed"
          ? {
              decision: repairStage.decision,
            }
          : undefined,
      error: repairStage.status === "completed" ? undefined : repairStage.error,
    },
  });

  if (repairStage.status !== "completed") {
    const repairFailureContext = extractFailureArtifactContext(
      repairStage.failedArtifact
    );

    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "segment_repair",
        errorCode: "SEGMENT_REPAIR_FAILED",
        message: repairStage.error || "segment_repair_failed",
        provider: repairFailureContext.provider ?? undefined,
        rawResponse: repairFailureContext.rawResponse,
        structuredResult: repairFailureContext.structuredResult,
        retryable: repairStage.status === "retrying",
      }),
      counters,
    };
  }

  let draft: SegmentScriptDraft | null = null;

  if (
    repairStage.decision.action === "refine" &&
    params.inputRefinementDepth < MAX_INPUT_REFINEMENT_DEPTH
  ) {
    const refinedSegments = buildInputRefinementSegments({
      segment: params.segment,
    });

    if (refinedSegments.length > 1) {
      let mergedCounters = counters;
      const refinedDrafts: SegmentScriptDraft[] = [];

      for (const refinedSegment of refinedSegments) {
        const refinedResult = await recurse({
          segment: refinedSegment,
          semanticRetryDepth: 0,
          inputRefinementDepth: params.inputRefinementDepth + 1,
          deferPersist: true,
        });

        mergedCounters = mergeSegmentCounters(
          mergedCounters,
          refinedResult.counters
        );

        if (refinedResult.status !== "success") {
          return {
            status: "failed",
            failure: remapFailureToParentSegment({
              parentSegment: params.segment,
              failure: refinedResult.failure,
            }),
            counters: mergedCounters,
          };
        }

        refinedDrafts.push(refinedResult.draft);
      }

      draft = mergeRefinedSegmentDrafts({
        parentSegmentId: params.segment.id,
        drafts: refinedDrafts,
        now: params.now,
      });
      counters = mergedCounters;
    }
  }

  if (repairStage.decision.action !== "retry" || !repairStage.artifact) {
    if (!draft) {
      return {
        status: "failed",
        failure: createFailureDetail({
          segment: params.segment,
          stage: "segment_repair",
          errorCode: "SEGMENT_REPAIR_NOT_RECOVERED",
          message:
            repairStage.decision.reason || "segment_repair_not_recovered",
          retryable: repairStage.decision.retryable,
        }),
        counters,
      };
    }

    return {
      status: "success",
      draft,
      counters,
    };
  }

  return {
    status: "success",
    draft: repairStage.artifact.segmentScriptDraft,
    counters,
  };
};

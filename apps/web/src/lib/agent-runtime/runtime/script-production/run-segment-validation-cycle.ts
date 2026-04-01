import type { SegmentScriptDraft, ValidationReport } from "../../context";
import type { SegmentFailureDetail } from "@/lib/script-generator/types";
import { createShadowDiffPayload } from "../../mastra/runtime/shadow-diff";
import {
  buildInputRefinementSegments,
  buildValidationReport,
  createFailureDetail,
  createStageSummary,
  extractFailureArtifactContext,
  mergeRefinedSegmentDrafts,
  remapFailureToParentSegment,
} from "../script-production-runtime-helpers";
import { normalizeSegmentScriptDraft } from "./helpers/script-draft-normalizer";
import {
  runSegmentRepairStage,
  type RunSegmentRepairStageResult,
} from "../stages/run-segment-repair-stage";
import {
  mergeSegmentCounters,
  type SegmentRunResult,
  type SegmentRuntimeCounters,
} from "./shared-types";
import { runValidationStage } from "./run-validation-stage";
import type { RecursiveRunSingleSegment, RunSingleSegmentParams } from "./run-single-segment-types";

const MAX_SEMANTIC_RETRY_DEPTH = 1;
const MAX_INPUT_REFINEMENT_DEPTH = 2;

type ValidationCycleResult =
  | { status: "success"; draft: SegmentScriptDraft; validationReport: ValidationReport; counters: SegmentRuntimeCounters }
  | { status: "terminal"; result: SegmentRunResult }
  | { status: "failed"; failure: SegmentFailureDetail; counters: SegmentRuntimeCounters };

const toDraftStructuredResult = (draft: SegmentScriptDraft) => ({
  segmentId: draft.segmentId,
  createdAt: draft.createdAt,
  lines: draft.lines.map((line) => ({ ...line })),
});

const toDraftFailureContext = (draft: SegmentScriptDraft) => ({
  rawResponse:
    typeof draft.rawResponse === "string" && draft.rawResponse.trim().length > 0
      ? draft.rawResponse
      : undefined,
  structuredResult: toDraftStructuredResult(draft),
});

export const runSegmentValidationCycle = async (
  params: RunSingleSegmentParams,
  draft: SegmentScriptDraft,
  initialCounters: SegmentRuntimeCounters,
  recurse: RecursiveRunSingleSegment
): Promise<ValidationCycleResult> => {
  const runRepairStage = params.runSegmentRepairStage || runSegmentRepairStage;

  let counters = initialCounters;
  let currentDraft = normalizeSegmentScriptDraft({
    segmentText: params.segment.content,
    draft,
  });
  let validationReport = buildValidationReport({
    segment: params.segment,
    draft: currentDraft,
  });
  await runValidationStage({
    context: params,
    draft: currentDraft,
    validationReport,
  });

  if (validationReport.valid) {
    return {
      status: "success",
      draft: currentDraft,
      validationReport,
      counters,
    };
  }

  counters = {
    ...counters,
    semanticRetryCount: counters.semanticRetryCount + 1,
  };
  await params.appendTrace({
    id: params.createId(),
    kind: "repair_started",
    createdAt: (params.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.workflowRunId,
    status: "started",
    payload: {
      segmentId: params.segment.id,
      failureKind: "semantic_retry",
    },
  });
  let semanticRepairShadowResult: RunSegmentRepairStageResult | null = null;
  const repairStage = await runRepairStage({
    workflowRunId: params.workflowRunId,
    segmentId: params.segment.id,
    segmentText: params.segment.content,
    failureKind: "semantic_retry",
    failedArtifact: {
      kind: "validation-failure",
      segmentId: params.segment.id,
      validationReport,
      ...toDraftFailureContext(currentDraft),
    },
    validationReport,
    repairDepth: 0,
    adapter: params.adapter,
    executor: params.executorPolicy?.segmentRepair,
    shadowMode: params.executorPolicy?.shadowModeEnabled,
    onShadowResult: async (result) => {
      semanticRepairShadowResult = result;
    },
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
        failureKind: "semantic_retry",
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
  if (repairStage.status === "completed") {
    await params.runtimeStore.createRuntimeArtifact({
      id: params.createId(),
      workflowRunId: params.workflowRunId,
      stageRunId: repairStage.stageRunId,
      agentRunId: repairStage.agentRunId ?? null,
      segmentId: params.segment.id,
      artifactKind: "repair-decision",
      artifactVersion: "v1",
      payload: {
        failureKind: "semantic_retry",
        decision: repairStage.decision,
      },
      createdAt: (params.now ?? (() => new Date()))(),
    });
  }

  if (semanticRepairShadowResult) {
    await params.runtimeStore.createShadowDiffArtifact({
      id: params.createId(),
      workflowRunId: params.workflowRunId,
      stageRunId: repairStage.stageRunId,
      segmentId: params.segment.id,
      payload: createShadowDiffPayload({
        stageId: "segment_repair",
        segmentId: params.segment.id,
        nativeResult: repairStage,
        shadowResult: semanticRepairShadowResult,
      }),
      createdAt: (params.now ?? (() => new Date()))(),
    });
  }

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

  if (
    repairStage.decision.action === "retry" &&
    params.semanticRetryDepth < MAX_SEMANTIC_RETRY_DEPTH
  ) {
    const retriedResult = await recurse({
      segment: params.segment,
      semanticRetryDepth: params.semanticRetryDepth + 1,
      inputRefinementDepth: params.inputRefinementDepth,
      deferPersist: params.deferPersist,
    });

    if (retriedResult.status === "success") {
      return {
        status: "terminal",
        result: {
          ...retriedResult,
          counters: mergeSegmentCounters(counters, retriedResult.counters),
        },
      };
    }

    return {
      status: "terminal",
      result: {
        ...retriedResult,
        counters: mergeSegmentCounters(counters, retriedResult.counters),
      },
    };
  }

  const canAttemptInputRefinement =
    params.inputRefinementDepth < MAX_INPUT_REFINEMENT_DEPTH &&
    (repairStage.decision.action === "retry" ||
      repairStage.decision.action === "refine");

  if (canAttemptInputRefinement) {
    let refinementShadowResult: RunSegmentRepairStageResult | null = null;
    const refinementStage = await runRepairStage({
      workflowRunId: params.workflowRunId,
      segmentId: params.segment.id,
      segmentText: params.segment.content,
      failureKind: "input_refinement",
      failedArtifact: {
        kind: "validation-failure",
        segmentId: params.segment.id,
        validationReport,
        ...toDraftFailureContext(currentDraft),
      },
      validationReport,
      repairDepth: params.inputRefinementDepth,
      adapter: params.adapter,
      executor: params.executorPolicy?.segmentRepair,
      shadowMode: params.executorPolicy?.shadowModeEnabled,
      onShadowResult: async (result) => {
        refinementShadowResult = result;
      },
      createId: params.createId,
      now: params.now,
      createStageRun: params.createStageRun,
      updateStageRun: params.updateStageRun,
      createAgentRun: params.createAgentRun,
      updateAgentRun: params.updateAgentRun,
      appendTrace: params.appendTrace,
    });

    await params.runtimeStore.updateStageRun({
      id: refinementStage.stageRunId,
      workflowRunId: params.workflowRunId,
      stageId: "segment_repair",
      status: refinementStage.status,
      summary: createStageSummary({
        segment: params.segment,
        stageId: "segment_repair",
        summary: {
          failureKind: "input_refinement",
          decisionAction:
            refinementStage.status === "completed"
              ? refinementStage.decision.action
              : "failed",
          decisionReason:
            refinementStage.status === "completed"
              ? refinementStage.decision.reason
              : refinementStage.error || "segment_repair_failed",
          retryable:
            refinementStage.status === "completed"
              ? refinementStage.decision.retryable
              : refinementStage.status === "retrying",
        },
      }),
      completedAt: (params.now ?? (() => new Date()))(),
    });
    params.onStageResult?.({
      id: refinementStage.stageRunId,
      stageId: "segment_repair",
      status: refinementStage.status,
      agent: {
        runId: refinementStage.agentRunId,
        agentId: "repair-agent",
        status: refinementStage.status,
        output:
          refinementStage.status === "completed"
            ? {
                decision: refinementStage.decision,
              }
            : undefined,
        error:
          refinementStage.status === "completed"
            ? undefined
            : refinementStage.error,
      },
    });
    if (refinementStage.status === "completed") {
      await params.runtimeStore.createRuntimeArtifact({
        id: params.createId(),
        workflowRunId: params.workflowRunId,
        stageRunId: refinementStage.stageRunId,
        agentRunId: refinementStage.agentRunId ?? null,
        segmentId: params.segment.id,
        artifactKind: "repair-decision",
        artifactVersion: "v1",
        payload: {
          failureKind: "input_refinement",
          decision: refinementStage.decision,
        },
        createdAt: (params.now ?? (() => new Date()))(),
      });
    }

    if (refinementShadowResult) {
      await params.runtimeStore.createShadowDiffArtifact({
        id: params.createId(),
        workflowRunId: params.workflowRunId,
        stageRunId: refinementStage.stageRunId,
        segmentId: params.segment.id,
        payload: createShadowDiffPayload({
          stageId: "segment_repair",
          segmentId: params.segment.id,
          nativeResult: refinementStage,
          shadowResult: refinementShadowResult,
        }),
        createdAt: (params.now ?? (() => new Date()))(),
      });
    }

    if (
      refinementStage.status === "completed" &&
      refinementStage.decision.action === "refine"
    ) {
      const refinedSegments = buildInputRefinementSegments({
        segment: params.segment,
        validationReport,
      });

      if (refinementStage.agentRunId) {
        const splitToolCallId = params.createId();
        const splitStartedAt = (params.now ?? (() => new Date()))();
        await params.runtimeStore.createToolCall({
          id: splitToolCallId,
          agentRunId: refinementStage.agentRunId,
          toolName: "split-segment",
          status: "processing",
          argumentsSummary: {
            segmentId: params.segment.id,
            sourceLength: params.segment.content.length,
          },
          createdAt: splitStartedAt,
        });
        await params.runtimeStore.updateToolCall({
          id: splitToolCallId,
          agentRunId: refinementStage.agentRunId,
          toolName: "split-segment",
          status: refinedSegments.length > 1 ? "completed" : "failed",
          resultSummary: {
            refinedSegmentCount: refinedSegments.length,
          },
          completedAt: (params.now ?? (() => new Date()))(),
        });
      }

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

        const mergedDraft = normalizeSegmentScriptDraft({
          segmentText: params.segment.content,
          draft: mergeRefinedSegmentDrafts({
            parentSegmentId: params.segment.id,
            drafts: refinedDrafts,
            now: params.now,
          }),
        });

        const mergedValidationReport = buildValidationReport({
          segment: params.segment,
          draft: mergedDraft,
        });

        if (mergedValidationReport.valid) {
          return {
            status: "success",
            draft: mergedDraft,
            validationReport: mergedValidationReport,
            counters: mergedCounters,
          };
        }

        return {
          status: "failed",
          failure: createFailureDetail({
            segment: params.segment,
            stage: "script_validation",
            errorCode: "SCRIPT_VALIDATION_FAILED",
            message: "input_refinement 后仍未通过校验",
            provider: "script-validator",
            coverageRatio: mergedValidationReport.coverageRatio,
            issueCodes: mergedValidationReport.issues.map((issue) => issue.code),
            issueMessages: mergedValidationReport.issues.map(
              (issue) => issue.message
            ),
            ...toDraftFailureContext(mergedDraft),
          }),
          counters: mergedCounters,
        };
      }
    }
  }

  if (repairStage.decision.action !== "retry") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "segment_repair",
        errorCode:
          repairStage.decision.action === "refine"
            ? "SEGMENT_INPUT_REFINEMENT_REQUIRED"
            : "SEGMENT_MANUAL_REVIEW_REQUIRED",
        message: repairStage.decision.reason || "segment_repair_not_recovered",
        retryable: repairStage.decision.retryable,
        coverageRatio: validationReport.coverageRatio,
        issueCodes: validationReport.issues.map((issue) => issue.code),
        issueMessages: validationReport.issues.map((issue) => issue.message),
        ...toDraftFailureContext(currentDraft),
      }),
      counters,
    };
  }

  return {
    status: "failed",
    failure: createFailureDetail({
      segment: params.segment,
      stage: "script_validation",
      errorCode: "SCRIPT_VALIDATION_FAILED",
      message: "段落台本校验失败",
      provider: "script-validator",
      coverageRatio: validationReport.coverageRatio,
      issueCodes: validationReport.issues.map((issue) => issue.code),
      issueMessages: validationReport.issues.map((issue) => issue.message),
      retryable: repairStage.decision.retryable,
      ...toDraftFailureContext(currentDraft),
    }),
    counters,
  };
};

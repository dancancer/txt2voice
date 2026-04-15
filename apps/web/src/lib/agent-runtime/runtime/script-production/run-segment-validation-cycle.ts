import type { SegmentScriptDraft, ValidationReport } from "../../context";
import { buildCharacterMemoryFromProfiles } from "../../context";
import type { QualitySignals } from "../agents/quality-judge-agent";
import type { SegmentFailureDetail } from "./types";
import {
  buildInputRefinementSegments,
  buildValidationReport,
  createFailureDetail,
  extractFailureArtifactContext,
  mergeRefinedSegmentDrafts,
  remapFailureToParentSegment,
} from "../script-production-runtime-helpers";
import { normalizeSegmentScriptDraft } from "./helpers/script-draft-normalizer";
import { runSegmentRepairStage } from "../stages/run-segment-repair-stage";
import {
  createRecoverySignals,
  recordRepairStageOutcome,
  toDraftFailureContext,
  toTerminalResult,
} from "./run-segment-validation-cycle-helpers";
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
  | {
      status: "success";
      draft: SegmentScriptDraft;
      validationReport: ValidationReport;
      counters: SegmentRuntimeCounters;
      failedArtifact?: unknown;
      qualitySignals?: QualitySignals;
    }
  | { status: "terminal"; result: SegmentRunResult }
  | { status: "failed"; failure: SegmentFailureDetail; counters: SegmentRuntimeCounters };


export const runSegmentValidationCycle = async (
  params: RunSingleSegmentParams,
  draft: SegmentScriptDraft,
  initialCounters: SegmentRuntimeCounters,
  recurse: RecursiveRunSingleSegment
): Promise<ValidationCycleResult> => {
  const runRepairStage = params.runSegmentRepairStage || runSegmentRepairStage;
  const characterMemory = buildCharacterMemoryFromProfiles(
    params.characterProfiles
  );

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

  const validationFailureArtifact = {
    kind: "validation-failure",
    segmentId: params.segment.id,
    validationReport,
    ...toDraftFailureContext(currentDraft),
  };

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
  const repairStage = await runRepairStage({
    workflowRunId: params.workflowRunId,
    segmentId: params.segment.id,
    segmentText: params.segment.content,
    characterMemory,
    failureKind: "semantic_retry",
    failedArtifact: validationFailureArtifact,
    validationReport,
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

  await recordRepairStageOutcome({
    context: params,
    repairStage,
    failureKind: "semantic_retry",
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

  if (
    repairStage.decision.action === "retry" &&
    params.semanticRetryDepth < MAX_SEMANTIC_RETRY_DEPTH
  ) {
    if (repairStage.artifact?.segmentScriptDraft) {
      currentDraft = normalizeSegmentScriptDraft({
        segmentText: params.segment.content,
        draft: repairStage.artifact.segmentScriptDraft,
      });
      validationReport = buildValidationReport({
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
          failedArtifact: validationFailureArtifact,
          qualitySignals: createRecoverySignals(["semantic_retry_recovered"]),
        };
      }
    }

    const retriedResult = await recurse({
      segment: params.segment,
      semanticRetryDepth: params.semanticRetryDepth + 1,
      inputRefinementDepth: params.inputRefinementDepth,
      deferPersist: params.deferPersist,
    });

    if (retriedResult.status === "success") {
      return toTerminalResult(
        retriedResult,
        mergeSegmentCounters(counters, retriedResult.counters)
      );
    }

    return toTerminalResult(
      retriedResult,
      mergeSegmentCounters(counters, retriedResult.counters)
    );
  }

  const canAttemptInputRefinement =
    params.inputRefinementDepth < MAX_INPUT_REFINEMENT_DEPTH &&
    (repairStage.decision.action === "retry" ||
      repairStage.decision.action === "refine");

  if (canAttemptInputRefinement) {
    const refinementStage = await runRepairStage({
      workflowRunId: params.workflowRunId,
      segmentId: params.segment.id,
      segmentText: params.segment.content,
      characterMemory,
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
      createId: params.createId,
      now: params.now,
      createStageRun: params.createStageRun,
      updateStageRun: params.updateStageRun,
      createAgentRun: params.createAgentRun,
      updateAgentRun: params.updateAgentRun,
      appendTrace: params.appendTrace,
    });

    await recordRepairStageOutcome({
      context: params,
      repairStage: refinementStage,
      failureKind: "input_refinement",
    });

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
            failedArtifact: validationFailureArtifact,
            qualitySignals: createRecoverySignals([
              "semantic_retry_attempted",
              "input_refinement_recovered",
            ]),
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

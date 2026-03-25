import { mapSegmentScriptDraftToDialogueLines } from "@/lib/script-generator/storage/persistence";
import type {
  DialogueLine,
  SegmentFailureDetail,
} from "@/lib/script-generator/types";
import type { LLMAdapter } from "../../adapters/llm-adapter";
import type { SegmentScriptDraft } from "../../context";
import type { ExecutionEvent } from "../../protocol/events";
import {
  checkScriptCoverage,
  validateStructuredOutput,
} from "../../tools/validation-tools";
import {
  buildInputRefinementSegments,
  buildValidationReport,
  createFailureDetail,
  createStageSummary,
  createValidationTraceEvent,
  mergeRefinedSegmentDrafts,
  resolveFailureArtifact,
  toSegmentSummary,
} from "../script-production-runtime-helpers";
import type { ScriptProductionRuntimeStore } from "../script-production-runtime-store";
import { runStage, type RunStageResult, type StageRunRecord } from "../run-stage";
import type { AgentRunRecord, ToolCallRecord } from "../run-agent";
import {
  runPersistStage,
  type RunPersistStageResult,
} from "../stages/run-persist-stage";
import {
  runQualityStage,
  type RunQualityStageResult,
} from "../stages/run-quality-stage";
import {
  runSegmentRepairStage,
  type RunSegmentRepairStageResult,
} from "../stages/run-segment-repair-stage";
import {
  runSegmentScriptingStage,
  type RunSegmentScriptingStageResult,
} from "../stages/run-segment-scripting-stage";
import {
  ScriptProductionBookSegment,
  createEmptySegmentCounters,
  mergeSegmentCounters,
  type CharacterProfileSnapshot,
  type SegmentRunResult,
} from "./shared-types";

const MAX_SEMANTIC_RETRY_DEPTH = 1;
const MAX_INPUT_REFINEMENT_DEPTH = 2;

const remapFailureToParentSegment = (params: {
  parentSegment: ScriptProductionBookSegment;
  failure: SegmentFailureDetail;
}): SegmentFailureDetail =>
  createFailureDetail({
    segment: params.parentSegment,
    stage: params.failure.stage,
    errorCode: params.failure.errorCode,
    message: params.failure.message,
    provider: params.failure.provider,
    retryable: params.failure.retryable,
    coverageRatio: params.failure.coverageRatio,
    issueCodes: params.failure.issueCodes,
    issueMessages: params.failure.issueMessages,
    issuePreviews: params.failure.issuePreviews,
    rawResponse: params.failure.rawResponse,
    structuredResult: params.failure.structuredResult,
  });

export interface RunSingleSegmentParams {
  workflowRunId: string;
  bookId: string;
  segment: ScriptProductionBookSegment;
  adapter: LLMAdapter;
  runtimeStore: ScriptProductionRuntimeStore;
  characterProfiles: CharacterProfileSnapshot[];
  characterMap: Map<string, string>;
  createId: () => string;
  now?: () => Date;
  semanticRetryDepth: number;
  inputRefinementDepth: number;
  deferPersist?: boolean;
  createStageRun: (record: StageRunRecord) => Promise<void>;
  updateStageRun: (record: StageRunRecord) => Promise<void>;
  createAgentRun: (record: AgentRunRecord) => Promise<void>;
  updateAgentRun: (
    record: AgentRunRecord & { completedAt?: Date }
  ) => Promise<void>;
  createToolCall: (
    record: ToolCallRecord & { createdAt?: Date }
  ) => Promise<void>;
  updateToolCall: (
    record: ToolCallRecord & { completedAt?: Date }
  ) => Promise<void>;
  appendTrace: (event: ExecutionEvent) => Promise<void>;
  runSegmentScriptingStage?: typeof runSegmentScriptingStage;
  runSegmentRepairStage?: typeof runSegmentRepairStage;
  runQualityStage?: typeof runQualityStage;
  runPersistStage?: typeof runPersistStage;
  onStageResult?: (result: RunStageResult) => void;
}

export const runSingleSegment = async (
  params: RunSingleSegmentParams
): Promise<SegmentRunResult> => {
  const runScriptingStage =
    params.runSegmentScriptingStage || runSegmentScriptingStage;
  const runRepairStage = params.runSegmentRepairStage || runSegmentRepairStage;
  const runQualityJudgeStage = params.runQualityStage || runQualityStage;
  const runPersistCommitStage = params.runPersistStage || runPersistStage;

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

  let draft: SegmentScriptDraft | null = null;

  if (scriptStage.status === "completed") {
    draft = scriptStage.artifact.segmentScriptDraft;
  } else if (scriptStage.status === "repairing") {
    counters = {
      ...counters,
      formatRepairCount: counters.formatRepairCount + 1,
    };
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
      return {
        status: "failed",
        failure: createFailureDetail({
          segment: params.segment,
          stage: "segment_repair",
          errorCode: "SEGMENT_REPAIR_FAILED",
          message: repairStage.error || "segment_repair_failed",
          retryable: repairStage.status === "retrying",
        }),
        counters,
      };
    }

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
          const refinedResult = await runSingleSegment({
            ...params,
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
    } else {
      draft = repairStage.artifact.segmentScriptDraft;
    }
  } else {
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

  if (!draft) {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "segment_scripting",
        errorCode: "SEGMENT_SCRIPTING_EMPTY_DRAFT",
        message: "segment_scripting_empty_draft",
      }),
      counters,
    };
  }

  const validatedDraft = draft;
  let validationReport = buildValidationReport({
    segment: params.segment,
    draft: validatedDraft,
  });

  const validationStageResult = await runStage({
    workflowRunId: params.workflowRunId,
    stage: {
      id: "validation",
      agent: {
        id: "validation-agent",
        getInputSummary: () => ({
          segmentId: params.segment.id,
          sourceLength: params.segment.content.length,
        }),
        getOutputSummary: ({ output }) => ({
          coverageRatio: output?.coverageRatio,
          issueCodes: output?.issueCodes,
        }),
        execute: async ({ runToolCall }) => {
          await runToolCall?.({
            toolName: "validate-structured-output",
            argumentsSummary: {
              segmentId: params.segment.id,
              lineCount: validatedDraft.lines.length,
            },
            getResultSummary: (toolResult) => ({
              valid: toolResult.valid,
              missingKeys: toolResult.missingKeys,
            }),
            execute: () =>
              validateStructuredOutput({
                value: validatedDraft,
                requiredKeys: ["segmentId", "lines"],
              }),
          });

          await runToolCall?.({
            toolName: "check-script-coverage",
            argumentsSummary: {
              segmentId: params.segment.id,
              sourceLength: params.segment.content.length,
              lineCount: validatedDraft.lines.length,
            },
            getResultSummary: (toolResult) => ({
              valid: toolResult.valid,
              coverageRatio: toolResult.coverageRatio,
              uncoveredChars: toolResult.uncoveredChars,
            }),
            execute: () =>
              checkScriptCoverage({
                sourceText: params.segment.content,
                scriptFragments: validatedDraft.lines.map(
                  (line) => line.sourceText
                ),
              }),
          });

          return {
            status: validationReport.valid ? "completed" : "failed",
            output: {
              coverageRatio: validationReport.coverageRatio,
              issueCodes: validationReport.issues.map((issue) => issue.code),
            },
          };
        },
      },
    },
    createId: params.createId,
    appendTrace: params.appendTrace,
    now: params.now,
    createStageRun: params.createStageRun,
    updateStageRun: params.updateStageRun,
    createAgentRun: params.createAgentRun,
    updateAgentRun: params.updateAgentRun,
    createToolCall: params.createToolCall,
    updateToolCall: params.updateToolCall,
  });

  await params.appendTrace(
    createValidationTraceEvent({
      createId: params.createId,
      now: params.now,
      workflowRunId: params.workflowRunId,
      stageRunId: validationStageResult.id,
      segment: params.segment,
      validationReport,
    })
  );
  await params.runtimeStore.updateStageRun({
    id: validationStageResult.id,
    workflowRunId: params.workflowRunId,
    stageId: "validation",
    status: validationReport.valid ? "completed" : "failed",
    summary: createStageSummary({
      segment: params.segment,
      stageId: "validation",
      summary: {
        coverageRatio: validationReport.coverageRatio,
        issueCodes: validationReport.issues.map((issue) => issue.code),
      },
    }),
    completedAt: (params.now ?? (() => new Date()))(),
  });
  params.onStageResult?.(validationStageResult);

  if (!validationReport.valid) {
    counters = {
      ...counters,
      semanticRetryCount: counters.semanticRetryCount + 1,
    };
    const repairStage = await runRepairStage({
      workflowRunId: params.workflowRunId,
      segmentId: params.segment.id,
      segmentText: params.segment.content,
      failureKind: "semantic_retry",
      failedArtifact: {
        kind: "validation-failure",
        segmentId: params.segment.id,
        validationReport,
      },
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

    if (repairStage.status !== "completed") {
      return {
        status: "failed",
        failure: createFailureDetail({
          segment: params.segment,
          stage: "segment_repair",
          errorCode: "SEGMENT_REPAIR_FAILED",
          message: repairStage.error || "segment_repair_failed",
          retryable: repairStage.status === "retrying",
        }),
        counters,
      };
    }

    if (
      repairStage.decision.action === "retry" &&
      params.semanticRetryDepth < MAX_SEMANTIC_RETRY_DEPTH
    ) {
      const retriedResult = await runSingleSegment({
        ...params,
        semanticRetryDepth: params.semanticRetryDepth + 1,
      });

      return {
        ...retriedResult,
        counters: mergeSegmentCounters(counters, retriedResult.counters),
      };
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
        failureKind: "input_refinement",
        failedArtifact: {
          kind: "validation-failure",
          segmentId: params.segment.id,
          validationReport,
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
            const refinedResult = await runSingleSegment({
              ...params,
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

          const mergedDraft = mergeRefinedSegmentDrafts({
            parentSegmentId: params.segment.id,
            drafts: refinedDrafts,
            now: params.now,
          });

          const mergedValidationReport = buildValidationReport({
            segment: params.segment,
            draft: mergedDraft,
          });

          if (mergedValidationReport.valid) {
            draft = mergedDraft;
            counters = mergedCounters;
            validationReport = mergedValidationReport;
          } else {
            return {
              status: "failed",
              failure: createFailureDetail({
                segment: params.segment,
                stage: "script_validation",
                errorCode: "SCRIPT_VALIDATION_FAILED",
                message: "input_refinement 后仍未通过校验",
                provider: "script-validator",
                coverageRatio: mergedValidationReport.coverageRatio,
                issueCodes: mergedValidationReport.issues.map(
                  (issue) => issue.code
                ),
                issueMessages: mergedValidationReport.issues.map(
                  (issue) => issue.message
                ),
              }),
              counters: mergedCounters,
            };
          }
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
        }),
        counters,
      };
    }

    if (!validationReport.valid) {
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
        }),
        counters,
      };
    }
  }

  const qualityStage = await runQualityJudgeStage({
    workflowRunId: params.workflowRunId,
    segmentId: params.segment.id,
    segmentScriptDraft: draft,
    validationReport,
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
    id: qualityStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "quality_judgement",
    status: qualityStage.status,
    summary: createStageSummary({
      segment: params.segment,
      stageId: "quality_judgement",
      summary:
        qualityStage.status === "completed"
          ? {
              decision: qualityStage.decision,
              verdict: qualityStage.verdict.verdict,
              score: qualityStage.verdict.score,
              coverageRatio: validationReport.coverageRatio,
            }
          : {
              errorCode: "QUALITY_STAGE_FAILED",
              message: qualityStage.error || "quality_stage_failed",
            },
    }),
    completedAt: (params.now ?? (() => new Date()))(),
  });
  params.onStageResult?.({
    id: qualityStage.stageRunId,
    stageId: "quality_judgement",
    status: qualityStage.status,
    agent: {
      runId: qualityStage.agentRunId,
      agentId: "quality-judge-agent",
      status: qualityStage.status,
      output:
        qualityStage.status === "completed"
          ? {
              decision: qualityStage.decision,
            }
          : undefined,
      error:
        qualityStage.status === "completed" ? undefined : qualityStage.error,
    },
  });

  if (qualityStage.status !== "completed") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "quality_judgement",
        errorCode: "QUALITY_STAGE_FAILED",
        message: qualityStage.error || "quality_stage_failed",
      }),
      counters,
    };
  }

  if (qualityStage.decision !== "auto_pass") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "quality_judgement",
        errorCode:
          qualityStage.decision === "manual_review_required"
            ? "QUALITY_MANUAL_REVIEW_REQUIRED"
            : "QUALITY_AUTO_FAIL",
        message:
          qualityStage.handoff?.summary ||
          qualityStage.verdict.reasons[0] ||
          "quality_check_not_passed",
        retryable: false,
        coverageRatio: validationReport.coverageRatio,
        issueCodes: [
          qualityStage.decision === "manual_review_required"
            ? "QUALITY_MANUAL_REVIEW_REQUIRED"
            : "QUALITY_AUTO_FAIL",
        ],
        issueMessages: qualityStage.verdict.reasons,
      }),
      counters,
    };
  }

  if (params.deferPersist) {
    const deferredDialogueLines = mapSegmentScriptDraftToDialogueLines({
      segmentScriptDraft: draft,
      chapterId: params.segment.chapterId ?? null,
    });

    return {
      status: "success",
      dialogueLines: deferredDialogueLines,
      summary: toSegmentSummary(
        params.segment.id,
        deferredDialogueLines.length,
        [
          ...new Set(
            deferredDialogueLines.map((line) => line.characterName || "未知")
          ),
        ]
      ),
      counters,
      draft,
    };
  }

  const persistStage = await runPersistCommitStage({
    workflowRunId: params.workflowRunId,
    bookId: params.bookId,
    artifacts: [
      {
        kind: "segment-script-draft",
        segmentScriptDraft: draft,
        chapterId: params.segment.chapterId ?? null,
      },
    ],
    characterProfiles: params.characterProfiles,
    characterMap: params.characterMap,
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
    id: persistStage.stageRunId,
    workflowRunId: params.workflowRunId,
    stageId: "persist",
    status: persistStage.status,
    summary: createStageSummary({
      segment: params.segment,
      stageId: "persist",
      summary:
        persistStage.status === "completed"
          ? {
              persistedSentenceCount:
                persistStage.artifact.persistedSentenceCount,
              persistedCharacterCount:
                persistStage.artifact.persistedCharacterCount,
            }
          : {
              errorCode: "PERSIST_STAGE_FAILED",
              message: persistStage.error || "persist_stage_failed",
            },
    }),
    completedAt: (params.now ?? (() => new Date()))(),
  });
  params.onStageResult?.({
    id: persistStage.stageRunId,
    stageId: "persist",
    status: persistStage.status,
    agent: {
      runId: persistStage.agentRunId,
      agentId: "persist-agent",
      status: persistStage.status,
      output:
        persistStage.status === "completed"
          ? {
              persistedSentenceCount:
                persistStage.artifact.persistedSentenceCount,
            }
          : undefined,
      error:
        persistStage.status === "completed" ? undefined : persistStage.error,
    },
  });

  if (persistStage.status !== "completed") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.segment,
        stage: "persist",
        errorCode: "PERSIST_STAGE_FAILED",
        message: persistStage.error || "persist_stage_failed",
      }),
      counters,
    };
  }

  const dialogueLines: DialogueLine[] = mapSegmentScriptDraftToDialogueLines({
    segmentScriptDraft: draft,
    chapterId: params.segment.chapterId ?? null,
  });
  counters = {
    ...counters,
    persistedSentenceCount:
      counters.persistedSentenceCount +
      persistStage.artifact.persistedSentenceCount,
    persistedCharacterCount:
      counters.persistedCharacterCount +
      persistStage.artifact.persistedCharacterCount,
  };

  if (persistStage.agentRunId) {
    const persistToolCallId = params.createId();
    const persistStartedAt = (params.now ?? (() => new Date()))();
    await params.runtimeStore.createToolCall({
      id: persistToolCallId,
      agentRunId: persistStage.agentRunId,
      toolName: "commit-script-sentences",
      status: "processing",
      argumentsSummary: {
        segmentId: params.segment.id,
        lineCount: draft.lines.length,
      },
      createdAt: persistStartedAt,
    });
    await params.runtimeStore.updateToolCall({
      id: persistToolCallId,
      agentRunId: persistStage.agentRunId,
      toolName: "commit-script-sentences",
      status: "completed",
      resultSummary: {
        persistedSentenceCount: persistStage.artifact.persistedSentenceCount,
        persistedCharacterCount: persistStage.artifact.persistedCharacterCount,
      },
      completedAt: (params.now ?? (() => new Date()))(),
    });
  }

  return {
    status: "success",
    dialogueLines,
    summary: toSegmentSummary(
      params.segment.id,
      dialogueLines.length,
      [...new Set(dialogueLines.map((line) => line.characterName || "未知"))]
    ),
    counters,
    draft,
  };
};

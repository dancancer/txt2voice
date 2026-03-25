import type { SegmentScriptDraft, ValidationReport } from "../../context";
import { runStage } from "../run-stage";
import {
  checkScriptCoverage,
  validateStructuredOutput,
} from "../../tools/validation-tools";
import {
  createStageSummary,
  createValidationTraceEvent,
} from "../script-production-runtime-helpers";
import type { RunSingleSegmentParams } from "./run-single-segment-types";

export const runValidationStage = async (params: {
  context: RunSingleSegmentParams;
  draft: SegmentScriptDraft;
  validationReport: ValidationReport;
}) => {
  const validationStageResult = await runStage({
    workflowRunId: params.context.workflowRunId,
    stage: {
      id: "validation",
      agent: {
        id: "validation-agent",
        getInputSummary: () => ({
          segmentId: params.context.segment.id,
          sourceLength: params.context.segment.content.length,
        }),
        getOutputSummary: ({ output }) => ({
          coverageRatio: output?.coverageRatio,
          issueCodes: output?.issueCodes,
        }),
        execute: async ({ runToolCall }) => {
          await runToolCall?.({
            toolName: "validate-structured-output",
            argumentsSummary: {
              segmentId: params.context.segment.id,
              lineCount: params.draft.lines.length,
            },
            getResultSummary: (toolResult) => ({
              valid: toolResult.valid,
              missingKeys: toolResult.missingKeys,
            }),
            execute: () =>
              validateStructuredOutput({
                value: params.draft,
                requiredKeys: ["segmentId", "lines"],
              }),
          });

          await runToolCall?.({
            toolName: "check-script-coverage",
            argumentsSummary: {
              segmentId: params.context.segment.id,
              sourceLength: params.context.segment.content.length,
              lineCount: params.draft.lines.length,
            },
            getResultSummary: (toolResult) => ({
              valid: toolResult.valid,
              coverageRatio: toolResult.coverageRatio,
              uncoveredChars: toolResult.uncoveredChars,
            }),
            execute: () =>
              checkScriptCoverage({
                sourceText: params.context.segment.content,
                scriptFragments: params.draft.lines.map(
                  (line) => line.sourceText
                ),
              }),
          });

          return {
            status: params.validationReport.valid ? "completed" : "failed",
            output: {
              coverageRatio: params.validationReport.coverageRatio,
              issueCodes: params.validationReport.issues.map(
                (issue) => issue.code
              ),
            },
          };
        },
      },
    },
    createId: params.context.createId,
    appendTrace: params.context.appendTrace,
    now: params.context.now,
    createStageRun: params.context.createStageRun,
    updateStageRun: params.context.updateStageRun,
    createAgentRun: params.context.createAgentRun,
    updateAgentRun: params.context.updateAgentRun,
    createToolCall: params.context.createToolCall,
    updateToolCall: params.context.updateToolCall,
  });

  await params.context.appendTrace(
    createValidationTraceEvent({
      createId: params.context.createId,
      now: params.context.now,
      workflowRunId: params.context.workflowRunId,
      stageRunId: validationStageResult.id,
      segment: params.context.segment,
      validationReport: params.validationReport,
    })
  );
  await params.context.runtimeStore.updateStageRun({
    id: validationStageResult.id,
    workflowRunId: params.context.workflowRunId,
    stageId: "validation",
    status: params.validationReport.valid ? "completed" : "failed",
    summary: createStageSummary({
      segment: params.context.segment,
      stageId: "validation",
      summary: {
        coverageRatio: params.validationReport.coverageRatio,
        issueCodes: params.validationReport.issues.map((issue) => issue.code),
      },
    }),
    completedAt: (params.context.now ?? (() => new Date()))(),
  });
  params.context.onStageResult?.(validationStageResult);

  await params.context.runtimeStore.createRuntimeArtifact({
    id: params.context.createId(),
    workflowRunId: params.context.workflowRunId,
    stageRunId: validationStageResult.id,
    agentRunId: validationStageResult.agent.runId ?? null,
    segmentId: params.context.segment.id,
    artifactKind: "validation-report",
    artifactVersion: "v1",
    payload: params.validationReport,
    createdAt: (params.context.now ?? (() => new Date()))(),
  });

  return validationStageResult;
};

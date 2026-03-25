import { mapSegmentScriptDraftToDialogueLines } from "@/lib/script-generator/storage/persistence";
import type { SegmentScriptDraft, ValidationReport } from "../../context";
import {
  createFailureDetail,
  createStageSummary,
  toSegmentSummary,
} from "../script-production-runtime-helpers";
import { runPersistStage } from "../stages/run-persist-stage";
import { runQualityStage } from "../stages/run-quality-stage";
import type { RunSingleSegmentParams } from "./run-single-segment-types";
import type { SegmentRunResult, SegmentRuntimeCounters } from "./shared-types";

type FinalizeSegmentResult = SegmentRunResult;

export const finalizeSegment = async (params: {
  context: RunSingleSegmentParams;
  draft: SegmentScriptDraft;
  validationReport: ValidationReport;
  counters: SegmentRuntimeCounters;
}): Promise<FinalizeSegmentResult> => {
  const runQualityJudgeStage =
    params.context.runQualityStage || runQualityStage;
  const runPersistCommitStage =
    params.context.runPersistStage || runPersistStage;

  const qualityStage = await runQualityJudgeStage({
    workflowRunId: params.context.workflowRunId,
    segmentId: params.context.segment.id,
    segmentScriptDraft: params.draft,
    validationReport: params.validationReport,
    adapter: params.context.adapter,
    createId: params.context.createId,
    now: params.context.now,
    createStageRun: params.context.createStageRun,
    updateStageRun: params.context.updateStageRun,
    createAgentRun: params.context.createAgentRun,
    updateAgentRun: params.context.updateAgentRun,
    createToolCall: params.context.createToolCall,
    updateToolCall: params.context.updateToolCall,
    appendTrace: params.context.appendTrace,
  });

  await params.context.runtimeStore.updateStageRun({
    id: qualityStage.stageRunId,
    workflowRunId: params.context.workflowRunId,
    stageId: "quality_judgement",
    status: qualityStage.status,
    summary: createStageSummary({
      segment: params.context.segment,
      stageId: "quality_judgement",
      summary:
        qualityStage.status === "completed"
          ? {
              decision: qualityStage.decision,
              verdict: qualityStage.verdict.verdict,
              score: qualityStage.verdict.score,
              coverageRatio: params.validationReport.coverageRatio,
            }
          : {
              errorCode: "QUALITY_STAGE_FAILED",
              message: qualityStage.error || "quality_stage_failed",
            },
    }),
    completedAt: (params.context.now ?? (() => new Date()))(),
  });
  params.context.onStageResult?.({
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
        segment: params.context.segment,
        stage: "quality_judgement",
        errorCode: "QUALITY_STAGE_FAILED",
        message: qualityStage.error || "quality_stage_failed",
      }),
      counters: params.counters,
    };
  }

  if (qualityStage.decision !== "auto_pass") {
    return {
      status: "failed",
      failure: createFailureDetail({
        segment: params.context.segment,
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
        coverageRatio: params.validationReport.coverageRatio,
        issueCodes: [
          qualityStage.decision === "manual_review_required"
            ? "QUALITY_MANUAL_REVIEW_REQUIRED"
            : "QUALITY_AUTO_FAIL",
        ],
        issueMessages: qualityStage.verdict.reasons,
      }),
      counters: params.counters,
    };
  }

  if (params.context.deferPersist) {
    const deferredDialogueLines = mapSegmentScriptDraftToDialogueLines({
      segmentScriptDraft: params.draft,
      chapterId: params.context.segment.chapterId ?? null,
    });

    return {
      status: "success",
      dialogueLines: deferredDialogueLines,
      summary: toSegmentSummary(
        params.context.segment.id,
        deferredDialogueLines.length,
        [
          ...new Set(
            deferredDialogueLines.map((line) => line.characterName || "未知")
          ),
        ]
      ),
      counters: params.counters,
      draft: params.draft,
    };
  }

  const persistStage = await runPersistCommitStage({
    workflowRunId: params.context.workflowRunId,
    bookId: params.context.bookId,
    artifacts: [
      {
        kind: "segment-script-draft",
        segmentScriptDraft: params.draft,
        chapterId: params.context.segment.chapterId ?? null,
      },
    ],
    characterProfiles: params.context.characterProfiles,
    characterMap: params.context.characterMap,
    createId: params.context.createId,
    now: params.context.now,
    createStageRun: params.context.createStageRun,
    updateStageRun: params.context.updateStageRun,
    createAgentRun: params.context.createAgentRun,
    updateAgentRun: params.context.updateAgentRun,
    createToolCall: params.context.createToolCall,
    updateToolCall: params.context.updateToolCall,
    appendTrace: params.context.appendTrace,
  });

  await params.context.runtimeStore.updateStageRun({
    id: persistStage.stageRunId,
    workflowRunId: params.context.workflowRunId,
    stageId: "persist",
    status: persistStage.status,
    summary: createStageSummary({
      segment: params.context.segment,
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
    completedAt: (params.context.now ?? (() => new Date()))(),
  });
  params.context.onStageResult?.({
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
        segment: params.context.segment,
        stage: "persist",
        errorCode: "PERSIST_STAGE_FAILED",
        message: persistStage.error || "persist_stage_failed",
      }),
      counters: params.counters,
    };
  }

  await params.context.appendTrace({
    id: params.context.createId(),
    kind: "artifact_committed",
    createdAt: (params.context.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.context.workflowRunId,
    stageRunId: persistStage.stageRunId,
    agentRunId: persistStage.agentRunId,
    status: "completed",
    payload: {
      artifactKind: "segment-script-draft",
      segmentId: params.context.segment.id,
      persistedSentenceCount: persistStage.artifact.persistedSentenceCount,
      persistedCharacterCount: persistStage.artifact.persistedCharacterCount,
    },
  });

  const dialogueLines = mapSegmentScriptDraftToDialogueLines({
    segmentScriptDraft: params.draft,
    chapterId: params.context.segment.chapterId ?? null,
  });
  const counters = {
    ...params.counters,
    persistedSentenceCount:
      params.counters.persistedSentenceCount +
      persistStage.artifact.persistedSentenceCount,
    persistedCharacterCount:
      params.counters.persistedCharacterCount +
      persistStage.artifact.persistedCharacterCount,
  };

  if (persistStage.agentRunId) {
    const persistToolCallId = params.context.createId();
    const persistStartedAt = (params.context.now ?? (() => new Date()))();
    await params.context.runtimeStore.createToolCall({
      id: persistToolCallId,
      agentRunId: persistStage.agentRunId,
      toolName: "commit-script-sentences",
      status: "processing",
      argumentsSummary: {
        segmentId: params.context.segment.id,
        lineCount: params.draft.lines.length,
      },
      createdAt: persistStartedAt,
    });
    await params.context.runtimeStore.updateToolCall({
      id: persistToolCallId,
      agentRunId: persistStage.agentRunId,
      toolName: "commit-script-sentences",
      status: "completed",
      resultSummary: {
        persistedSentenceCount: persistStage.artifact.persistedSentenceCount,
        persistedCharacterCount: persistStage.artifact.persistedCharacterCount,
      },
      completedAt: (params.context.now ?? (() => new Date()))(),
    });
  }

  return {
    status: "success",
    dialogueLines,
    summary: toSegmentSummary(
      params.context.segment.id,
      dialogueLines.length,
      [...new Set(dialogueLines.map((line) => line.characterName || "未知"))]
    ),
    counters,
    draft: params.draft,
  };
};

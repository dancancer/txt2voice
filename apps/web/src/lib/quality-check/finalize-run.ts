import prisma from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";
import { readGovernanceState } from "@/lib/deep-gate-calibration-governance/parsers";
import type { QualityCheckTaskContext } from "@/lib/quality-check/task-context";
import type { QualityCheckTaskType } from "@/lib/quality-check/shared-types";
import type { QualityCheckProcessingState } from "@/lib/quality-check/process-audio-files";

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

const updateCalibrationEvalReportStatus = async ({
  bookId,
  bookMetadata,
  reportId,
  replayTaskId,
  replayTaskStatus,
}: {
  bookId: string;
  bookMetadata: Prisma.JsonValue | null | undefined;
  reportId: string | null;
  replayTaskId: string;
  replayTaskStatus: "completed" | "failed";
}): Promise<void> => {
  if (!reportId) {
    return;
  }

  const { rootMetadata, qualityCheckMetadata, governance } = readGovernanceState(
    bookMetadata
  );
  const nextReports = governance.reports.map((report) =>
    report.id === reportId
      ? { ...report, replayTaskId, replayTaskStatus }
      : report
  );
  const targetSampleSetId = nextReports.find((report) => report.id === reportId)?.sampleSetId;
  const nextSampleSets = governance.sampleSets.map((sampleSet) =>
    sampleSet.id === targetSampleSetId
      ? { ...sampleSet, latestReplayTaskId: replayTaskId }
      : sampleSet
  );

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheckMetadata,
          deepGateThresholdGovernance: {
            reports: nextReports,
            releases: governance.releases,
            sampleSets: nextSampleSets,
            activeVersion: governance.activeVersion,
            activeReleaseId: governance.activeReleaseId,
            updatedAt: new Date().toISOString(),
            lastEvaluatedReportId: governance.lastEvaluatedReportId,
          },
        },
      }),
    },
  });
};

export const finalizeQualityCheckRun = async ({
  taskId,
  bookId,
  type,
  chapterId,
  audioFileIds,
  signalSyncTaskId,
  taskContext,
  bookMetadata,
  processingState,
  deepGateCalibration,
  thresholdTemplate,
  thresholdTemplateSource,
  q0q3SignalSourceConfig,
  q0q3SignalSourceConfigSource,
  q0q3ThresholdTemplate,
  q0q3ThresholdTemplateSource,
  chapterAuditCount,
  chapterAuditRepairCount,
  chapterAuditManualReviewCount,
  deepGateModelRuntime,
}: {
  taskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  signalSyncTaskId: string | null;
  taskContext: QualityCheckTaskContext;
  bookMetadata: Prisma.JsonValue | null | undefined;
  processingState: QualityCheckProcessingState;
  deepGateCalibration: unknown;
  thresholdTemplate: unknown;
  thresholdTemplateSource: string;
  q0q3SignalSourceConfig: unknown;
  q0q3SignalSourceConfigSource: string;
  q0q3ThresholdTemplate: unknown;
  q0q3ThresholdTemplateSource: string;
  chapterAuditCount: number;
  chapterAuditRepairCount: number;
  chapterAuditManualReviewCount: number;
  deepGateModelRuntime: Record<string, unknown>;
}): Promise<void> => {
  const isCalibrationEval = taskContext.calibrationEval.enabled;
  const checked = processingState.checked;
  const q0q3Summary = {
    averageScores: {
      q0: checked > 0 ? clampScore(processingState.q0ScoreSum / checked) : 0,
      q1: checked > 0 ? clampScore(processingState.q1ScoreSum / checked) : 0,
      q2: checked > 0 ? clampScore(processingState.q2ScoreSum / checked) : 0,
      q3: checked > 0 ? clampScore(processingState.q3ScoreSum / checked) : 0,
    },
    q2Cer: {
      availableCount: processingState.q2CerValueCount,
      missingCount: Math.max(0, checked - processingState.q2CerValueCount),
      average:
        processingState.q2CerValueCount > 0
          ? Number(
              (processingState.q2CerValueSum / processingState.q2CerValueCount).toFixed(4)
            )
          : null,
    },
    q3SpeakerSimilarity: {
      availableCount: processingState.q3SpeakerSimilarityCount,
      missingCount: Math.max(0, checked - processingState.q3SpeakerSimilarityCount),
      average:
        processingState.q3SpeakerSimilarityCount > 0
          ? Number(
              (
                processingState.q3SpeakerSimilaritySum /
                processingState.q3SpeakerSimilarityCount
              ).toFixed(4)
            )
          : null,
    },
    signalSourceUsage: processingState.q0q3SignalSourceUsage,
    signalSourceConfig: q0q3SignalSourceConfig,
    signalSourceConfigSource: q0q3SignalSourceConfigSource,
    thresholdTemplate: q0q3ThresholdTemplate,
    thresholdTemplateSource: q0q3ThresholdTemplateSource,
  };

  const calibrationEvalSummary = isCalibrationEval
    ? {
        enabled: true,
        dryRun: taskContext.calibrationEval.dryRun,
        reportId: taskContext.calibrationEval.reportId,
        sampleSetId: taskContext.calibrationEval.sampleSetId,
        sampleSize: checked,
        labeledCount: processingState.calibrationEvalLabeledCount,
        unlabeledCount: Math.max(0, checked - processingState.calibrationEvalLabeledCount),
        exactMatchCount: processingState.calibrationEvalExactMatchCount,
        exactMatchRate:
          processingState.calibrationEvalLabeledCount > 0
            ? Number(
                (
                  processingState.calibrationEvalExactMatchCount /
                  processingState.calibrationEvalLabeledCount
                ).toFixed(4)
              )
            : null,
        falsePositiveCount: processingState.calibrationEvalFalsePositiveCount,
        falsePositiveRate:
          processingState.calibrationEvalLabeledCount > 0
            ? Number(
                (
                  processingState.calibrationEvalFalsePositiveCount /
                  processingState.calibrationEvalLabeledCount
                ).toFixed(4)
              )
            : null,
        falseNegativeCount: processingState.calibrationEvalFalseNegativeCount,
        falseNegativeRate:
          processingState.calibrationEvalLabeledCount > 0
            ? Number(
                (
                  processingState.calibrationEvalFalseNegativeCount /
                  processingState.calibrationEvalLabeledCount
                ).toFixed(4)
              )
            : null,
        issueTypeBreakdown: processingState.calibrationEvalIssueTypeBreakdown,
      }
    : null;

  const summary = {
    type,
    chapterId: chapterId || null,
    requestedAudioFiles: audioFileIds || [],
    checked,
    passCount: processingState.passCount,
    repairCount: processingState.repairCount,
    manualReviewCount: processingState.manualReviewCount,
    hardFailCount: processingState.hardFailCount,
    secondaryDispatchCount: processingState.secondaryDispatchCount,
    secondaryDispatchSkippedByThresholdCount:
      processingState.secondaryDispatchSkippedByThresholdCount,
    issueTypeCounts: processingState.issueTypeCounts,
    deepGateOverrideCount: processingState.deepGateOverrideCount,
    falsePositiveCandidateCount: processingState.falsePositiveCandidateCount,
    thresholdTemplate,
    thresholdTemplateSource,
    deepGateModelRuntime,
    q0q3Summary,
    signalSourceSummary: processingState.q0q3SignalSourceUsage,
    deepGateCalibration,
    calibrationEval: calibrationEvalSummary,
    chapterAuditCount,
    chapterAuditRepairCount,
    chapterAuditManualReviewCount,
    signalSyncTaskId,
    source: taskContext.source,
  };

  const message = isCalibrationEval
    ? `校准回放完成：检查 ${checked} 条，精确匹配 ${processingState.calibrationEvalExactMatchCount}/${processingState.calibrationEvalLabeledCount}`
    : `质检完成：通过 ${processingState.passCount}，返工 ${processingState.repairCount}，人工复核 ${processingState.manualReviewCount}，章节审计 ${chapterAuditCount}`;
  const taskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      ...summary,
      stage: "completed",
      completedAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: checked,
      completedAt: new Date(),
      taskData,
    },
  });

  if (isCalibrationEval) {
    await updateCalibrationEvalReportStatus({
      bookId,
      bookMetadata,
      reportId: taskContext.calibrationEval.reportId,
      replayTaskId: taskId,
      replayTaskStatus: "completed",
    });
    return;
  }

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...jsonObject(bookMetadata),
        qualityCheck: {
          ...summary,
          checkedAt: new Date().toISOString(),
          chapterAudits: {
            batchId: taskId,
            total: chapterAuditCount,
            repairCount: chapterAuditRepairCount,
            manualReviewCount: chapterAuditManualReviewCount,
          },
          falsePositiveSignals: {
            deepGateOverrideCount: processingState.deepGateOverrideCount,
            candidateCount: processingState.falsePositiveCandidateCount,
          },
        },
      }),
    },
  });
};

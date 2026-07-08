import prisma, { Decimal } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";
import type { CombinedQualityDecision, FastGateSnapshot } from "@/lib/quality-gate";
import type {
  CalibrationSampleLabel,
  QualityCheckTaskContext,
} from "@/lib/quality-check/task-context";
import { syncReprocessingManualReviewItems } from "@/lib/quality-check/reprocessing-dispatch";

interface PersistAudioFile {
  id: string;
  bookId: string;
  chapterId: string | null;
  segmentId: string | null;
  sentenceId: string | null;
  voiceProfileId: string | null;
  duration: Prisma.Decimal | number | null;
  synthesisAttempts: Array<{
    id: string;
  }>;
}

interface PersistDeepGateDecision {
  verdict: string;
  score: number;
  issueType: string;
  q4Source: string;
  q5Source: string;
  modelDiagnostics?: Record<string, unknown> | null;
}

interface PersistQualityCheckDecisionInput {
  tx: Prisma.TransactionClient;
  audioFile: PersistAudioFile;
  durationSeconds: number;
  decision: CombinedQualityDecision;
  fastDecision: FastGateSnapshot;
  deepDecision: PersistDeepGateDecision;
  taskId: string;
  taskContext: QualityCheckTaskContext;
  candidateReviewItemIds?: string[];
  calibrationSampleLabel: CalibrationSampleLabel | null;
  isCalibrationEval: boolean;
  thresholdTemplate: unknown;
  thresholdTemplateSource: string;
  q0q3ThresholdTemplate: unknown;
  q0q3ThresholdTemplateSource: string;
  modelRuntimeSource: string;
}

interface PersistQualityCheckDecisionResult {
  secondaryPendingCount: number;
  secondarySkippedByThresholdCount: number;
}

interface PersistChapterQualityAuditInput {
  bookId: string;
  taskId: string;
  chapterId: string;
  verdict: "pass" | "repair" | "manual_review" | "hard_fail";
  overallScore: number;
  speakerDrift: Record<string, Prisma.InputJsonValue>;
  checked: number;
  averageQ4Score: number;
  averageQ5Score: number;
  averageCharsPerSecond: number | null;
  stdDevCharsPerSecond: number | null;
  issueTypeCounts: Record<string, number>;
  actions: string[];
}

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

const isReviewLikeVerdict = (verdict: CombinedQualityDecision["verdict"]): boolean => {
  return verdict === "manual_review" || verdict === "hard_fail";
};

export const persistQualityCheckDecision = async ({
  tx,
  audioFile,
  durationSeconds,
  decision,
  fastDecision,
  deepDecision,
  taskId,
  taskContext,
  candidateReviewItemIds,
  calibrationSampleLabel,
  isCalibrationEval,
  thresholdTemplate,
  thresholdTemplateSource,
  q0q3ThresholdTemplate,
  q0q3ThresholdTemplateSource,
  modelRuntimeSource,
}: PersistQualityCheckDecisionInput): Promise<PersistQualityCheckDecisionResult> => {
  const qualityResult = await tx.qualityCheckResult.create({
    data: {
      bookId: audioFile.bookId,
      chapterId: audioFile.chapterId,
      segmentId: audioFile.segmentId,
      sentenceId: audioFile.sentenceId,
      audioFileId: audioFile.id,
      attemptId: audioFile.synthesisAttempts[0]?.id,
      gate: "FAST_DEEP_GATE",
      stage: "Q0_Q5",
      verdict: decision.verdict,
      score: new Decimal(decision.score.toFixed(2)),
      hardFail: decision.hardFail,
      thresholdKey: "fast_deep_gate_v3",
      metrics: {
        q0Score: decision.q0Score || fastDecision.q0Score || 0,
        q1Score: decision.q1Score,
        q2Score: decision.q2Score,
        q3Score: decision.q3Score,
        q4Score: decision.q4Score,
        q5Score: decision.q5Score,
        fastGateScore: decision.fastGateScore,
        deepGateScore: decision.deepGateScore,
        charsPerSecond: decision.charsPerSecond,
        durationSeconds,
        q2Cer: decision.signalValues?.q2Cer || null,
        q3SpeakerSimilarity: decision.signalValues?.q3SpeakerSimilarity || null,
        signalSources: decision.signalSources || fastDecision.signalSources || null,
      } as Prisma.InputJsonValue,
      reasons: decision.reasons as Prisma.InputJsonValue,
      detail: toInputJsonValue({
        source: taskContext.source || "unknown",
        repairPlan: decision.repairPlan,
        issueType: decision.issueType,
        thresholdTemplate,
        thresholdTemplateSource,
        ...(calibrationSampleLabel
          ? {
              calibrationLabel: {
                expectedVerdict: calibrationSampleLabel.expectedVerdict,
                issueType: calibrationSampleLabel.issueType,
                source: calibrationSampleLabel.source,
                fallbackUsed: calibrationSampleLabel.fallbackUsed,
                reportId: taskContext.calibrationEval.reportId,
                sampleSetId: taskContext.calibrationEval.sampleSetId,
                dryRun: taskContext.calibrationEval.dryRun,
              },
            }
          : {}),
        fastGate: {
          verdict: fastDecision.verdict,
          score: fastDecision.score,
          hardFail: fastDecision.hardFail,
          issueType: fastDecision.issueType || "FAST_GATE",
          primarySignal: fastDecision.primarySignal || "q0_precheck",
          signalSources: fastDecision.signalSources,
          signalValues: fastDecision.signalValues,
          thresholdTemplate: q0q3ThresholdTemplate,
          thresholdTemplateSource: q0q3ThresholdTemplateSource,
        },
        deepGate: {
          verdict: deepDecision.verdict,
          score: deepDecision.score,
          issueType: deepDecision.issueType,
          q4Source: deepDecision.q4Source,
          q5Source: deepDecision.q5Source,
          modelDiagnostics: deepDecision.modelDiagnostics,
          modelRuntimeSource,
        },
      }),
    },
  });

  if (isCalibrationEval) {
    return {
      secondaryPendingCount: 0,
      secondarySkippedByThresholdCount: 0,
    };
  }

  await tx.audioFile.update({
    where: { id: audioFile.id },
    data: {
      qualityScore: new Decimal(decision.score.toFixed(2)),
      qualityVerdict: decision.verdict,
      qualityStatus: decision.verdict,
    },
  });

  const reprocessingSync = await syncReprocessingManualReviewItems({
    tx,
    bookId: audioFile.bookId,
    sentenceId: audioFile.sentenceId,
    audioFileId: audioFile.id,
    attemptId: audioFile.synthesisAttempts[0]?.id,
    qualityResultId: qualityResult.id,
    decision,
    taskId,
    manualReviewItemId: taskContext.manualReviewItemId || undefined,
    candidateReviewItemIds,
    autoCreatePendingOnReject: taskContext.autoCreatePendingOnReject,
    maxAutoRejectedCount: taskContext.maxAutoRejectedCount,
    issueTypePolicies: taskContext.issueTypePolicies,
    source: taskContext.source,
  });

  if (
    reprocessingSync.syncedCount === 0 &&
    isReviewLikeVerdict(decision.verdict)
  ) {
    const existingReview = await tx.manualReviewItem.findFirst({
      where: {
        bookId: audioFile.bookId,
        audioFileId: audioFile.id,
        issueType: decision.issueType,
        status: "pending",
      },
      select: { id: true },
    });

    if (!existingReview) {
      await tx.manualReviewItem.create({
        data: {
          bookId: audioFile.bookId,
          chapterId: audioFile.chapterId,
          segmentId: audioFile.segmentId,
          sentenceId: audioFile.sentenceId,
          audioFileId: audioFile.id,
          attemptId: audioFile.synthesisAttempts[0]?.id,
          issueType: decision.issueType,
          priority: decision.verdict === "hard_fail" ? "high" : "normal",
          status: "pending",
          issueDetail: {
            reasons: decision.reasons,
            repairPlan: decision.repairPlan,
            score: decision.score,
            issueType: decision.issueType,
            primarySignal: decision.primarySignal || "q0_precheck",
            signalSources: decision.signalSources || {},
            signalValues: decision.signalValues || {},
            source: taskContext.source || "unknown",
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return {
    secondaryPendingCount: reprocessingSync.secondaryPendingCount,
    secondarySkippedByThresholdCount:
      reprocessingSync.secondarySkippedByThresholdCount,
  };
};

export const persistChapterQualityAudit = async ({
  bookId,
  taskId,
  chapterId,
  verdict,
  overallScore,
  speakerDrift,
  checked,
  averageQ4Score,
  averageQ5Score,
  averageCharsPerSecond,
  stdDevCharsPerSecond,
  issueTypeCounts,
  actions,
}: PersistChapterQualityAuditInput): Promise<void> => {
  await prisma.chapterQualityAudit.create({
    data: {
      bookId,
      chapterId,
      auditBatchId: taskId,
      verdict,
      overallScore: new Decimal(overallScore.toFixed(2)),
      targetLufs: new Decimal("-19.00"),
      actualLufs: null,
      peakDbtp: null,
      continuityMetric: {
        checked,
        averageQ4Score,
        averageQ5Score,
        averageCharsPerSecond,
        stdDevCharsPerSecond,
        issueTypeCounts,
      } as Prisma.InputJsonValue,
      speakerDrift: speakerDrift as Prisma.InputJsonValue,
      actions: actions as Prisma.InputJsonValue,
    },
  });
};

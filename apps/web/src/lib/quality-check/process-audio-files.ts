import prisma from "@/lib/prisma";
import { updateProcessingTaskProgress as updateTaskProgress } from "@/lib/processing-task-utils";
import { extractQ0Q3RawSignals } from "@/lib/quality-check/q0q3-runtime";
import { inferDeepGateModelSignals } from "@/lib/quality-check/deep-gate-model-inference";
import {
  buildChapterGateContextMap,
  combineQualityGateDecision,
  evaluateDeepGate,
  isFalsePositiveCandidate,
} from "@/lib/quality-gate";
import type {
  ChapterGateSample,
  CombinedQualityDecision,
  DeepGateCalibrationSample,
} from "@/lib/quality-gate";
import type { QualityCheckTaskContext } from "@/lib/quality-check/task-context";
import { persistQualityCheckDecision } from "@/lib/quality-check/persistence";
import { evaluateFastGate } from "@/lib/quality-check/fast-gate";
import {
  updateChapterAuditMap,
  type ChapterAuditAccumulator,
} from "@/lib/quality-check/chapter-audit";

const isReviewLikeVerdict = (verdict: string): boolean => {
  return verdict === "manual_review" || verdict === "hard_fail";
};

const updateSignalSourceCount = (
  bucket: Record<string, number>,
  stage: "q0" | "q1" | "q2" | "q3",
  source: string | undefined
): void => {
  if (!source) {
    return;
  }
  const key = `${stage}:${source}`;
  bucket[key] = (bucket[key] || 0) + 1;
};

export interface QualityCheckProcessingState {
  checked: number;
  passCount: number;
  repairCount: number;
  manualReviewCount: number;
  hardFailCount: number;
  secondaryDispatchCount: number;
  secondaryDispatchSkippedByThresholdCount: number;
  deepGateOverrideCount: number;
  falsePositiveCandidateCount: number;
  emotionModelUsedCount: number;
  continuityModelUsedCount: number;
  deepGateModelFallbackCount: number;
  q0ScoreSum: number;
  q1ScoreSum: number;
  q2ScoreSum: number;
  q3ScoreSum: number;
  q2CerValueSum: number;
  q2CerValueCount: number;
  q3SpeakerSimilaritySum: number;
  q3SpeakerSimilarityCount: number;
  q0q3SignalSourceUsage: Record<string, number>;
  issueTypeCounts: Record<string, number>;
  deepGateCalibrationSamples: DeepGateCalibrationSample[];
  chapterAuditMap: Map<string, ChapterAuditAccumulator>;
  calibrationEvalLabeledCount: number;
  calibrationEvalExactMatchCount: number;
  calibrationEvalFalsePositiveCount: number;
  calibrationEvalFalseNegativeCount: number;
  calibrationEvalIssueTypeBreakdown: Record<string, { total: number; exactMatchCount: number }>;
}

const createProcessingState = (): QualityCheckProcessingState => ({
  checked: 0,
  passCount: 0,
  repairCount: 0,
  manualReviewCount: 0,
  hardFailCount: 0,
  secondaryDispatchCount: 0,
  secondaryDispatchSkippedByThresholdCount: 0,
  deepGateOverrideCount: 0,
  falsePositiveCandidateCount: 0,
  emotionModelUsedCount: 0,
  continuityModelUsedCount: 0,
  deepGateModelFallbackCount: 0,
  q0ScoreSum: 0,
  q1ScoreSum: 0,
  q2ScoreSum: 0,
  q3ScoreSum: 0,
  q2CerValueSum: 0,
  q2CerValueCount: 0,
  q3SpeakerSimilaritySum: 0,
  q3SpeakerSimilarityCount: 0,
  q0q3SignalSourceUsage: {},
  issueTypeCounts: {},
  deepGateCalibrationSamples: [],
  chapterAuditMap: new Map<string, ChapterAuditAccumulator>(),
  calibrationEvalLabeledCount: 0,
  calibrationEvalExactMatchCount: 0,
  calibrationEvalFalsePositiveCount: 0,
  calibrationEvalFalseNegativeCount: 0,
  calibrationEvalIssueTypeBreakdown: {},
});

export const processQualityCheckAudioFiles = async ({
  taskId,
  audioFiles,
  taskContext,
  q0q3SignalSourceConfig,
  q0q3ThresholdTemplate,
  thresholdTemplate,
  modelRuntime,
  modelRuntimeSource,
  isCalibrationEval,
  onProgress,
}: {
  taskId: string;
  audioFiles: Array<{
    id: string;
    bookId: string;
    chapterId: string | null;
    segmentId: string | null;
    sentenceId: string | null;
    voiceProfileId: string | null;
    duration: any;
    scriptSentence: {
      id: string;
      text: string;
      roleType: string | null;
      priority: string | null;
      emotionLabel: string | null;
      emotionIntensity: any;
    } | null;
    synthesisAttempts: Array<{
      id: string;
      metrics?: unknown;
    }>;
  }>;
  taskContext: QualityCheckTaskContext;
  q0q3SignalSourceConfig: unknown;
  q0q3ThresholdTemplate: any;
  thresholdTemplate: any;
  modelRuntime: {
    useEmotionModel: boolean;
    useContinuityModel: boolean;
  };
  modelRuntimeSource: string;
  isCalibrationEval: boolean;
  onProgress?: (payload: {
    checked: number;
    total: number;
    progress: number;
    verdict: string;
    issueType: string;
    sentenceId?: string | null;
    audioFileId?: string | null;
  }) => Promise<void> | void;
}): Promise<QualityCheckProcessingState> => {
  const state = createProcessingState();
  const candidateReviewItemIds =
    taskContext.retryReviewItemIds.length > 0
      ? taskContext.retryReviewItemIds
      : undefined;

  const chapterContextMap = buildChapterGateContextMap(
    audioFiles
      .map((audioFile) => {
        if (!audioFile.chapterId || !audioFile.scriptSentence) {
          return null;
        }

        const durationSeconds = Number(audioFile.duration || 0);
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          return null;
        }

        return {
          chapterId: audioFile.chapterId,
          roleType: audioFile.scriptSentence.roleType || "narration",
          voiceProfileId: audioFile.voiceProfileId || "",
          charsPerSecond: Number(
            (
              audioFile.scriptSentence.text.trim().length /
              Math.max(durationSeconds, 0.0001)
            ).toFixed(4)
          ),
        } satisfies ChapterGateSample;
      })
      .filter((item): item is ChapterGateSample => Boolean(item))
  );

  for (let index = 0; index < audioFiles.length; index += 1) {
    const audioFile = audioFiles[index];
    if (!audioFile.scriptSentence || !audioFile.sentenceId) {
      continue;
    }

    const durationSeconds = Number(audioFile.duration || 0);
    const emotionIntensity =
      audioFile.scriptSentence.emotionIntensity !== null &&
      audioFile.scriptSentence.emotionIntensity !== undefined
        ? Number(audioFile.scriptSentence.emotionIntensity)
        : null;
    const rawSignals = extractQ0Q3RawSignals({
      attemptMetrics: audioFile.synthesisAttempts[0]?.metrics,
      taskMetadata: taskContext.taskMetadata,
      audioFileId: audioFile.id,
      sentenceId: audioFile.sentenceId || null,
    });
    const fastDecision = evaluateFastGate({
      text: audioFile.scriptSentence.text,
      roleType: audioFile.scriptSentence.roleType,
      priority: audioFile.scriptSentence.priority,
      emotionIntensity,
      durationSeconds,
      hasVoiceProfile: Boolean(audioFile.voiceProfileId),
      rawSignals,
      signalSources: q0q3SignalSourceConfig as any,
      thresholds: q0q3ThresholdTemplate,
    });
    const deepInput = {
      text: audioFile.scriptSentence.text,
      roleType: audioFile.scriptSentence.roleType,
      emotionLabel: audioFile.scriptSentence.emotionLabel,
      emotionIntensity,
      charsPerSecond: fastDecision.charsPerSecond,
      chapterContext: audioFile.chapterId
        ? chapterContextMap.get(audioFile.chapterId)
        : undefined,
      voiceProfileId: audioFile.voiceProfileId,
    };
    const deepModelInference = await inferDeepGateModelSignals({
      runtime: modelRuntime as any,
      input: deepInput,
    });
    const deepDecision = evaluateDeepGate({
      input: deepInput,
      thresholds: thresholdTemplate,
      modelInference: deepModelInference,
    });
    const decision = combineQualityGateDecision({
      fast: fastDecision,
      deep: deepDecision,
    });

    if (deepDecision.q4Source === "emotion_model") state.emotionModelUsedCount += 1;
    if (deepDecision.q5Source === "continuity_model") state.continuityModelUsedCount += 1;
    if (
      (modelRuntime.useEmotionModel && deepDecision.q4Source === "heuristic") ||
      (modelRuntime.useContinuityModel && deepDecision.q5Source === "heuristic")
    ) {
      state.deepGateModelFallbackCount += 1;
    }
    if (
      fastDecision.verdict === "pass" &&
      (deepDecision.verdict === "manual_review" || deepDecision.verdict === "hard_fail") &&
      (decision.verdict === "manual_review" || decision.verdict === "hard_fail")
    ) {
      state.deepGateOverrideCount += 1;
    }
    if (
      isFalsePositiveCandidate({
        fast: fastDecision,
        deep: deepDecision,
        combined: decision,
        thresholds: thresholdTemplate,
      })
    ) {
      state.falsePositiveCandidateCount += 1;
    }

    const calibrationSampleLabel =
      taskContext.calibrationEval.sampleLabelsByAudioFileId[audioFile.id] || null;
    if (calibrationSampleLabel) {
      state.calibrationEvalLabeledCount += 1;
      const exactMatch = calibrationSampleLabel.expectedVerdict === decision.verdict;
      if (exactMatch) state.calibrationEvalExactMatchCount += 1;

      const expectedReviewLike = isReviewLikeVerdict(calibrationSampleLabel.expectedVerdict);
      const actualReviewLike = isReviewLikeVerdict(decision.verdict);
      if (!expectedReviewLike && actualReviewLike) state.calibrationEvalFalsePositiveCount += 1;
      if (expectedReviewLike && !actualReviewLike) state.calibrationEvalFalseNegativeCount += 1;

      const bucketKey = calibrationSampleLabel.issueType || "UNKNOWN";
      const bucket = state.calibrationEvalIssueTypeBreakdown[bucketKey] || {
        total: 0,
        exactMatchCount: 0,
      };
      bucket.total += 1;
      if (exactMatch) bucket.exactMatchCount += 1;
      state.calibrationEvalIssueTypeBreakdown[bucketKey] = bucket;
    }

    await prisma.$transaction(async (tx) => {
      const persistResult = await persistQualityCheckDecision({
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
        thresholdTemplateSource: "runtime",
        q0q3ThresholdTemplate,
        q0q3ThresholdTemplateSource: "runtime",
        modelRuntimeSource,
      });

      state.secondaryDispatchCount += persistResult.secondaryPendingCount;
      state.secondaryDispatchSkippedByThresholdCount +=
        persistResult.secondarySkippedByThresholdCount;
    });

    state.checked += 1;
    if (decision.verdict === "pass") state.passCount += 1;
    else if (decision.verdict === "repair") state.repairCount += 1;
    else if (decision.verdict === "hard_fail") {
      state.hardFailCount += 1;
      state.manualReviewCount += 1;
    } else state.manualReviewCount += 1;

    state.issueTypeCounts[decision.issueType] =
      (state.issueTypeCounts[decision.issueType] || 0) + 1;
    state.q0ScoreSum += decision.q0Score || fastDecision.q0Score || 0;
    state.q1ScoreSum += decision.q1Score;
    state.q2ScoreSum += decision.q2Score;
    state.q3ScoreSum += decision.q3Score;
    if (decision.signalValues?.q2Cer !== null && decision.signalValues?.q2Cer !== undefined) {
      state.q2CerValueSum += decision.signalValues.q2Cer;
      state.q2CerValueCount += 1;
    }
    if (
      decision.signalValues?.q3SpeakerSimilarity !== null &&
      decision.signalValues?.q3SpeakerSimilarity !== undefined
    ) {
      state.q3SpeakerSimilaritySum += decision.signalValues.q3SpeakerSimilarity;
      state.q3SpeakerSimilarityCount += 1;
    }
    updateSignalSourceCount(state.q0q3SignalSourceUsage, "q0", decision.signalSources?.q0);
    updateSignalSourceCount(state.q0q3SignalSourceUsage, "q1", decision.signalSources?.q1);
    updateSignalSourceCount(state.q0q3SignalSourceUsage, "q2", decision.signalSources?.q2);
    updateSignalSourceCount(state.q0q3SignalSourceUsage, "q3", decision.signalSources?.q3);
    state.deepGateCalibrationSamples.push({
      verdict: decision.verdict,
      q4Score: decision.q4Score,
      q5Score: decision.q5Score,
    });

    updateChapterAuditMap({
      chapterAuditMap: state.chapterAuditMap,
      chapterId: audioFile.chapterId,
      voiceProfileId: audioFile.voiceProfileId,
      decision,
    });

    const progress = 20 + Math.round(((index + 1) / audioFiles.length) * 70);
    await updateTaskProgress(
      taskId,
      progress,
      isCalibrationEval
        ? `Deep Gate 校准回放进度 ${index + 1}/${audioFiles.length}`
        : `Fast/Deep Gate 质检进度 ${index + 1}/${audioFiles.length}`
    );
    await onProgress?.({
      checked: index + 1,
      total: audioFiles.length,
      progress,
      verdict: decision.verdict,
      issueType: decision.issueType,
      sentenceId: audioFile.sentenceId,
      audioFileId: audioFile.id,
    });
  }

  return state;
};

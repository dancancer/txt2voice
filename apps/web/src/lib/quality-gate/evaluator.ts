// 一旦我被更新，请更新我的开头注释
// input: Fast Gate 结果、Deep Gate 输入与阈值
// output: Deep Gate 判定与融合结果
// pos: 质量门控判定模块

import {
  CombinedQualityDecision,
  DeepGateDecision,
  DeepGateInput,
  DeepGateModelInference,
  DeepGateThresholdTemplate,
  FastGateSnapshot,
  QualityGateVerdict,
  QualityIssueType,
} from "@/lib/quality-gate/types";

const EMOTION_BASELINE: Record<string, number> = {
  calm: 0.35,
  neutral: 0.45,
  joy: 0.72,
  angry: 0.82,
  sad: 0.28,
  cold: 0.48,
  romantic_arousal: 0.78,
  fear: 0.7,
  surprise: 0.68,
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

const normalizeRoleType = (value: string | null | undefined): string => {
  const normalized = (value || "narration").trim().toLowerCase();
  return normalized || "narration";
};

const normalizeEmotionLabel = (value: string | null | undefined): string => {
  const normalized = (value || "neutral").trim().toLowerCase();
  return normalized || "neutral";
};

const normalizeVoiceProfileId = (value: string | null | undefined): string => {
  const normalized = (value || "").trim();
  return normalized;
};

const buildPunctuationSignal = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const exclamations = (trimmed.match(/[!！]/g) || []).length;
  const questions = (trimmed.match(/[?？]/g) || []).length;
  const ellipsis = (trimmed.match(/[.。…]/g) || []).length;

  const weighted = exclamations * 1.2 + questions * 0.7 + ellipsis * 0.2;
  return clampUnit(weighted / Math.max(trimmed.length * 0.08, 1));
};

const resolveEmotionTargetEnergy = ({
  emotionLabel,
  emotionIntensity,
}: {
  emotionLabel: string;
  emotionIntensity?: number | null;
}): number => {
  const baseline =
    EMOTION_BASELINE[emotionLabel] ??
    EMOTION_BASELINE[emotionLabel.replace(/\s+/g, "_")] ??
    EMOTION_BASELINE.neutral;

  if (emotionIntensity === null || emotionIntensity === undefined) {
    return baseline;
  }

  return clampUnit(0.6 * baseline + 0.4 * clampUnit(emotionIntensity));
};

const buildDeepRepairPlan = (reasons: string[]): string[] => {
  const plans = new Set<string>();

  if (
    reasons.includes("emotion_underexpressed") ||
    reasons.includes("emotion_mismatch") ||
    reasons.includes("emotion_label_shift")
  ) {
    plans.add("increase_emotion_intensity_0.10");
  }

  if (reasons.includes("emotion_overexpressed")) {
    plans.add("decrease_emotion_intensity_0.10");
  }

  if (
    reasons.includes("chapter_pace_drift") ||
    reasons.includes("chapter_pace_drift_high") ||
    reasons.includes("chapter_embedding_drift") ||
    reasons.includes("chapter_embedding_drift_high")
  ) {
    plans.add("align_chapter_pace_profile");
  }

  if (reasons.includes("chapter_context_sparse")) {
    plans.add("expand_chapter_context_then_retry");
  }

  if (plans.size === 0) {
    plans.add("retry_with_same_engine");
  }

  return Array.from(plans);
};

export const evaluateDeepGate = ({
  input,
  thresholds,
  modelInference,
}: {
  input: DeepGateInput;
  thresholds: DeepGateThresholdTemplate;
  modelInference?: DeepGateModelInference;
}): DeepGateDecision => {
  const normalizedEmotion = normalizeEmotionLabel(input.emotionLabel);
  const roleType = normalizeRoleType(input.roleType);
  const voiceProfileId = normalizeVoiceProfileId(input.voiceProfileId);
  const text = input.text || "";

  const paceSignal = clampUnit((input.charsPerSecond - 1.2) / 7.2);
  const punctuationSignal = buildPunctuationSignal(text);
  const observedEmotionEnergy = clampUnit(0.7 * paceSignal + 0.3 * punctuationSignal);
  const expectedEmotionEnergy = resolveEmotionTargetEnergy({
    emotionLabel: normalizedEmotion,
    emotionIntensity: input.emotionIntensity,
  });

  const emotionGap = Math.abs(observedEmotionEnergy - expectedEmotionEnergy);
  let q4Score = clampScore(100 - emotionGap * 115);
  const q4Reasons: string[] = [];

  if (!input.emotionLabel) {
    q4Score = Math.min(q4Score, 82);
    q4Reasons.push("emotion_label_missing");
  }

  if (emotionGap >= 0.52) {
    q4Reasons.push("emotion_mismatch_hard");
  } else if (emotionGap >= 0.3) {
    q4Reasons.push("emotion_mismatch");
  }

  if (expectedEmotionEnergy - observedEmotionEnergy > 0.24) {
    q4Reasons.push("emotion_underexpressed");
  } else if (observedEmotionEnergy - expectedEmotionEnergy > 0.24) {
    q4Reasons.push("emotion_overexpressed");
  }

  const chapterContext = input.chapterContext;
  const chapterSampleCount = chapterContext?.sampleCount || 0;
  const roleBaseline = chapterContext?.roleTypeAverages[roleType];
  const voiceBaseline =
    voiceProfileId && chapterContext
      ? chapterContext.voiceProfileAverages[voiceProfileId]
      : undefined;
  const chapterBaseline = chapterContext?.averageCharsPerSecond;
  const continuityBaseline = voiceBaseline ?? roleBaseline ?? chapterBaseline;

  let q5Score = 86;
  const q5Reasons: string[] = [];
  if (chapterSampleCount < 3 || continuityBaseline === undefined) {
    q5Score = 82;
    q5Reasons.push("chapter_context_sparse");
  } else {
    const continuityGap = Math.abs(input.charsPerSecond - continuityBaseline);
    q5Score = clampScore(100 - continuityGap * 24);
    if (continuityGap >= 2.4) {
      q5Reasons.push("chapter_pace_drift_high");
    } else if (continuityGap >= 1.6) {
      q5Reasons.push("chapter_pace_drift");
    }
  }

  const modelReasons = modelInference?.reasons || [];
  const q4ModelReasons = modelReasons.filter((reason) => reason.startsWith("emotion_"));
  const q5ModelReasons = modelReasons.filter((reason) => reason.startsWith("chapter_"));

  if (modelInference?.q4Score !== undefined) {
    q4Score = clampScore(modelInference.q4Score);
  }
  if (modelInference?.q5Score !== undefined) {
    q5Score = clampScore(modelInference.q5Score);
  }

  const q4Source = modelInference?.q4Source || "heuristic";
  const q5Source = modelInference?.q5Source || "heuristic";
  const reasons = Array.from(
    new Set([...q4Reasons, ...q5Reasons, ...q4ModelReasons, ...q5ModelReasons])
  );

  const score = clampScore(0.58 * q4Score + 0.42 * q5Score);
  const hardFail =
    q4Score <= thresholds.hardFailScore && q5Score <= thresholds.hardFailScore;

  let verdict: QualityGateVerdict = "pass";
  if (hardFail) {
    verdict = "hard_fail";
  } else if (
    q4Score < thresholds.q4ManualReviewScore ||
    q5Score < thresholds.q5ManualReviewScore
  ) {
    verdict = "manual_review";
  } else if (q4Score < thresholds.q4PassScore || q5Score < thresholds.q5PassScore) {
    verdict = "repair";
  }

  const issueType: QualityIssueType = q4Score <= q5Score ? "EMOTION" : "CONTINUITY";

  return {
    verdict,
    hardFail,
    score,
    q4Score,
    q5Score,
    q4Source,
    q5Source,
    reasons,
    repairPlan: buildDeepRepairPlan(reasons),
    issueType,
    modelDiagnostics: modelInference?.diagnostics || {},
  };
};

export const combineQualityGateDecision = ({
  fast,
  deep,
}: {
  fast: FastGateSnapshot;
  deep: DeepGateDecision;
}): CombinedQualityDecision => {
  const q0Score = fast.q0Score ?? 100;
  const hardFail = fast.hardFail || deep.hardFail;
  const score = clampScore(
    0.1 * q0Score +
      0.1 * fast.q1Score +
      0.35 * fast.q2Score +
      0.2 * fast.q3Score +
      0.2 * deep.q4Score +
      0.05 * deep.q5Score
  );

  let verdict: QualityGateVerdict = "pass";
  if (hardFail) {
    verdict = "hard_fail";
  } else if (
    q0Score < 60 ||
    fast.verdict === "manual_review" ||
    deep.verdict === "manual_review"
  ) {
    verdict = "manual_review";
  } else if (score < 85 || fast.verdict === "repair" || deep.verdict === "repair") {
    verdict = "repair";
  }

  if (verdict === "repair" && score < 70) {
    verdict = "manual_review";
  }

  const fastIssueType = fast.issueType || "FAST_GATE";
  let issueType: QualityIssueType = "FAST_GATE";
  if (
    fast.verdict === "manual_review" ||
    fast.verdict === "hard_fail" ||
    fast.hardFail ||
    q0Score < 60
  ) {
    issueType = fastIssueType;
  } else if (deep.verdict === "manual_review" || deep.verdict === "repair") {
    issueType = deep.issueType;
  } else if (fast.verdict === "repair") {
    issueType = fastIssueType;
  }

  const reasons = Array.from(new Set([...fast.reasons, ...deep.reasons]));
  const repairPlan = Array.from(new Set([...fast.repairPlan, ...deep.repairPlan]));

  return {
    verdict,
    hardFail,
    score,
    q0Score,
    q1Score: fast.q1Score,
    q2Score: fast.q2Score,
    q3Score: fast.q3Score,
    q4Score: deep.q4Score,
    q5Score: deep.q5Score,
    q4Source: deep.q4Source,
    q5Source: deep.q5Source,
    fastGateScore: fast.score,
    deepGateScore: deep.score,
    charsPerSecond: fast.charsPerSecond,
    reasons,
    repairPlan,
    issueType,
    primarySignal: fast.primarySignal,
    signalSources: fast.signalSources,
    signalValues: fast.signalValues,
  };
};

export const isFalsePositiveCandidate = ({
  fast,
  deep,
  combined,
  thresholds,
}: {
  fast: FastGateSnapshot;
  deep: DeepGateDecision;
  combined: CombinedQualityDecision;
  thresholds: DeepGateThresholdTemplate;
}): boolean => {
  if (combined.verdict !== "manual_review") {
    return false;
  }

  if (fast.verdict !== "pass" && fast.verdict !== "repair") {
    return false;
  }

  const boundary = Math.min(
    thresholds.q4ManualReviewScore,
    thresholds.q5ManualReviewScore
  );

  return Math.abs(deep.score - boundary) <= thresholds.falsePositiveDelta;
};

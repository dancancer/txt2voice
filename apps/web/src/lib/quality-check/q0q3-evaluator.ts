import type { QualityGateVerdict, QualityIssueType } from "@/lib/quality-gate/types";
import type {
  EvaluateQ0Q3Input,
  FastSignalSource,
  Q0Q3EvaluationResult,
  SignalProvider,
} from "@/lib/quality-check/q0q3-types";

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
};

const normalizeRoleType = (value: string | null | undefined): string => {
  const normalized = (value || "narration").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "narration";
};

const normalizePriority = (value: string | null | undefined): string => {
  const normalized = (value || "normal").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "normal";
};

const scoreFromLowerIsBetter = ({
  value,
  pass,
  manual,
  hardFail,
}: {
  value: number;
  pass: number;
  manual: number;
  hardFail: number;
}): number => {
  if (value <= pass) {
    const ratio = pass <= 0 ? 0 : Math.max(0, Math.min(1, (pass - value) / pass));
    return clampScore(90 + ratio * 8);
  }
  if (value <= manual) {
    return clampScore(90 - ((value - pass) / Math.max(manual - pass, 0.0001)) * 22);
  }
  if (value <= hardFail) {
    return clampScore(68 - ((value - manual) / Math.max(hardFail - manual, 0.0001)) * 33);
  }
  return clampScore(35 - Math.min((value - hardFail) * 180, 30));
};

const scoreFromHigherIsBetter = ({
  value,
  pass,
  manual,
  hardFail,
}: {
  value: number;
  pass: number;
  manual: number;
  hardFail: number;
}): number => {
  if (value >= pass) {
    const ratio = Math.min(1, (value - pass) / Math.max(1 - pass, 0.0001));
    return clampScore(90 + ratio * 8);
  }
  if (value >= manual) {
    return clampScore(90 - ((pass - value) / Math.max(pass - manual, 0.0001)) * 22);
  }
  if (value >= hardFail) {
    return clampScore(68 - ((manual - value) / Math.max(manual - hardFail, 0.0001)) * 33);
  }
  return clampScore(35 - Math.min((hardFail - value) * 180, 30));
};

const resolveSignalSource = ({
  providers,
  hasAttempt,
  hasPayload,
}: {
  providers: SignalProvider[];
  hasAttempt: boolean;
  hasPayload: boolean;
}): FastSignalSource => {
  const hasHeuristic = providers.includes("heuristic");
  const canUseAttempt = providers.includes("attempt_metrics") && hasAttempt;
  const canUsePayload = providers.includes("task_payload") && hasPayload;

  if ((canUseAttempt || canUsePayload) && hasHeuristic) return "mixed";
  if (canUseAttempt) return "attempt_metrics";
  if (canUsePayload) return "task_payload";
  if (hasHeuristic) return "heuristic";
  return "disabled";
};

export const evaluateQ0Q3Signals = ({
  text,
  roleType,
  priority,
  emotionIntensity,
  durationSeconds,
  hasVoiceProfile,
  rawSignals,
  signalSources,
  thresholds,
}: EvaluateQ0Q3Input): Q0Q3EvaluationResult => {
  const normalizedText = text.trim();
  const normalizedRoleType = normalizeRoleType(roleType);
  const normalizedPriority = normalizePriority(priority);
  const isDialogue = normalizedRoleType === "dialogue" || normalizedRoleType === "monologue";
  const textLength = normalizedText.length;
  const safeDuration = Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const charsPerSecond =
    safeDuration > 0 ? Number((textLength / Math.max(safeDuration, 0.0001)).toFixed(4)) : 0;

  const reasons: string[] = [];
  let hardFail = false;
  let q0Score = 94;

  if (textLength === 0) {
    q0Score = 0;
    reasons.push("precheck_empty_text");
    hardFail = true;
  } else {
    if (textLength > thresholds.q0MaxTextLength) {
      q0Score = Math.min(q0Score, 56);
      reasons.push("precheck_sentence_too_long");
    }
    if (/\d{1,4}(?:[:：]\d{1,2})?/.test(normalizedText)) {
      q0Score = Math.min(q0Score, 72);
      reasons.push("precheck_numeric_normalization_needed");
    }
    if (/[A-Za-z]{4,}/.test(normalizedText)) {
      q0Score = Math.min(q0Score, 74);
      reasons.push("precheck_foreign_token_detected");
    }
  }

  let q1Score = 92;
  if (safeDuration <= 0) {
    q1Score = 0;
    reasons.push("invalid_duration");
    hardFail = true;
  } else if (safeDuration < 0.25) {
    q1Score = 35;
    reasons.push("duration_too_short");
  } else if (safeDuration > 45) {
    q1Score = 65;
    reasons.push("duration_too_long");
  }
  if (charsPerSecond > thresholds.q1HardFailCharsPerSecond) {
    q1Score = Math.min(q1Score, 30);
    reasons.push("pace_too_fast_hard_fail");
    hardFail = true;
  } else if (charsPerSecond > 8.5) {
    q1Score = Math.min(q1Score, 62);
    reasons.push("pace_too_fast");
  } else if (charsPerSecond < 1.1 && safeDuration > 0) {
    q1Score = Math.min(q1Score, 55);
    reasons.push("pace_too_slow");
  }
  if (rawSignals.clipping === true) {
    q1Score = Math.min(q1Score, 20);
    reasons.push("audio_clipping_detected");
    hardFail = true;
  }
  if (
    rawSignals.leadingSilenceMs !== null &&
    rawSignals.leadingSilenceMs > thresholds.q1LeadingSilenceMsMax
  ) {
    q1Score = Math.min(q1Score, 68);
    reasons.push("leading_silence_too_long");
  }
  if (
    rawSignals.trailingSilenceMs !== null &&
    rawSignals.trailingSilenceMs > thresholds.q1TrailingSilenceMsMax
  ) {
    q1Score = Math.min(q1Score, 66);
    reasons.push("trailing_silence_too_long");
  }
  if (rawSignals.lufs !== null) {
    const lufsGap = Math.abs(rawSignals.lufs - thresholds.q1LufsTarget);
    if (lufsGap > thresholds.q1LufsTolerance * 2) {
      q1Score = Math.min(q1Score, 62);
      reasons.push("loudness_out_of_range");
    }
  }

  const cerPassThreshold =
    isDialogue
      ? normalizedPriority === "high" || (emotionIntensity || 0) >= 0.75
        ? thresholds.q2CerHighEmotionPass
        : thresholds.q2CerDialoguePass
      : thresholds.q2CerNarrationPass;
  const cerManualThreshold = cerPassThreshold + thresholds.q2CerManualReviewDelta;
  const estimatedCerFromHeuristic = clampUnit(
    0.02 +
      Math.max(0, charsPerSecond - 5.5) * 0.015 +
      (hasVoiceProfile ? 0 : 0.015) +
      (textLength <= 4 ? 0.02 : 0)
  );
  const cerSource = resolveSignalSource({
    providers: signalSources.q2,
    hasAttempt: rawSignals.cer !== null,
    hasPayload: rawSignals.cer !== null,
  });
  const q2Cer =
    cerSource === "disabled"
      ? null
      : cerSource === "heuristic"
        ? estimatedCerFromHeuristic
        : cerSource === "attempt_metrics" || cerSource === "task_payload"
          ? clampUnit(rawSignals.cer || 0)
          : clampUnit((rawSignals.cer || estimatedCerFromHeuristic) * 0.72 + estimatedCerFromHeuristic * 0.28);
  if (q2Cer === null) reasons.push("cer_signal_disabled");
  const q2Score =
    q2Cer === null
      ? 78
      : scoreFromLowerIsBetter({
          value: q2Cer,
          pass: cerPassThreshold,
          manual: cerManualThreshold,
          hardFail: thresholds.q2CerHardFail,
        });
  if (q2Cer !== null) {
    if (q2Cer > thresholds.q2CerHardFail) {
      reasons.push("cer_hard_fail");
      hardFail = true;
    } else if (q2Cer > cerManualThreshold) reasons.push("cer_too_high");
    else if (q2Cer > cerPassThreshold) reasons.push("cer_above_pass_threshold");
  }

  const speakerPassThreshold =
    isDialogue || normalizedPriority === "high"
      ? thresholds.q3SpeakerLeadPass
      : thresholds.q3SpeakerSupportPass;
  const speakerManualThreshold = speakerPassThreshold - thresholds.q3SpeakerManualReviewGap;
  const heuristicSpeakerSimilarity = clampUnit(
    (hasVoiceProfile ? 0.84 : 0.74) -
      Math.max(0, charsPerSecond - 8) * 0.02 -
      (normalizedPriority === "high" ? 0.02 : 0)
  );
  const speakerSource = resolveSignalSource({
    providers: signalSources.q3,
    hasAttempt: rawSignals.speakerSimilarity !== null,
    hasPayload: rawSignals.speakerSimilarity !== null,
  });
  const q3SpeakerSimilarity =
    speakerSource === "disabled"
      ? null
      : speakerSource === "heuristic"
        ? heuristicSpeakerSimilarity
        : speakerSource === "attempt_metrics" || speakerSource === "task_payload"
          ? clampUnit(rawSignals.speakerSimilarity || 0)
          : clampUnit(
              (rawSignals.speakerSimilarity || heuristicSpeakerSimilarity) * 0.75 +
                heuristicSpeakerSimilarity * 0.25
            );
  if (q3SpeakerSimilarity === null) reasons.push("speaker_signal_disabled");
  if (!hasVoiceProfile) {
    reasons.push(isDialogue ? "voice_profile_missing_for_dialogue" : "voice_profile_missing");
  }

  let q3Score =
    q3SpeakerSimilarity === null
      ? hasVoiceProfile
        ? 84
        : 62
      : scoreFromHigherIsBetter({
          value: q3SpeakerSimilarity,
          pass: speakerPassThreshold,
          manual: speakerManualThreshold,
          hardFail: thresholds.q3SpeakerHardFail,
        });
  if (isDialogue && !hasVoiceProfile) q3Score = Math.min(q3Score, 45);
  if (q3SpeakerSimilarity !== null) {
    if (q3SpeakerSimilarity < thresholds.q3SpeakerHardFail) {
      reasons.push("speaker_similarity_hard_fail");
      hardFail = true;
    } else if (q3SpeakerSimilarity < speakerManualThreshold) {
      reasons.push("speaker_similarity_too_low");
    } else if (q3SpeakerSimilarity < speakerPassThreshold) {
      reasons.push("speaker_similarity_below_pass_threshold");
    }
  }

  const score = clampScore(0.15 * q0Score + 0.2 * q1Score + 0.35 * q2Score + 0.3 * q3Score);
  let verdict: QualityGateVerdict = "pass";
  if (hardFail) verdict = "hard_fail";
  else if (score < thresholds.fastManualReviewScore || q0Score < thresholds.q0ManualReviewScore) {
    verdict = "manual_review";
  } else if (
    score < thresholds.fastPassScore ||
    q0Score < thresholds.q0PassScore ||
    q1Score < thresholds.q1PassScore
  ) {
    verdict = "repair";
  }
  if (isDialogue && !hasVoiceProfile && verdict === "repair") {
    verdict = "manual_review";
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const issueType: QualityIssueType = uniqueReasons.some((reason) => reason.startsWith("cer_"))
    ? "CER"
    : uniqueReasons.some((reason) => reason.startsWith("speaker_"))
      ? "SPEAKER"
      : uniqueReasons.some((reason) =>
            [
              "invalid_duration",
              "duration_too_short",
              "duration_too_long",
              "pace_too_fast",
              "pace_too_fast_hard_fail",
              "pace_too_slow",
              "audio_clipping_detected",
              "leading_silence_too_long",
              "trailing_silence_too_long",
              "loudness_out_of_range",
            ].includes(reason)
          )
        ? "AUDIO"
        : "FAST_GATE";

  return {
    verdict,
    hardFail,
    score,
    q0Score,
    q1Score,
    q2Score,
    q3Score,
    charsPerSecond,
    reasons: uniqueReasons,
    issueType,
    primarySignal:
      issueType === "CER"
        ? "q2_cer"
        : issueType === "SPEAKER"
          ? "q3_speaker"
          : issueType === "AUDIO"
            ? "q1_audio"
            : "q0_precheck",
    signalSources: {
      q0: "heuristic",
      q1: resolveSignalSource({
        providers: signalSources.q1,
        hasAttempt:
          rawSignals.clipping !== null ||
          rawSignals.leadingSilenceMs !== null ||
          rawSignals.trailingSilenceMs !== null ||
          rawSignals.lufs !== null,
        hasPayload: false,
      }),
      q2: cerSource,
      q3: speakerSource,
    },
    signalValues: {
      q0PrecheckRisk: clampUnit((100 - q0Score) / 100),
      q2Cer,
      q3SpeakerSimilarity,
      q1Clipping: rawSignals.clipping,
      q1LeadingSilenceMs: rawSignals.leadingSilenceMs,
      q1TrailingSilenceMs: rawSignals.trailingSilenceMs,
      q1Lufs: rawSignals.lufs,
    },
  };
};

import {
  evaluateQ0Q3Signals,
  resolveQ0Q3SignalSources,
  resolveQ0Q3ThresholdTemplate,
} from "@/lib/quality-check/q0q3-runtime";
import type { FastGateSnapshot } from "@/lib/quality-gate";
import type { FastGateInput, FastGateVerdict } from "@/lib/quality-check/shared-types";

type FastGateDecision = FastGateSnapshot;

const buildRepairPlan = (reasons: string[]): string[] => {
  const plans: string[] = [];

  if (reasons.includes("duration_too_short") || reasons.includes("pace_too_fast")) {
    plans.push("decrease_speed_0.05");
  }
  if (reasons.includes("duration_too_long") || reasons.includes("pace_too_slow")) {
    plans.push("increase_speed_0.05");
  }
  if (reasons.includes("voice_profile_missing_for_dialogue")) {
    plans.push("bind_voice_profile_then_retry");
  }
  if (reasons.includes("invalid_duration")) {
    plans.push("regenerate_audio_with_same_params");
  }
  if (reasons.includes("emotion_underexpressed")) {
    plans.push("increase_emotion_intensity_0.10");
  }
  if (reasons.includes("emotion_overexpressed")) {
    plans.push("decrease_emotion_intensity_0.10");
  }
  if (reasons.includes("chapter_pace_drift") || reasons.includes("chapter_pace_drift_high")) {
    plans.push("align_chapter_pace_profile");
  }
  if (
    reasons.includes("cer_too_high") ||
    reasons.includes("cer_above_pass_threshold") ||
    reasons.includes("cer_hard_fail")
  ) {
    plans.push("rerun_asr_alignment_then_retry");
    plans.push("decrease_speed_0.05");
  }
  if (
    reasons.includes("speaker_similarity_too_low") ||
    reasons.includes("speaker_similarity_below_pass_threshold") ||
    reasons.includes("speaker_similarity_hard_fail")
  ) {
    plans.push("lock_voice_profile_and_seed");
    plans.push("increase_reference_audio_weight");
  }
  if (
    reasons.includes("precheck_sentence_too_long") ||
    reasons.includes("precheck_numeric_normalization_needed") ||
    reasons.includes("precheck_foreign_token_detected")
  ) {
    plans.push("normalize_text_before_tts");
  }
  if (plans.length === 0) {
    plans.push("retry_with_same_engine");
  }

  return plans;
};

export const evaluateFastGate = ({
  text,
  roleType,
  priority,
  emotionIntensity,
  durationSeconds,
  hasVoiceProfile,
  rawSignals,
  signalSources,
  thresholds,
}: FastGateInput): FastGateDecision => {
  const decision = evaluateQ0Q3Signals({
    text,
    roleType,
    priority,
    emotionIntensity,
    durationSeconds,
    hasVoiceProfile,
    rawSignals: rawSignals || {
      cer: null,
      speakerSimilarity: null,
      clipping: null,
      leadingSilenceMs: null,
      trailingSilenceMs: null,
      lufs: null,
    },
    signalSources:
      signalSources ||
      resolveQ0Q3SignalSources({
        taskMetadata: null,
        bookMetadata: null,
      }).config,
    thresholds:
      thresholds ||
      resolveQ0Q3ThresholdTemplate({
        taskMetadata: null,
        bookMetadata: null,
      }).template,
  });

  return {
    ...decision,
    repairPlan: buildRepairPlan(decision.reasons),
  };
};

export const resolveReprocessingStatusFromVerdict = (
  verdict: FastGateVerdict
): { status: "resolved" | "rejected"; resolutionType: string } => {
  if (verdict === "pass" || verdict === "repair") {
    return {
      status: "resolved",
      resolutionType: "fixed",
    };
  }

  return {
    status: "rejected",
    resolutionType: "auto_recovery_exhausted",
  };
};

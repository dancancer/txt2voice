// 一旦我被更新，请更新我的开头注释
// input: 任务 metadata/音频信号/句子上下文
// output: Q0-Q3 运行时配置与快检结果
// pos: Fast Gate 指标化模块

import type { QualityGateVerdict, QualityIssueType } from "@/lib/quality-gate/types";

export type FastSignalSource =
  | "heuristic"
  | "attempt_metrics"
  | "task_payload"
  | "mixed"
  | "disabled";

type MetadataSource = "default" | "book_metadata" | "task_override";

type SignalProvider = "heuristic" | "attempt_metrics" | "task_payload";

interface Q0Q3ProviderConfig {
  q0: SignalProvider[];
  q1: SignalProvider[];
  q2: SignalProvider[];
  q3: SignalProvider[];
}

export interface Q0Q3SignalSourceResolution {
  config: Q0Q3ProviderConfig;
  source: MetadataSource;
}

export interface Q0Q3ThresholdTemplate {
  q0PassScore: number;
  q0ManualReviewScore: number;
  q0MaxTextLength: number;
  q1PassScore: number;
  q1ManualReviewScore: number;
  q1HardFailCharsPerSecond: number;
  q1LeadingSilenceMsMax: number;
  q1TrailingSilenceMsMax: number;
  q1LufsTarget: number;
  q1LufsTolerance: number;
  q2CerNarrationPass: number;
  q2CerDialoguePass: number;
  q2CerHighEmotionPass: number;
  q2CerManualReviewDelta: number;
  q2CerHardFail: number;
  q3SpeakerLeadPass: number;
  q3SpeakerSupportPass: number;
  q3SpeakerManualReviewGap: number;
  q3SpeakerHardFail: number;
  fastPassScore: number;
  fastManualReviewScore: number;
}

export interface Q0Q3ThresholdResolution {
  template: Q0Q3ThresholdTemplate;
  source: MetadataSource;
}

export interface Q0Q3RawSignals {
  cer: number | null;
  speakerSimilarity: number | null;
  clipping: boolean | null;
  leadingSilenceMs: number | null;
  trailingSilenceMs: number | null;
  lufs: number | null;
}

export interface EvaluateQ0Q3Input {
  text: string;
  roleType?: string | null;
  priority?: string | null;
  emotionIntensity?: number | null;
  durationSeconds: number;
  hasVoiceProfile: boolean;
  rawSignals: Q0Q3RawSignals;
  signalSources: Q0Q3ProviderConfig;
  thresholds: Q0Q3ThresholdTemplate;
}

export interface Q0Q3EvaluationResult {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q0Score: number;
  q1Score: number;
  q2Score: number;
  q3Score: number;
  charsPerSecond: number;
  reasons: string[];
  issueType: QualityIssueType;
  primarySignal: "q0_precheck" | "q1_audio" | "q2_cer" | "q3_speaker";
  signalSources: {
    q0: FastSignalSource;
    q1: FastSignalSource;
    q2: FastSignalSource;
    q3: FastSignalSource;
  };
  signalValues: {
    q0PrecheckRisk: number;
    q2Cer: number | null;
    q3SpeakerSimilarity: number | null;
    q1Clipping: boolean | null;
    q1LeadingSilenceMs: number | null;
    q1TrailingSilenceMs: number | null;
    q1Lufs: number | null;
  };
}

const DEFAULT_SIGNAL_SOURCES: Q0Q3ProviderConfig = {
  q0: ["heuristic"],
  q1: ["attempt_metrics", "heuristic"],
  q2: ["attempt_metrics", "task_payload", "heuristic"],
  q3: ["attempt_metrics", "task_payload", "heuristic"],
};

export const DEFAULT_Q0Q3_THRESHOLD_TEMPLATE: Q0Q3ThresholdTemplate = {
  q0PassScore: 84,
  q0ManualReviewScore: 62,
  q0MaxTextLength: 220,
  q1PassScore: 82,
  q1ManualReviewScore: 64,
  q1HardFailCharsPerSecond: 12,
  q1LeadingSilenceMsMax: 120,
  q1TrailingSilenceMsMax: 250,
  q1LufsTarget: -19,
  q1LufsTolerance: 1,
  q2CerNarrationPass: 0.05,
  q2CerDialoguePass: 0.08,
  q2CerHighEmotionPass: 0.1,
  q2CerManualReviewDelta: 0.03,
  q2CerHardFail: 0.12,
  q3SpeakerLeadPass: 0.82,
  q3SpeakerSupportPass: 0.76,
  q3SpeakerManualReviewGap: 0.06,
  q3SpeakerHardFail: 0.7,
  fastPassScore: 85,
  fastManualReviewScore: 70,
};

const SIGNAL_PROVIDER_SET = new Set<SignalProvider>([
  "heuristic",
  "attempt_metrics",
  "task_payload",
]);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
};

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

const resolveProviders = (
  value: unknown,
  defaults: SignalProvider[]
): SignalProvider[] => {
  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => asString(entry)?.toLowerCase())
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => {
        if (entry === "metrics") {
          return "attempt_metrics";
        }
        if (entry === "payload") {
          return "task_payload";
        }
        return entry;
      })
      .filter((entry): entry is SignalProvider => SIGNAL_PROVIDER_SET.has(entry as SignalProvider));

    const deduped = Array.from(new Set(parsed));
    return deduped.length > 0 ? deduped : defaults;
  }

  if (typeof value === "string") {
    const normalized = value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        if (entry === "metrics") {
          return "attempt_metrics";
        }
        if (entry === "payload") {
          return "task_payload";
        }
        return entry;
      })
      .filter((entry): entry is SignalProvider => SIGNAL_PROVIDER_SET.has(entry as SignalProvider));
    const deduped = Array.from(new Set(normalized));
    return deduped.length > 0 ? deduped : defaults;
  }

  return defaults;
};

const parseSignalSourceConfig = (value: unknown): Q0Q3ProviderConfig | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value) || typeof value === "string") {
    const providers = resolveProviders(value, DEFAULT_SIGNAL_SOURCES.q2);
    return {
      q0: [...DEFAULT_SIGNAL_SOURCES.q0],
      q1: [...DEFAULT_SIGNAL_SOURCES.q1],
      q2: providers,
      q3: providers,
    };
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const q2Source = record.q2 || record.cer || record.text || record.q2Cer;
  const q3Source = record.q3 || record.speaker || record.q3Speaker;

  return {
    q0: resolveProviders(record.q0, DEFAULT_SIGNAL_SOURCES.q0),
    q1: resolveProviders(record.q1, DEFAULT_SIGNAL_SOURCES.q1),
    q2: resolveProviders(q2Source, DEFAULT_SIGNAL_SOURCES.q2),
    q3: resolveProviders(q3Source, DEFAULT_SIGNAL_SOURCES.q3),
  };
};

const parseThresholdTemplate = (value: unknown): Partial<Q0Q3ThresholdTemplate> | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const maybeNumber = (key: string): number | undefined => {
    const parsed = asNumber(record[key]);
    return parsed === null ? undefined : parsed;
  };

  return {
    q0PassScore: maybeNumber("q0PassScore"),
    q0ManualReviewScore: maybeNumber("q0ManualReviewScore"),
    q0MaxTextLength: maybeNumber("q0MaxTextLength"),
    q1PassScore: maybeNumber("q1PassScore"),
    q1ManualReviewScore: maybeNumber("q1ManualReviewScore"),
    q1HardFailCharsPerSecond: maybeNumber("q1HardFailCharsPerSecond"),
    q1LeadingSilenceMsMax: maybeNumber("q1LeadingSilenceMsMax"),
    q1TrailingSilenceMsMax: maybeNumber("q1TrailingSilenceMsMax"),
    q1LufsTarget: maybeNumber("q1LufsTarget"),
    q1LufsTolerance: maybeNumber("q1LufsTolerance"),
    q2CerNarrationPass: maybeNumber("q2CerNarrationPass"),
    q2CerDialoguePass: maybeNumber("q2CerDialoguePass"),
    q2CerHighEmotionPass: maybeNumber("q2CerHighEmotionPass"),
    q2CerManualReviewDelta: maybeNumber("q2CerManualReviewDelta"),
    q2CerHardFail: maybeNumber("q2CerHardFail"),
    q3SpeakerLeadPass: maybeNumber("q3SpeakerLeadPass"),
    q3SpeakerSupportPass: maybeNumber("q3SpeakerSupportPass"),
    q3SpeakerManualReviewGap: maybeNumber("q3SpeakerManualReviewGap"),
    q3SpeakerHardFail: maybeNumber("q3SpeakerHardFail"),
    fastPassScore: maybeNumber("fastPassScore"),
    fastManualReviewScore: maybeNumber("fastManualReviewScore"),
  };
};

const mergeThresholdTemplate = (
  base: Q0Q3ThresholdTemplate,
  override: Partial<Q0Q3ThresholdTemplate> | null
): Q0Q3ThresholdTemplate => {
  if (!override) {
    return base;
  }

  const merged: Q0Q3ThresholdTemplate = {
    ...base,
  };

  for (const key of Object.keys(override) as Array<keyof Q0Q3ThresholdTemplate>) {
    const value = override[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      merged[key] = value;
    }
  }

  return merged;
};

const readQualityCheckMetadata = (metadata: unknown): Record<string, unknown> => {
  const root = asRecord(metadata);
  const qualityCheck = asRecord(root?.qualityCheck);
  return qualityCheck || {};
};

export const resolveQ0Q3SignalSources = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata?: Record<string, unknown> | null;
  bookMetadata?: unknown;
}): Q0Q3SignalSourceResolution => {
  const qualityCheckMetadata = readQualityCheckMetadata(bookMetadata);
  const bookConfig = parseSignalSourceConfig(
    qualityCheckMetadata.signalSources || qualityCheckMetadata.q0q3SignalSources
  );
  const taskConfig = parseSignalSourceConfig(
    taskMetadata?.signalSources || taskMetadata?.q0q3SignalSources
  );

  if (taskConfig) {
    return {
      config: taskConfig,
      source: "task_override",
    };
  }

  if (bookConfig) {
    return {
      config: bookConfig,
      source: "book_metadata",
    };
  }

  return {
    config: { ...DEFAULT_SIGNAL_SOURCES },
    source: "default",
  };
};

export const resolveQ0Q3ThresholdTemplate = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata?: Record<string, unknown> | null;
  bookMetadata?: unknown;
}): Q0Q3ThresholdResolution => {
  const qualityCheckMetadata = readQualityCheckMetadata(bookMetadata);
  const bookTemplate = parseThresholdTemplate(
    qualityCheckMetadata.q0q3Thresholds || qualityCheckMetadata.fastGateThresholds
  );
  const taskTemplate = parseThresholdTemplate(
    taskMetadata?.q0q3Thresholds || taskMetadata?.fastGateThresholds
  );

  const mergedBook = mergeThresholdTemplate(DEFAULT_Q0Q3_THRESHOLD_TEMPLATE, bookTemplate);
  const mergedTask = mergeThresholdTemplate(mergedBook, taskTemplate);

  return {
    template: mergedTask,
    source: taskTemplate ? "task_override" : bookTemplate ? "book_metadata" : "default",
  };
};

const pickNumber = (record: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const pickBoolean = (record: Record<string, unknown>, keys: string[]): boolean | null => {
  for (const key of keys) {
    const value = asBoolean(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const readSignalPayloadOverride = ({
  taskMetadata,
  audioFileId,
  sentenceId,
}: {
  taskMetadata: Record<string, unknown> | null | undefined;
  audioFileId: string;
  sentenceId: string | null;
}): Record<string, unknown> => {
  const root = asRecord(taskMetadata?.signalPayloadByAudioFileId || taskMetadata?.signalPayload);
  const audioPayload = asRecord(root?.[audioFileId]);
  if (audioPayload) {
    return audioPayload;
  }

  if (sentenceId) {
    const sentenceRoot = asRecord(taskMetadata?.signalPayloadBySentenceId || root?.bySentenceId);
    const sentencePayload = asRecord(sentenceRoot?.[sentenceId]);
    if (sentencePayload) {
      return sentencePayload;
    }
  }

  return {};
};

export const extractQ0Q3RawSignals = ({
  attemptMetrics,
  taskMetadata,
  audioFileId,
  sentenceId,
}: {
  attemptMetrics: unknown;
  taskMetadata?: Record<string, unknown> | null;
  audioFileId: string;
  sentenceId: string | null;
}): Q0Q3RawSignals => {
  const attemptRecord = asRecord(attemptMetrics) || {};
  const payloadRecord = readSignalPayloadOverride({ taskMetadata, audioFileId, sentenceId });
  const mergedRecord = {
    ...attemptRecord,
    ...payloadRecord,
  };

  return {
    cer: pickNumber(mergedRecord, ["cer", "asrCer", "textCer", "q2Cer"]),
    speakerSimilarity: pickNumber(mergedRecord, [
      "speakerSimilarity",
      "speakerEmbeddingSimilarity",
      "voiceprintSimilarity",
      "q3SpeakerSimilarity",
    ]),
    clipping: pickBoolean(mergedRecord, ["clipping", "hasClipping", "clipDetected"]),
    leadingSilenceMs: pickNumber(mergedRecord, ["leadingSilenceMs", "preSilenceMs", "startSilenceMs"]),
    trailingSilenceMs: pickNumber(mergedRecord, ["trailingSilenceMs", "tailSilenceMs", "endSilenceMs"]),
    lufs: pickNumber(mergedRecord, ["lufs", "integratedLufs", "loudnessLufs"]),
  };
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
    const ratio = (value - pass) / Math.max(manual - pass, 0.0001);
    return clampScore(90 - ratio * 22);
  }

  if (value <= hardFail) {
    const ratio = (value - manual) / Math.max(hardFail - manual, 0.0001);
    return clampScore(68 - ratio * 33);
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
    const ratio = (pass - value) / Math.max(pass - manual, 0.0001);
    return clampScore(90 - ratio * 22);
  }

  if (value >= hardFail) {
    const ratio = (manual - value) / Math.max(manual - hardFail, 0.0001);
    return clampScore(68 - ratio * 33);
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

  if ((canUseAttempt || canUsePayload) && hasHeuristic) {
    return "mixed";
  }
  if (canUseAttempt) {
    return "attempt_metrics";
  }
  if (canUsePayload) {
    return "task_payload";
  }
  if (hasHeuristic) {
    return "heuristic";
  }
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
  const isDialogue =
    normalizedRoleType === "dialogue" || normalizedRoleType === "monologue";
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
  const hasCerAttempt = rawSignals.cer !== null;
  const cerSource = resolveSignalSource({
    providers: signalSources.q2,
    hasAttempt: hasCerAttempt,
    hasPayload: hasCerAttempt,
  });
  const q2Cer =
    cerSource === "disabled"
      ? null
      : cerSource === "heuristic"
        ? estimatedCerFromHeuristic
        : cerSource === "attempt_metrics" || cerSource === "task_payload"
          ? clampUnit(rawSignals.cer || 0)
          : clampUnit((rawSignals.cer || estimatedCerFromHeuristic) * 0.72 + estimatedCerFromHeuristic * 0.28);

  if (q2Cer === null) {
    reasons.push("cer_signal_disabled");
  }

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
    } else if (q2Cer > cerManualThreshold) {
      reasons.push("cer_too_high");
    } else if (q2Cer > cerPassThreshold) {
      reasons.push("cer_above_pass_threshold");
    }
  }

  const speakerPassThreshold =
    isDialogue || normalizedPriority === "high"
      ? thresholds.q3SpeakerLeadPass
      : thresholds.q3SpeakerSupportPass;
  const speakerManualThreshold =
    speakerPassThreshold - thresholds.q3SpeakerManualReviewGap;

  const heuristicSpeakerSimilarity = clampUnit(
    (hasVoiceProfile ? 0.84 : 0.74) -
      Math.max(0, charsPerSecond - 8) * 0.02 -
      (normalizedPriority === "high" ? 0.02 : 0)
  );

  const hasSpeakerAttempt = rawSignals.speakerSimilarity !== null;
  const speakerSource = resolveSignalSource({
    providers: signalSources.q3,
    hasAttempt: hasSpeakerAttempt,
    hasPayload: hasSpeakerAttempt,
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

  if (q3SpeakerSimilarity === null) {
    reasons.push("speaker_signal_disabled");
  }

  if (!hasVoiceProfile) {
    reasons.push(
      isDialogue ? "voice_profile_missing_for_dialogue" : "voice_profile_missing"
    );
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

  if (isDialogue && !hasVoiceProfile) {
    q3Score = Math.min(q3Score, 45);
  }

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
  if (hardFail) {
    verdict = "hard_fail";
  } else if (score < thresholds.fastManualReviewScore || q0Score < thresholds.q0ManualReviewScore) {
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

  const primarySignal =
    issueType === "CER"
      ? "q2_cer"
      : issueType === "SPEAKER"
        ? "q3_speaker"
        : issueType === "AUDIO"
          ? "q1_audio"
          : "q0_precheck";

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
    primarySignal,
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

import type { Q0Q3RawSignals } from "@/lib/quality-check/q0q3-types";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
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

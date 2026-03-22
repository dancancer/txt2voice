import { TTSError } from "./error-handler";

const AUDIO_JOB_ERROR_KIND = "txt2voice_audio_job_error";

export interface SerializedAudioJobError {
  kind: typeof AUDIO_JOB_ERROR_KIND;
  message: string;
  code: "TTS_SERVICE_DOWN" | "TTS_SYNTHESIS_FAILED";
  provider: string;
  retryable: boolean;
  attempt: number;
  retriesUsed: number;
}

export const serializeAudioJobError = (
  error: unknown,
  params: {
    provider: string;
    attempt: number;
    retriesUsed: number;
  }
): string => {
  const payload: SerializedAudioJobError = {
    kind: AUDIO_JOB_ERROR_KIND,
    message: error instanceof Error ? error.message : "Audio synthesis job failed",
    code:
      error instanceof TTSError && error.code === "TTS_SYNTHESIS_FAILED"
        ? "TTS_SYNTHESIS_FAILED"
        : "TTS_SERVICE_DOWN",
    provider: params.provider,
    retryable: error instanceof TTSError ? error.retryable : true,
    attempt: params.attempt,
    retriesUsed: params.retriesUsed,
  };

  return JSON.stringify(payload);
};

export const deserializeAudioJobError = (
  value: unknown
): SerializedAudioJobError | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as SerializedAudioJobError;
    if (parsed.kind !== AUDIO_JOB_ERROR_KIND) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const toAudioJobError = (value: unknown): Error => {
  const payload = deserializeAudioJobError(value);
  if (!payload) {
    return value instanceof Error ? value : new Error(String(value));
  }

  const error = new TTSError(
    payload.message,
    payload.code,
    payload.provider,
    payload.retryable
  );
  error.details = {
    attempt: payload.attempt,
    retriesUsed: payload.retriesUsed,
  };
  return error;
};

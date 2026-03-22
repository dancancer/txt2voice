import { TTSError } from "./error-handler";

const LLM_JOB_ERROR_KIND = "txt2voice_llm_job_error";

export interface SerializedLLMJobError {
  kind: typeof LLM_JOB_ERROR_KIND;
  message: string;
  code: "TTS_SERVICE_DOWN";
  provider: string;
  retryable: boolean;
  attempt: number;
  retriesUsed: number;
}

export const serializeLLMJobError = (
  error: unknown,
  params: {
    provider: string;
    attempt: number;
    retriesUsed: number;
  }
): string => {
  const payload: SerializedLLMJobError = {
    kind: LLM_JOB_ERROR_KIND,
    message: error instanceof Error ? error.message : "LLM job failed",
    code: "TTS_SERVICE_DOWN",
    provider: params.provider,
    retryable: error instanceof TTSError ? error.retryable : true,
    attempt: params.attempt,
    retriesUsed: params.retriesUsed,
  };

  return JSON.stringify(payload);
};

export const deserializeLLMJobError = (
  value: unknown
): SerializedLLMJobError | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as SerializedLLMJobError;
    if (parsed.kind !== LLM_JOB_ERROR_KIND) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const toLLMJobError = (value: unknown): Error => {
  const payload = deserializeLLMJobError(value);
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

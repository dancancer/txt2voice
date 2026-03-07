// 一旦我被更新，请更新我的开头注释
// input: 信号模型运行时配置 + 音频/文本输入
// output: provider 推理结果（可回退）
// pos: 信号模型推理模块

import type { QualitySignalModelRuntime } from "@/lib/quality-check/signal-model-runtime";

export interface QualitySignalInferenceInput {
  audioFileId: string;
  sentenceId: string | null;
  bookId: string;
  filePath: string;
  text: string;
  durationSeconds: number;
  roleType: string | null | undefined;
  priority: string | null | undefined;
  voiceProfileId: string | null;
}

export interface QualitySignalProviderInference {
  cer: number | null;
  speakerSimilarity: number | null;
  diagnostics: {
    asrProviderUsed: boolean;
    speakerProviderUsed: boolean;
    asrReason: string | null;
    speakerReason: string | null;
  };
}

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

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
};

const requestModel = async ({
  url,
  payload,
  timeoutMs,
  apiKey,
}: {
  url: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
  apiKey?: string | null;
}): Promise<{ ok: true; response: Record<string, unknown> } | { ok: false; reason: string }> => {
  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return { ok: false, reason: "fetch_unavailable" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey
          ? {
              Authorization: `Bearer ${apiKey}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const json = await response.json().catch(() => null);
    const record = asRecord(json) || asRecord(asRecord(json)?.data);
    if (!record) {
      return { ok: false, reason: "invalid_json" };
    }

    return { ok: true, response: record };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeText = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
};

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
};

const resolveCerFromResponse = ({
  response,
  referenceText,
}: {
  response: Record<string, unknown>;
  referenceText: string;
}): number | null => {
  const directCer =
    asNumber(response.cer) ||
    asNumber(response.asrCer) ||
    asNumber(response.textCer) ||
    asNumber(response.q2Cer);
  if (directCer !== undefined) {
    return clampUnit(directCer);
  }

  const transcript =
    asString(response.transcript) || asString(response.text) || asString(response.asrText);
  if (!transcript) {
    return null;
  }

  const normalizedReference = normalizeText(referenceText);
  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedReference) {
    return null;
  }

  const distance = levenshteinDistance(normalizedReference, normalizedTranscript);
  return clampUnit(distance / Math.max(normalizedReference.length, 1));
};

const parseNumericVector = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asNumber(entry))
    .filter((entry): entry is number => entry !== undefined);
};

const cosineSimilarity = (left: number[], right: number[]): number | null => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return null;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    normLeft += left[index] * left[index];
    normRight += right[index] * right[index];
  }

  if (normLeft <= 0 || normRight <= 0) {
    return null;
  }

  return clampUnit((dot / Math.sqrt(normLeft * normRight) + 1) / 2);
};

const resolveSpeakerSimilarityFromResponse = (
  response: Record<string, unknown>
): number | null => {
  const directSimilarity =
    asNumber(response.speakerSimilarity) ||
    asNumber(response.similarity) ||
    asNumber(response.voiceprintSimilarity) ||
    asNumber(response.q3SpeakerSimilarity);
  if (directSimilarity !== undefined) {
    return clampUnit(directSimilarity);
  }

  const sampleEmbedding = parseNumericVector(
    response.embedding || response.sampleEmbedding
  );
  const referenceEmbedding = parseNumericVector(
    response.referenceEmbedding || response.voiceEmbedding
  );
  return cosineSimilarity(sampleEmbedding, referenceEmbedding);
};

export const inferQualitySignalProviders = async ({
  runtime,
  input,
}: {
  runtime: QualitySignalModelRuntime;
  input: QualitySignalInferenceInput;
}): Promise<QualitySignalProviderInference> => {
  let cer: number | null = null;
  let speakerSimilarity: number | null = null;
  let asrReason: string | null = null;
  let speakerReason: string | null = null;

  if (runtime.useAsrModel && runtime.asrModelUrl) {
    const response = await requestModel({
      url: runtime.asrModelUrl,
      timeoutMs: runtime.timeoutMs,
      apiKey: runtime.asrApiKey,
      payload: {
        audioFileId: input.audioFileId,
        sentenceId: input.sentenceId,
        bookId: input.bookId,
        filePath: input.filePath,
        referenceText: input.text,
        durationSeconds: input.durationSeconds,
      },
    });
    if (response.ok) {
      cer = resolveCerFromResponse({
        response: response.response,
        referenceText: input.text,
      });
      asrReason = cer === null ? "response_missing_cer" : null;
    } else {
      asrReason = response.reason;
    }
  }

  if (runtime.useSpeakerModel && runtime.speakerModelUrl) {
    const response = await requestModel({
      url: runtime.speakerModelUrl,
      timeoutMs: runtime.timeoutMs,
      apiKey: runtime.speakerApiKey,
      payload: {
        audioFileId: input.audioFileId,
        sentenceId: input.sentenceId,
        bookId: input.bookId,
        filePath: input.filePath,
        voiceProfileId: input.voiceProfileId,
        roleType: input.roleType,
        priority: input.priority,
      },
    });
    if (response.ok) {
      speakerSimilarity = resolveSpeakerSimilarityFromResponse(response.response);
      speakerReason = speakerSimilarity === null ? "response_missing_similarity" : null;
    } else {
      speakerReason = response.reason;
    }
  }

  return {
    cer,
    speakerSimilarity,
    diagnostics: {
      asrProviderUsed: runtime.useAsrModel && runtime.asrModelUrl !== null,
      speakerProviderUsed: runtime.useSpeakerModel && runtime.speakerModelUrl !== null,
      asrReason,
      speakerReason,
    },
  };
};

// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 模型运行时配置 + 句级输入
// output: 模型推理信号（可回退）
// pos: Deep Gate 模型推理模块

import {
  parseModelResponse,
  resolveContinuityModelScore,
  resolveEmotionModelScore,
} from "@/lib/quality-check/deep-gate-model-scoring";
import type {
  DeepGateInput,
  DeepGateModelInference,
  DeepGateModelRuntime,
} from "@/lib/quality-gate/types";

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeEmotionLabel = (value: string | null | undefined): string => {
  const normalized = (value || "neutral").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "neutral";
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
  apiKey?: string;
}): Promise<{ ok: true; response: Record<string, unknown> } | { ok: false; reason: string }> => {
  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return {
      ok: false,
      reason: "fetch_unavailable",
    };
  }

  const timeoutFactory =
    typeof AbortSignal !== "undefined"
      ? (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout
      : undefined;
  const signal = typeof timeoutFactory === "function" ? timeoutFactory(timeoutMs) : undefined;

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey
          ? {
              authorization: `Bearer ${apiKey}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `http_${response.status}`,
      };
    }

    const payloadJson = await response.json().catch(() => null);
    const parsed = parseModelResponse(payloadJson);
    if (!parsed) {
      return {
        ok: false,
        reason: "invalid_json_payload",
      };
    }

    return {
      ok: true,
      response: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message
          ? error.message
          : "request_failed",
    };
  }
};

export const inferDeepGateModelSignals = async ({
  runtime,
  input,
}: {
  runtime: DeepGateModelRuntime;
  input: DeepGateInput;
}): Promise<DeepGateModelInference> => {
  const diagnostics: Record<string, unknown> = {
    runtime: {
      useEmotionModel: runtime.useEmotionModel,
      useContinuityModel: runtime.useContinuityModel,
      timeoutMs: runtime.timeoutMs,
    },
  };

  const inference: DeepGateModelInference = {
    q4Source: "heuristic",
    q5Source: "heuristic",
    reasons: [],
    diagnostics,
  };

  if (!runtime.useEmotionModel && !runtime.useContinuityModel) {
    return inference;
  }

  const apiKey = asString(process.env.QC_DEEP_GATE_MODEL_API_KEY);
  const expectedEmotion = normalizeEmotionLabel(input.emotionLabel);

  const [emotionResult, continuityResult] = await Promise.all([
    runtime.useEmotionModel && runtime.emotionModelUrl
      ? requestModel({
          url: runtime.emotionModelUrl,
          timeoutMs: runtime.timeoutMs,
          apiKey,
          payload: {
            text: input.text,
            roleType: input.roleType || "narration",
            expectedEmotion,
            expectedIntensity: input.emotionIntensity,
            charsPerSecond: input.charsPerSecond,
          },
        })
      : Promise.resolve(null),
    runtime.useContinuityModel && runtime.continuityModelUrl
      ? requestModel({
          url: runtime.continuityModelUrl,
          timeoutMs: runtime.timeoutMs,
          apiKey,
          payload: {
            text: input.text,
            roleType: input.roleType || "narration",
            chapterId: input.chapterContext?.chapterId || null,
            voiceProfileId: input.voiceProfileId || null,
            charsPerSecond: input.charsPerSecond,
            chapterContext: input.chapterContext || null,
          },
        })
      : Promise.resolve(null),
  ]);

  if (emotionResult) {
    if (!emotionResult.ok) {
      diagnostics.emotionModel = {
        used: false,
        reason: emotionResult.reason,
      };
    } else {
      const resolved = resolveEmotionModelScore({
        response: emotionResult.response,
        expectedEmotion,
      });
      if (!resolved) {
        diagnostics.emotionModel = {
          used: false,
          reason: "score_unavailable",
        };
      } else {
        inference.q4Score = resolved.score;
        inference.q4Source = "emotion_model";
        inference.reasons.push(...resolved.reasons);
        diagnostics.emotionModel = {
          used: true,
          ...resolved.diagnostics,
        };
      }
    }
  }

  if (continuityResult) {
    if (!continuityResult.ok) {
      diagnostics.continuityModel = {
        used: false,
        reason: continuityResult.reason,
      };
    } else {
      const resolved = resolveContinuityModelScore({
        response: continuityResult.response,
      });
      if (!resolved) {
        diagnostics.continuityModel = {
          used: false,
          reason: "score_unavailable",
        };
      } else {
        inference.q5Score = resolved.score;
        inference.q5Source = "continuity_model";
        inference.reasons.push(...resolved.reasons);
        diagnostics.continuityModel = {
          used: true,
          ...resolved.diagnostics,
        };
      }
    }
  }

  inference.reasons = Array.from(new Set(inference.reasons));
  return inference;
};

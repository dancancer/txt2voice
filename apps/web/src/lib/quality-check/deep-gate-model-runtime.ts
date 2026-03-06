// 一旦我被更新，请更新我的开头注释
// input: 任务/书籍质检配置
// output: Deep Gate 模型运行时配置解析结果
// pos: Deep Gate 运行时解析模块

import type {
  DeepGateModelRuntime,
  DeepGateModelRuntimeResolution,
} from "@/lib/quality-gate/types";

const DEFAULT_TIMEOUT_MS = 2_500;
const MIN_TIMEOUT_MS = 600;
const MAX_TIMEOUT_MS = 12_000;

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

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return undefined;
};

const parseEnvBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }
  return asBoolean(value);
};

const clampTimeoutMs = (value: number | undefined): number => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.floor(value)));
};

const buildDefaultRuntime = (): DeepGateModelRuntime => {
  const emotionModelUrl = asString(process.env.QC_DEEP_GATE_EMOTION_MODEL_URL) || null;
  const continuityModelUrl =
    asString(process.env.QC_DEEP_GATE_CONTINUITY_MODEL_URL) || null;

  const envUseEmotion = parseEnvBoolean(process.env.QC_DEEP_GATE_USE_EMOTION_MODEL);
  const envUseContinuity = parseEnvBoolean(
    process.env.QC_DEEP_GATE_USE_CONTINUITY_MODEL
  );

  const useEmotionModel = (envUseEmotion ?? Boolean(emotionModelUrl)) &&
    Boolean(emotionModelUrl);
  const useContinuityModel =
    (envUseContinuity ?? Boolean(continuityModelUrl)) &&
    Boolean(continuityModelUrl);

  return {
    useEmotionModel,
    useContinuityModel,
    emotionModelUrl,
    continuityModelUrl,
    timeoutMs: clampTimeoutMs(asNumber(process.env.QC_DEEP_GATE_MODEL_TIMEOUT_MS)),
  };
};

const parseRuntimeFromRecord = (
  value: unknown,
  fallback: DeepGateModelRuntime
): DeepGateModelRuntime => {
  const record = asRecord(value);
  if (!record) {
    return fallback;
  }

  const emotionModelUrl =
    asString(record.emotionModelUrl) ||
    asString(record.emotionUrl) ||
    fallback.emotionModelUrl;
  const continuityModelUrl =
    asString(record.continuityModelUrl) ||
    asString(record.continuityUrl) ||
    fallback.continuityModelUrl;

  const useEmotionModel =
    asBoolean(record.useEmotionModel) ?? fallback.useEmotionModel;
  const useContinuityModel =
    asBoolean(record.useContinuityModel) ?? fallback.useContinuityModel;

  const timeoutMs = clampTimeoutMs(asNumber(record.timeoutMs) ?? fallback.timeoutMs);

  return {
    useEmotionModel: useEmotionModel && Boolean(emotionModelUrl),
    useContinuityModel: useContinuityModel && Boolean(continuityModelUrl),
    emotionModelUrl: emotionModelUrl || null,
    continuityModelUrl: continuityModelUrl || null,
    timeoutMs,
  };
};

export const resolveDeepGateModelRuntime = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata: unknown;
  bookMetadata: unknown;
}): DeepGateModelRuntimeResolution => {
  const baseRuntime = buildDefaultRuntime();

  const taskRoot = asRecord(taskMetadata);
  const bookRoot = asRecord(bookMetadata);
  const bookQuality = asRecord(bookRoot?.qualityCheck);

  const bookRuntimeRecord = asRecord(bookQuality?.deepGateModelRuntime);
  const taskRuntimeRecord =
    asRecord(taskRoot?.deepGateModelRuntime) || asRecord(taskRoot?.modelRuntime);

  const bookRuntime = parseRuntimeFromRecord(bookRuntimeRecord, baseRuntime);
  const runtime = parseRuntimeFromRecord(taskRuntimeRecord, bookRuntime);

  const source: DeepGateModelRuntimeResolution["source"] = taskRuntimeRecord
    ? "task_override"
    : bookRuntimeRecord
      ? "book_metadata"
      : "default";

  return {
    runtime,
    source,
  };
};

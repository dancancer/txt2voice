// 一旦我被更新，请更新我的开头注释
// input: 任务/书籍信号模型配置
// output: S30.1 信号 provider 运行时解析结果
// pos: 信号模型运行时模块

export interface QualitySignalModelRuntime {
  useAsrModel: boolean;
  useSpeakerModel: boolean;
  asrModelUrl: string | null;
  speakerModelUrl: string | null;
  asrApiKey: string | null;
  speakerApiKey: string | null;
  timeoutMs: number;
}

export interface QualitySignalModelRuntimeResolution {
  runtime: QualitySignalModelRuntime;
  source: "default" | "book_metadata" | "task_override";
}

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

const clampTimeoutMs = (value: number | undefined): number => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.floor(value)));
};

const buildDefaultRuntime = (): QualitySignalModelRuntime => {
  const asrModelUrl = asString(process.env.QC_SIGNAL_ASR_MODEL_URL) || null;
  const speakerModelUrl = asString(process.env.QC_SIGNAL_SPEAKER_MODEL_URL) || null;
  const useAsrModel =
    (asBoolean(process.env.QC_SIGNAL_USE_ASR_MODEL) ?? Boolean(asrModelUrl)) &&
    Boolean(asrModelUrl);
  const useSpeakerModel =
    (asBoolean(process.env.QC_SIGNAL_USE_SPEAKER_MODEL) ?? Boolean(speakerModelUrl)) &&
    Boolean(speakerModelUrl);

  return {
    useAsrModel,
    useSpeakerModel,
    asrModelUrl,
    speakerModelUrl,
    asrApiKey:
      asString(process.env.QC_SIGNAL_ASR_MODEL_API_KEY) ||
      asString(process.env.QC_SIGNAL_MODEL_API_KEY) ||
      null,
    speakerApiKey:
      asString(process.env.QC_SIGNAL_SPEAKER_MODEL_API_KEY) ||
      asString(process.env.QC_SIGNAL_MODEL_API_KEY) ||
      null,
    timeoutMs: clampTimeoutMs(asNumber(process.env.QC_SIGNAL_MODEL_TIMEOUT_MS)),
  };
};

const parseRuntime = (
  value: unknown,
  fallback: QualitySignalModelRuntime
): QualitySignalModelRuntime => {
  const record = asRecord(value);
  if (!record) {
    return fallback;
  }

  const asrModelUrl =
    asString(record.asrModelUrl) || asString(record.asrUrl) || fallback.asrModelUrl;
  const speakerModelUrl =
    asString(record.speakerModelUrl) ||
    asString(record.speakerUrl) ||
    fallback.speakerModelUrl;
  const useAsrModel = asBoolean(record.useAsrModel) ?? fallback.useAsrModel;
  const useSpeakerModel =
    asBoolean(record.useSpeakerModel) ?? fallback.useSpeakerModel;

  return {
    useAsrModel: useAsrModel && Boolean(asrModelUrl),
    useSpeakerModel: useSpeakerModel && Boolean(speakerModelUrl),
    asrModelUrl: asrModelUrl || null,
    speakerModelUrl: speakerModelUrl || null,
    asrApiKey: asString(record.asrApiKey) || fallback.asrApiKey,
    speakerApiKey: asString(record.speakerApiKey) || fallback.speakerApiKey,
    timeoutMs: clampTimeoutMs(asNumber(record.timeoutMs) ?? fallback.timeoutMs),
  };
};

export const resolveQualitySignalModelRuntime = ({
  taskMetadata,
  bookMetadata,
}: {
  taskMetadata: unknown;
  bookMetadata: unknown;
}): QualitySignalModelRuntimeResolution => {
  const baseRuntime = buildDefaultRuntime();
  const taskRoot = asRecord(taskMetadata);
  const bookRoot = asRecord(bookMetadata);
  const qualityCheck = asRecord(bookRoot?.qualityCheck);

  const bookRuntimeRecord = asRecord(qualityCheck?.signalModelRuntime);
  const taskRuntimeRecord =
    asRecord(taskRoot?.signalModelRuntime) || asRecord(taskRoot?.signalRuntime);

  const bookRuntime = parseRuntime(bookRuntimeRecord, baseRuntime);
  const runtime = parseRuntime(taskRuntimeRecord, bookRuntime);

  const source: QualitySignalModelRuntimeResolution["source"] = taskRuntimeRecord
    ? "task_override"
    : bookRuntimeRecord
      ? "book_metadata"
      : "default";

  return {
    runtime,
    source,
  };
};

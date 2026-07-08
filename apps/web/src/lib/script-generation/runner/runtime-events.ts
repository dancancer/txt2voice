import type { LLMExecutionEvent } from "@/lib/llm/events";
import type { ScriptGenerationRuntimeEvent } from "./types";

export type { ScriptGenerationRuntimeEvent } from "./types";

const MAX_RECENT_RUNTIME_EVENTS = 50;

const STAGE_LABELS: Record<string, string> = {
  prepare: "准备阶段",
  character_discovery: "角色发现",
  segment_scripting: "台本生成",
  segment_repair: "台本修复",
  quality_judgement: "质量判定",
  audio_generation: "音频生成",
  audio_merge: "音频合并",
  quality_check: "质量检查",
  signal_sync: "信号同步",
  validation: "结构校验",
  persist: "结果落库",
  finalize: "结果收口",
  failed: "失败收口",
  completed: "完成收口",
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const asBoolean = (value: unknown): boolean | null => {
  return typeof value === "boolean" ? value : null;
};

const clampProgress = (value: number) => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const getScriptGenerationStageLabel = (stage?: string) => {
  if (!stage) {
    return "";
  }
  return STAGE_LABELS[stage] || stage;
};

const buildRuntimeEventDetail = (parts: Array<string | undefined>) => {
  return parts
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .join(" · ");
};

export const normalizeScriptGenerationRuntimeEvent = (
  value: unknown
): ScriptGenerationRuntimeEvent | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const seq = asNumber(record.seq);
  const kind = asString(record.kind);
  const title = asString(record.title);
  const createdAt = asString(record.createdAt);
  const progress = asNumber(record.progress);
  const rawStatus = asString(record.status);
  const status =
    rawStatus === "success" ||
    rawStatus === "warning" ||
    rawStatus === "error" ||
    rawStatus === "info"
      ? rawStatus
      : "info";

  if (seq === null || !kind || !title || !createdAt || progress === null) {
    return null;
  }

  const stage = asString(record.stage) || undefined;

  return {
    seq,
    kind,
    title,
    detail: asString(record.detail) || undefined,
    status,
    progress: clampProgress(progress),
    createdAt,
    stage,
    stageLabel: asString(record.stageLabel) || getScriptGenerationStageLabel(stage) || undefined,
    source: asString(record.source) || undefined,
    provider: asString(record.provider) || undefined,
    model: asString(record.model) || undefined,
    segmentId: asString(record.segmentId) || undefined,
    attempt: asNumber(record.attempt) ?? undefined,
    retriesUsed: asNumber(record.retriesUsed) ?? undefined,
    retryable: asBoolean(record.retryable) ?? undefined,
    latencyMs: asNumber(record.latencyMs) ?? undefined,
    waitMs: asNumber(record.waitMs) ?? undefined,
  };
};

export const normalizeScriptGenerationRuntimeEvents = (
  value: unknown
): ScriptGenerationRuntimeEvent[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeScriptGenerationRuntimeEvent(entry))
    .filter((entry): entry is ScriptGenerationRuntimeEvent => Boolean(entry))
    .sort((left, right) => left.seq - right.seq);
};

const nextRuntimeEventSeq = (metadata: Record<string, unknown>) => {
  const fromCounter = asNumber(metadata.runtimeEventSeq);
  if (fromCounter !== null) {
    return Math.max(fromCounter, 0) + 1;
  }

  const events = normalizeScriptGenerationRuntimeEvents(metadata.recentRuntimeEvents);
  const maxSeq = events.reduce((current, event) => Math.max(current, event.seq), 0);
  return maxSeq + 1;
};

const createRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  kind: string;
  title: string;
  detail?: string;
  status: ScriptGenerationRuntimeEvent["status"];
  progress: number;
  stage?: string;
  source?: string;
  provider?: string;
  model?: string;
  segmentId?: string;
  attempt?: number;
  retriesUsed?: number;
  retryable?: boolean;
  latencyMs?: number;
  waitMs?: number;
  createdAt?: string;
}): ScriptGenerationRuntimeEvent => {
  const stageLabel = getScriptGenerationStageLabel(params.stage);

  return {
    seq: nextRuntimeEventSeq(params.metadata),
    kind: params.kind,
    title: params.title,
    ...(params.detail ? { detail: params.detail } : {}),
    status: params.status,
    progress: clampProgress(params.progress),
    createdAt: params.createdAt || new Date().toISOString(),
    ...(params.stage ? { stage: params.stage } : {}),
    ...(stageLabel ? { stageLabel } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
    ...(params.model ? { model: params.model } : {}),
    ...(params.segmentId ? { segmentId: params.segmentId } : {}),
    ...(typeof params.attempt === "number" ? { attempt: params.attempt } : {}),
    ...(typeof params.retriesUsed === "number"
      ? { retriesUsed: params.retriesUsed }
      : {}),
    ...(typeof params.retryable === "boolean" ? { retryable: params.retryable } : {}),
    ...(typeof params.latencyMs === "number" ? { latencyMs: params.latencyMs } : {}),
    ...(typeof params.waitMs === "number" ? { waitMs: params.waitMs } : {}),
  };
};

export const appendScriptGenerationRuntimeEvent = (
  metadata: Record<string, unknown>,
  event: Omit<ScriptGenerationRuntimeEvent, "seq" | "createdAt" | "stageLabel"> & {
    createdAt?: string;
  }
) => {
  const createdEvent = createRuntimeEvent({
    metadata,
    ...event,
  });
  const recentRuntimeEvents = [
    ...normalizeScriptGenerationRuntimeEvents(metadata.recentRuntimeEvents),
    createdEvent,
  ].slice(-MAX_RECENT_RUNTIME_EVENTS);

  return {
    metadata: {
      ...metadata,
      currentStage: event.stage || metadata.currentStage || null,
      runtimeEventSeq: createdEvent.seq,
      lastRuntimeEvent: createdEvent,
      recentRuntimeEvents,
    },
    event: createdEvent,
  };
};

export const buildTaskStageRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  title: string;
  detail?: string;
  progress: number;
  stage: string;
  status?: ScriptGenerationRuntimeEvent["status"];
  createdAt?: string;
}) =>
  appendScriptGenerationRuntimeEvent(params.metadata, {
    kind: "task_stage",
    title: params.title,
    ...(params.detail ? { detail: params.detail } : {}),
    status: params.status || "info",
    progress: params.progress,
    stage: params.stage,
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  });

export const buildSegmentProgressRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  done: number;
  total: number;
  progress: number;
  segmentId?: string;
  createdAt?: string;
}) =>
  appendScriptGenerationRuntimeEvent(params.metadata, {
    kind: "segment_progress",
    title: `第 ${params.done}/${params.total} 段台本生成中`,
    detail: "当前正在生成段落台本",
    status: "info",
    progress: params.progress,
    stage: "segment_scripting",
    ...(params.segmentId ? { segmentId: params.segmentId } : {}),
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  });

export const buildLLMRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  event: LLMExecutionEvent;
  progress: number;
  createdAt?: string;
}) => {
  const stage = asString(params.event.stageId) || undefined;
  const stageLabel = getScriptGenerationStageLabel(stage);
  const providerModel = buildRuntimeEventDetail([
    params.event.provider,
    params.event.model,
  ]);

  if (params.event.status === "submitted") {
    return appendScriptGenerationRuntimeEvent(params.metadata, {
      kind: "llm_submitted",
      title: "LLM 调用已提交",
      detail: buildRuntimeEventDetail([stageLabel, providerModel]),
      status: "info",
      progress: params.progress,
      stage,
      source: params.event.source,
      provider: params.event.provider,
      model: params.event.model,
      segmentId: params.event.segmentId,
      attempt: params.event.attempt,
      retriesUsed: params.event.retriesUsed,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    });
  }

  if (params.event.status === "completed") {
    return appendScriptGenerationRuntimeEvent(params.metadata, {
      kind: "llm_completed",
      title: "LLM 调用完成",
      detail: buildRuntimeEventDetail([
        stageLabel,
        providerModel,
        typeof params.event.latencyMs === "number"
          ? `${params.event.latencyMs}ms`
          : undefined,
      ]),
      status: "success",
      progress: params.progress,
      stage,
      source: params.event.source,
      provider: params.event.provider,
      model: params.event.model,
      segmentId: params.event.segmentId,
      attempt: params.event.attempt,
      retriesUsed: params.event.retriesUsed,
      latencyMs: params.event.latencyMs,
      waitMs: params.event.waitMs,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    });
  }

  return appendScriptGenerationRuntimeEvent(params.metadata, {
    kind: "llm_failed",
    title: "LLM 调用失败",
    detail: buildRuntimeEventDetail([
      stageLabel,
      params.event.message,
      providerModel,
    ]),
    status: params.event.retryable ? "warning" : "error",
    progress: params.progress,
    stage,
    source: params.event.source,
    provider: params.event.provider,
    model: params.event.model,
    segmentId: params.event.segmentId,
    attempt: params.event.attempt,
    retriesUsed: params.event.retriesUsed,
    retryable: params.event.retryable,
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  });
};

export const buildAudioBatchPassRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  passName: string;
  requestCount: number;
  successCount: number;
  failedCount: number;
  concurrency: number;
  durationMs: number;
  progress: number;
  createdAt?: string;
}) =>
  appendScriptGenerationRuntimeEvent(params.metadata, {
    kind: "audio_batch_pass",
    title: "音频批次完成",
    detail: buildRuntimeEventDetail([
      params.passName,
      `成功 ${params.successCount}`,
      `失败 ${params.failedCount}`,
      `${params.durationMs}ms`,
    ]),
    status: params.failedCount > 0 ? "warning" : "success",
    progress: params.progress,
    stage: "audio_generation",
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  });

export const buildQualityItemRuntimeEvent = (params: {
  metadata: Record<string, unknown>;
  checked: number;
  total: number;
  progress: number;
  verdict: string;
  issueType: string;
  sentenceId?: string | null;
  audioFileId?: string | null;
  createdAt?: string;
}) =>
  appendScriptGenerationRuntimeEvent(params.metadata, {
    kind: "quality_item_processed",
    title: "质检条目完成",
    detail: buildRuntimeEventDetail([
      `${params.checked}/${params.total}`,
      params.verdict,
      params.issueType,
    ]),
    status:
      params.verdict === "pass"
        ? "success"
        : params.verdict === "repair"
          ? "warning"
          : "error",
    progress: params.progress,
    stage: "quality_check",
    ...(params.sentenceId ? { segmentId: params.sentenceId } : {}),
    ...(params.audioFileId ? { source: params.audioFileId } : {}),
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  });

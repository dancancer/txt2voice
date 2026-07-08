// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 任务视图模型
// pos: 共享业务库
import {
  normalizeScriptGenerationRuntimeEvents,
  type ScriptGenerationRuntimeEvent,
} from "@/lib/script-generation/runner/runtime-events";

export type ProcessingTaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export type TaskStatusMeta = {
  label: string;
  className: string;
};

export interface TaskChildJobProviderSummary {
  provider: string;
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  averageWaitMs: number;
  averageLatencyMs: number;
}

export interface TaskChildJobSummary {
  key: "llm" | "audio_synthesis";
  label: string;
  submitted: number;
  completed: number;
  failed: number;
  retried: number;
  inFlight: number;
  averageWaitMs: number;
  averageLatencyMs: number;
  providers: TaskChildJobProviderSummary[];
}

const TASK_TYPE_LABEL: Record<string, string> = {
  TEXT_PROCESSING: "文本处理",
  SCRIPT_GENERATION: "台本生成",
  AUDIO_GENERATION: "音频生成",
  QUALITY_CHECK: "质量检查",
  QUALITY_SIGNAL_SYNC: "信号生产",
  AUTO_PIPELINE: "自动编排",
  AUTO_PIPELINE_COMPENSATION: "上传触发补偿",
  FINAL_ASSEMBLY: "最终合并",
  MANUAL_REVIEW_SYNC: "复核同步",
};

const TASK_STATUS_META: Record<ProcessingTaskStatus, TaskStatusMeta> = {
  pending: {
    label: "等待中",
    className: "bg-slate-100 text-slate-700",
  },
  processing: {
    label: "执行中",
    className: "bg-blue-100 text-blue-700",
  },
  completed: {
    label: "已完成",
    className: "bg-emerald-100 text-emerald-700",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-700",
  },
  canceled: {
    label: "已取消",
    className: "bg-amber-100 text-amber-700",
  },
};

export const getTaskTypeLabel = (taskType: string) => {
  return TASK_TYPE_LABEL[taskType] || taskType;
};

export const getTaskStatusMeta = (status: string): TaskStatusMeta => {
  if (status in TASK_STATUS_META) {
    return TASK_STATUS_META[status as ProcessingTaskStatus];
  }

  return {
    label: status,
    className: "bg-slate-100 text-slate-700",
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const toNonNegativeNumber = (value: unknown): number | null => {
  const numeric = asNumber(value);
  if (numeric === null || numeric < 0) {
    return null;
  }
  return numeric;
};

const normalizeProviderSummaries = (
  value: unknown
): TaskChildJobProviderSummary[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record || typeof record.provider !== "string" || !record.provider.trim()) {
        return null;
      }

      const submitted = toNonNegativeNumber(record.submitted);
      const completed = toNonNegativeNumber(record.completed);
      const failed = toNonNegativeNumber(record.failed);
      const retried = toNonNegativeNumber(record.retried);
      const averageWaitMs = toNonNegativeNumber(record.averageWaitMs);
      const averageLatencyMs = toNonNegativeNumber(record.averageLatencyMs);

      if (
        submitted === null ||
        completed === null ||
        failed === null ||
        retried === null ||
        averageWaitMs === null ||
        averageLatencyMs === null
      ) {
        return null;
      }

      return {
        provider: record.provider.trim().toLowerCase(),
        submitted,
        completed,
        failed,
        retried,
        averageWaitMs,
        averageLatencyMs,
      };
    })
    .filter((entry): entry is TaskChildJobProviderSummary => Boolean(entry));
};

const normalizeChildSummary = (
  key: TaskChildJobSummary["key"],
  label: TaskChildJobSummary["label"],
  value: unknown
): TaskChildJobSummary | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const submitted = toNonNegativeNumber(record.submitted);
  const completed = toNonNegativeNumber(record.completed);
  const failed = toNonNegativeNumber(record.failed);
  const retried = toNonNegativeNumber(record.retried);
  const averageWaitMs = toNonNegativeNumber(record.averageWaitMs);
  const averageLatencyMs = toNonNegativeNumber(record.averageLatencyMs);

  if (
    submitted === null ||
    completed === null ||
    failed === null ||
    retried === null ||
    averageWaitMs === null ||
    averageLatencyMs === null
  ) {
    return null;
  }

  return {
    key,
    label,
    submitted,
    completed,
    failed,
    retried,
    inFlight: Math.max(submitted - completed - failed, 0),
    averageWaitMs,
    averageLatencyMs,
    providers: normalizeProviderSummaries(record.providers),
  };
};

export const getTaskChildJobSummaries = (
  metadata: unknown
): TaskChildJobSummary[] => {
  const record = asRecord(metadata);
  if (!record) {
    return [];
  }

  const summaries = [
    normalizeChildSummary("llm", "LLM 子任务", record.llmMetrics),
    normalizeChildSummary(
      "audio_synthesis",
      "TTS 子任务",
      record.audioChildJobMetrics
    ),
  ].filter((entry): entry is TaskChildJobSummary => Boolean(entry));

  return summaries;
};

export const getTaskRecentRuntimeEvents = (
  metadata: unknown
): ScriptGenerationRuntimeEvent[] => {
  const record = asRecord(metadata);
  if (!record) {
    return [];
  }

  return normalizeScriptGenerationRuntimeEvents(record.recentRuntimeEvents).slice(-5);
};

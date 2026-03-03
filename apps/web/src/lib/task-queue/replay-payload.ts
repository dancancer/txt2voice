// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 任务记录
// output: 可重放的队列载荷
// pos: 任务队列辅助模块
import type { ProcessingTask } from "@/lib/prisma";
import { jsonObject } from "@/lib/processing-task-utils";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";

export type QueueTaskType = "SCRIPT_GENERATION" | "AUDIO_GENERATION";

export interface ScriptReplayInput {
  taskId: string;
  bookId: string;
  options?: Partial<ScriptGenerationOptions>;
  extraParams?: ScriptGenerationExtraParams;
}

export interface AudioReplayInput {
  taskId: string;
  bookId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

interface ScriptPayloadContainer {
  kind: "script";
  input: ScriptReplayInput;
}

interface AudioPayloadContainer {
  kind: "audio";
  input: AudioReplayInput;
}

export type PayloadContainer = ScriptPayloadContainer | AudioPayloadContainer;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const buildScriptReplayPayloadFromTask = (task: ProcessingTask): ScriptReplayInput => {
  const rawTaskData = jsonObject(task.taskData);

  const normalizedExtra: ScriptGenerationExtraParams = {
    startFromSegmentId:
      typeof rawTaskData.startFromSegmentId === "string"
        ? rawTaskData.startFromSegmentId
        : null,
    startFromOrderIndex:
      typeof rawTaskData.startFromOrderIndex === "number"
        ? rawTaskData.startFromOrderIndex
        : null,
    regenerateSegments: Boolean(rawTaskData.regenerateSegments),
    segmentIds: Array.isArray(rawTaskData.segmentIds)
      ? rawTaskData.segmentIds.filter((value): value is string => typeof value === "string")
      : [],
    limitToSegments:
      typeof rawTaskData.limitToSegments === "number"
        ? rawTaskData.limitToSegments
        : undefined,
  };

  return {
    taskId: task.id,
    bookId: task.bookId,
    options: {},
    extraParams: normalizedExtra,
  };
};

const buildAudioReplayPayloadFromTask = (task: ProcessingTask): AudioReplayInput | null => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);

  const type =
    metadata && typeof metadata.type === "string"
      ? (metadata.type as AudioGenerationTaskType)
      : null;

  if (!type) {
    return null;
  }

  const scriptSentenceIds =
    metadata && Array.isArray(metadata.scriptSentenceIds)
      ? metadata.scriptSentenceIds.filter((value): value is string => typeof value === "string")
      : undefined;

  if ((type === "single" || type === "batch") && (!scriptSentenceIds || scriptSentenceIds.length === 0)) {
    return null;
  }

  return {
    taskId: task.id,
    bookId: task.bookId,
    type,
    chapterId:
      metadata && typeof metadata.chapterId === "string"
        ? metadata.chapterId
        : undefined,
    scriptSentenceIds,
    voiceProfileId:
      metadata && typeof metadata.voiceProfileId === "string"
        ? metadata.voiceProfileId
        : undefined,
    autoMerge: Boolean(metadata?.autoMerge),
    options: {
      provider:
        metadata && typeof metadata.provider === "string"
          ? metadata.provider
          : undefined,
    },
  };
};

export const extractPayloadFromTask = (task: ProcessingTask): PayloadContainer | null => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);
  const queuePayload = metadata ? asRecord(metadata.queuePayload) : null;

  if (task.taskType === "SCRIPT_GENERATION") {
    if (queuePayload) {
      return {
        kind: "script",
        input: {
          taskId: task.id,
          bookId: task.bookId,
          options: (asRecord(queuePayload.options) || {}) as Partial<ScriptGenerationOptions>,
          extraParams: (asRecord(queuePayload.extraParams) || {}) as ScriptGenerationExtraParams,
        },
      };
    }

    return {
      kind: "script",
      input: buildScriptReplayPayloadFromTask(task),
    };
  }

  if (task.taskType === "AUDIO_GENERATION") {
    if (queuePayload) {
      const scriptSentenceIds = Array.isArray(queuePayload.scriptSentenceIds)
        ? queuePayload.scriptSentenceIds.filter(
            (value): value is string => typeof value === "string"
          )
        : undefined;

      return {
        kind: "audio",
        input: {
          taskId: task.id,
          bookId: task.bookId,
          type: String(queuePayload.type || "book") as AudioGenerationTaskType,
          chapterId:
            typeof queuePayload.chapterId === "string"
              ? queuePayload.chapterId
              : undefined,
          scriptSentenceIds,
          voiceProfileId:
            typeof queuePayload.voiceProfileId === "string"
              ? queuePayload.voiceProfileId
              : undefined,
          autoMerge: Boolean(queuePayload.autoMerge),
          options: (asRecord(queuePayload.options) || {}) as AudioGenerationOptions,
        },
      };
    }

    const fallbackInput = buildAudioReplayPayloadFromTask(task);
    if (!fallbackInput) {
      return null;
    }

    return {
      kind: "audio",
      input: fallbackInput,
    };
  }

  return null;
};

export const isRecoverableTask = (taskType: string): taskType is QueueTaskType => {
  return taskType === "SCRIPT_GENERATION" || taskType === "AUDIO_GENERATION";
};

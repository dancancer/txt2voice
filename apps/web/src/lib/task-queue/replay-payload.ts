// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 任务记录
// output: 可重放的队列载荷
// pos: 任务队列辅助模块
import type { ProcessingTask } from "@/lib/prisma";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import { jsonObject } from "@/lib/processing-task-utils";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { QualityCheckTaskType } from "@/lib/quality-check-runner";
import type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync-runner";
import type { ScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/types";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";
import {
  asRecord,
  buildAudioReplayPayloadFromTask,
  buildAutoPipelineReplayPayloadFromTask,
  buildQualityReplayPayloadFromTask,
  buildScriptReplayPayloadFromTask,
  buildSignalSyncReplayPayloadFromTask,
} from "@/lib/task-queue/replay-payload-builders";

export type QueueTaskType =
  | "SCRIPT_GENERATION"
  | "AUDIO_GENERATION"
  | "QUALITY_CHECK"
  | "QUALITY_SIGNAL_SYNC"
  | "AUTO_PIPELINE"
  | "AUTO_PIPELINE_COMPENSATION"
  | "FINAL_ASSEMBLY"
  | "MANUAL_REVIEW_SYNC";

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

export interface QualityReplayInput {
  taskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}

export interface SignalSyncReplayInput {
  taskId: string;
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  forceResync?: boolean;
  signalModelRuntime?: Record<string, unknown>;
}

export interface AutoPipelineReplayInput {
  taskId: string;
  bookId: string;
  options?: AutoPipelineOptions;
  mode?: "pipeline" | "trigger_compensation" | "final_assembly" | "manual_review_sync";
  triggerSource?: string;
  triggerMetadata?: Record<string, unknown>;
  allowReuseRunningTask?: boolean;
  workflowPayload?: Record<string, unknown>;
}

interface ScriptPayloadContainer {
  kind: "script";
  input: ScriptReplayInput;
}

interface AudioPayloadContainer {
  kind: "audio";
  input: AudioReplayInput;
}

interface QualityPayloadContainer {
  kind: "quality";
  input: QualityReplayInput;
}

interface SignalSyncPayloadContainer {
  kind: "signal_sync";
  input: SignalSyncReplayInput;
}

interface AutoPipelinePayloadContainer {
  kind: "auto_pipeline";
  input: AutoPipelineReplayInput;
}

export type PayloadContainer =
  | ScriptPayloadContainer
  | AudioPayloadContainer
  | QualityPayloadContainer
  | SignalSyncPayloadContainer
  | AutoPipelinePayloadContainer;

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

  if (task.taskType === "QUALITY_CHECK") {
    if (queuePayload) {
      const audioFileIds = Array.isArray(queuePayload.audioFileIds)
        ? queuePayload.audioFileIds.filter(
            (value): value is string => typeof value === "string"
          )
        : undefined;

      return {
        kind: "quality",
        input: {
          taskId: task.id,
          bookId: task.bookId,
          type: String(queuePayload.type || "book") as QualityCheckTaskType,
          chapterId:
            typeof queuePayload.chapterId === "string"
              ? queuePayload.chapterId
              : undefined,
          audioFileIds,
        },
      };
    }

    return {
      kind: "quality",
      input: buildQualityReplayPayloadFromTask(task),
    };
  }

  if (task.taskType === "QUALITY_SIGNAL_SYNC") {
    if (queuePayload) {
      const audioFileIds = Array.isArray(queuePayload.audioFileIds)
        ? queuePayload.audioFileIds.filter((value): value is string => typeof value === "string")
        : undefined;

      return {
        kind: "signal_sync",
        input: {
          taskId: task.id,
          bookId: task.bookId,
          type: String(queuePayload.type || "book") as QualitySignalSyncTaskType,
          chapterId:
            typeof queuePayload.chapterId === "string" ? queuePayload.chapterId : undefined,
          audioFileIds,
          forceResync: Boolean(queuePayload.forceResync),
          signalModelRuntime: (asRecord(queuePayload.signalModelRuntime) || {}) as Record<string, unknown>,
        },
      };
    }

    return {
      kind: "signal_sync",
      input: buildSignalSyncReplayPayloadFromTask(task),
    };
  }

  if (task.taskType === "AUTO_PIPELINE" || task.taskType === "AUTO_PIPELINE_COMPENSATION" || task.taskType === "FINAL_ASSEMBLY" || task.taskType === "MANUAL_REVIEW_SYNC") {
    if (queuePayload) {
      const workflowPayload =
        (asRecord(queuePayload.workflowPayload) || {}) as Record<string, unknown>;

      return {
        kind: "auto_pipeline",
        input: {
          taskId: task.id,
          bookId: task.bookId,
          options: (asRecord(queuePayload.options) || {}) as AutoPipelineOptions,
          mode:
            typeof queuePayload.mode === "string" &&
            (queuePayload.mode === "trigger_compensation" ||
              queuePayload.mode === "final_assembly" ||
              queuePayload.mode === "manual_review_sync")
              ? (queuePayload.mode as "trigger_compensation" | "final_assembly" | "manual_review_sync")
              : "pipeline",
          triggerSource:
            typeof queuePayload.triggerSource === "string"
              ? queuePayload.triggerSource
              : undefined,
          triggerMetadata: (asRecord(queuePayload.triggerMetadata) || {}) as Record<string, unknown>,
          allowReuseRunningTask:
            typeof queuePayload.allowReuseRunningTask === "boolean"
              ? queuePayload.allowReuseRunningTask
              : undefined,
          ...(Object.keys(workflowPayload).length > 0 ? { workflowPayload } : {}),
        },
      };
    }

    return {
      kind: "auto_pipeline",
      input: buildAutoPipelineReplayPayloadFromTask(task),
    };
  }

  return null;
};

export const isRecoverableTask = (taskType: string): taskType is QueueTaskType => {
  return (
    taskType === "SCRIPT_GENERATION" ||
    taskType === "AUDIO_GENERATION" ||
    taskType === "QUALITY_CHECK" ||
    taskType === "QUALITY_SIGNAL_SYNC" ||
    taskType === "AUTO_PIPELINE" ||
    taskType === "AUTO_PIPELINE_COMPENSATION" ||
    taskType === "FINAL_ASSEMBLY" ||
    taskType === "MANUAL_REVIEW_SYNC"
  );
};

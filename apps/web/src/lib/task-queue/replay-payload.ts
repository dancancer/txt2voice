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
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";

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
      routerPolicyVersion:
        metadata && typeof metadata.routerPolicyVersion === "string"
          ? metadata.routerPolicyVersion
          : undefined,
      enableRouterDebug:
        metadata && typeof metadata.enableRouterDebug === "boolean"
          ? metadata.enableRouterDebug
          : undefined,
    },
  };
};

const buildQualityReplayPayloadFromTask = (task: ProcessingTask): QualityReplayInput => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);

  const type =
    metadata && typeof metadata.type === "string"
      ? (metadata.type as QualityCheckTaskType)
      : "book";

  const audioFileIds =
    metadata && Array.isArray(metadata.audioFileIds)
      ? metadata.audioFileIds.filter((value): value is string => typeof value === "string")
      : undefined;

  return {
    taskId: task.id,
    bookId: task.bookId,
    type,
    chapterId:
      metadata && typeof metadata.chapterId === "string"
        ? metadata.chapterId
        : undefined,
    audioFileIds,
  };
};

const buildSignalSyncReplayPayloadFromTask = (task: ProcessingTask): SignalSyncReplayInput => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);

  return {
    taskId: task.id,
    bookId: task.bookId,
    type:
      metadata && typeof metadata.type === "string"
        ? (metadata.type as QualitySignalSyncTaskType)
        : "book",
    chapterId:
      metadata && typeof metadata.chapterId === "string" ? metadata.chapterId : undefined,
    audioFileIds:
      metadata && Array.isArray(metadata.audioFileIds)
        ? metadata.audioFileIds.filter((value): value is string => typeof value === "string")
        : undefined,
    forceResync: Boolean(metadata?.forceResync),
    signalModelRuntime: (asRecord(metadata?.signalModelRuntime) || {}) as Record<string, unknown>,
  };
};

const buildAutoPipelineReplayPayloadFromTask = (
  task: ProcessingTask
): AutoPipelineReplayInput => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);
  const options = asRecord(metadata?.options) || {};
  const workflowPayload =
    (asRecord(metadata?.workflowPayload) ||
      (task.taskType === "FINAL_ASSEMBLY"
        ? {
            source: "final_assembly",
            previousBookStatus:
              typeof metadata?.previousBookStatus === "string"
                ? metadata.previousBookStatus
                : undefined,
            parentManualReviewSyncTaskId:
              typeof metadata?.parentManualReviewSyncTaskId === "string"
                ? metadata.parentManualReviewSyncTaskId
                : undefined,
            type: typeof metadata?.type === "string" ? metadata.type : undefined,
            chapterId:
              typeof metadata?.chapterId === "string" ? metadata.chapterId : undefined,
            segmentId:
              typeof metadata?.segmentId === "string" ? metadata.segmentId : undefined,
            options: asRecord(metadata?.options) || {},
          }
        : task.taskType === "MANUAL_REVIEW_SYNC"
          ? {
              source: "manual_review_sync",
              previousBookStatus:
                typeof metadata?.previousBookStatus === "string"
                  ? metadata.previousBookStatus
                  : undefined,
              autoTriggerFinalAssembly:
                typeof metadata?.autoTriggerFinalAssembly === "boolean"
                  ? metadata.autoTriggerFinalAssembly
                  : undefined,
              finalAssembly: asRecord(metadata?.finalAssembly) || {},
            }
          : {})) as Record<string, unknown>;
  const mode =
    typeof metadata?.mode === "string" &&
    (metadata.mode === "trigger_compensation" ||
      metadata.mode === "final_assembly" ||
      metadata.mode === "manual_review_sync")
      ? metadata.mode
      : task.taskType === "AUTO_PIPELINE_COMPENSATION" ||
          metadata?.source === "upload_compensation"
        ? "trigger_compensation"
        : task.taskType === "FINAL_ASSEMBLY" || metadata?.source === "final_assembly"
          ? "final_assembly"
          : task.taskType === "MANUAL_REVIEW_SYNC" ||
              metadata?.source === "manual_review_sync"
            ? "manual_review_sync"
            : "pipeline";

  return {
    taskId: task.id,
    bookId: task.bookId,
    options: options as AutoPipelineOptions,
    mode,
    triggerSource:
      typeof metadata?.triggerSource === "string" ? metadata.triggerSource : undefined,
    triggerMetadata: (asRecord(metadata?.triggerMetadata) || {}) as Record<string, unknown>,
    allowReuseRunningTask:
      typeof metadata?.allowReuseRunningTask === "boolean"
        ? metadata.allowReuseRunningTask
        : undefined,
    ...(Object.keys(workflowPayload).length > 0 ? { workflowPayload } : {}),
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

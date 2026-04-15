// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 记录/taskData.metadata
// output: replay payload builder 辅助函数
// pos: 任务队列辅助模块
import type { ProcessingTask } from "@/lib/prisma";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { QualityCheckTaskType } from "@/lib/quality-check-runner";
import type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync-runner";
import { jsonObject } from "@/lib/processing-task-utils";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";
import type { ScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/types";
import type {
  AudioReplayInput,
  AutoPipelineReplayInput,
  QualityReplayInput,
  ScriptReplayInput,
  SignalSyncReplayInput,
} from "@/lib/task-queue/replay-payload";

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const buildScriptReplayPayloadFromTask = (
  task: ProcessingTask
): ScriptReplayInput => {
  const rawTaskData = jsonObject(task.taskData);
  const metadata = asRecord(rawTaskData.metadata);
  const rawOptions = asRecord(metadata?.options) || {};

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
    options: rawOptions as Partial<ScriptGenerationOptions>,
    extraParams: normalizedExtra,
  };
};

export const buildAudioReplayPayloadFromTask = (
  task: ProcessingTask
): AudioReplayInput | null => {
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

  if (
    (type === "single" || type === "batch") &&
    (!scriptSentenceIds || scriptSentenceIds.length === 0)
  ) {
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

export const buildQualityReplayPayloadFromTask = (
  task: ProcessingTask
): QualityReplayInput => {
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

export const buildSignalSyncReplayPayloadFromTask = (
  task: ProcessingTask
): SignalSyncReplayInput => {
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

export const buildAutoPipelineReplayPayloadFromTask = (
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

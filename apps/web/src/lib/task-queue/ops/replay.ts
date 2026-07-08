import prisma from "@/lib/prisma";
import {
  extractPayloadFromTask,
  isRecoverableTask,
} from "@/lib/task-queue/replay-payload";
import {
  resolveAutoPipelineOptionsSnapshot,
  ZERO_TOUCH_VOXCPM_PRESET_ID,
} from "@/lib/auto-pipeline/presets";
import { jsonObject } from "@/lib/processing-task-utils";
import type {
  ReplayControlOptions,
  ReplayResult,
} from "@/lib/task-queue/core/types";
import type { Prisma } from "@/lib/prisma";
import {
  enqueueAutoPipelineJob,
  enqueueAudioGenerationJob,
  enqueueQualityCheckJob,
  enqueueQualitySignalSyncJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue/ops/enqueue";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const refreshAutoPipelinePresetOptions = (taskData: Prisma.JsonValue | null | undefined) => {
  const metadata = asRecord(jsonObject(taskData).metadata);
  const presetId =
    typeof metadata?.presetId === "string" && metadata.presetId.trim()
      ? metadata.presetId.trim()
      : ZERO_TOUCH_VOXCPM_PRESET_ID;
  const options = asRecord(metadata?.options) || {};

  return resolveAutoPipelineOptionsSnapshot(presetId, options).resolvedOptions;
};

export async function replayProcessingTask(
  taskId: string,
  control: ReplayControlOptions = {}
): Promise<ReplayResult> {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error("任务不存在");
  }

  if (!isRecoverableTask(task.taskType)) {
    throw new Error(`不支持重放任务类型：${task.taskType}`);
  }

  const payload = extractPayloadFromTask(task);
  if (!payload) {
    throw new Error("任务缺少可重放的队列参数");
  }

  const force = control.force ?? true;
  const reason = control.reason || "manual_replay";

  if (payload.kind === "script") {
    const result = await enqueueScriptGenerationJob(payload.input, {
      allowReuse: !force,
      reason,
    });

    return {
      taskId: payload.input.taskId,
      taskType: "SCRIPT_GENERATION",
      jobId: result.jobId,
      reused: result.reused,
      reason,
    };
  }

  if (payload.kind === "audio") {
    const result = await enqueueAudioGenerationJob(payload.input, {
      allowReuse: !force,
      reason,
    });

    return {
      taskId: payload.input.taskId,
      taskType: "AUDIO_GENERATION",
      jobId: result.jobId,
      reused: result.reused,
      reason,
    };
  }

  if (payload.kind === "signal_sync") {
    const result = await enqueueQualitySignalSyncJob(payload.input, {
      allowReuse: !force,
      reason,
    });

    return {
      taskId: payload.input.taskId,
      taskType: "QUALITY_SIGNAL_SYNC",
      jobId: result.jobId,
      reused: result.reused,
      reason,
    };
  }

  if (payload.kind === "auto_pipeline") {
    if (control.refreshPreset) {
      payload.input.options = refreshAutoPipelinePresetOptions(task.taskData);
    }

    const result = await enqueueAutoPipelineJob(payload.input, {
      allowReuse: !force,
      reason,
    });

    return {
      taskId: payload.input.taskId,
      taskType:
        task.taskType === "AUTO_PIPELINE_COMPENSATION"
          ? "AUTO_PIPELINE_COMPENSATION"
          : task.taskType === "FINAL_ASSEMBLY"
            ? "FINAL_ASSEMBLY"
            : task.taskType === "MANUAL_REVIEW_SYNC"
              ? "MANUAL_REVIEW_SYNC"
              : "AUTO_PIPELINE",
      jobId: result.jobId,
      reused: result.reused,
      reason,
    };
  }

  const result = await enqueueQualityCheckJob(payload.input, {
    allowReuse: !force,
    reason,
  });

  return {
    taskId: payload.input.taskId,
    taskType: "QUALITY_CHECK",
    jobId: result.jobId,
    reused: result.reused,
    reason,
  };
}

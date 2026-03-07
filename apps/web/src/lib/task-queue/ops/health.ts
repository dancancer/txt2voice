import {
  HEARTBEAT_INTERVAL_MS,
  STALLED_TASK_THRESHOLD_MS,
} from "@/lib/task-queue/core/constants";
import {
  getAutoPipelineQueue,
  getAudioQueue,
  getDeadLetterQueue,
  getQualityQueue,
  getScriptQueue,
  getSignalSyncQueue,
} from "@/lib/task-queue/core/runtime";
import { recoverStalledProcessingTasks } from "@/lib/task-queue/ops/recovery";
import { ensureTaskWorkerStarted } from "@/lib/task-queue/ops/worker";

export async function getTaskQueueHealth(): Promise<Record<string, unknown>> {
  if (!process.env.REDIS_URL) {
    return {
      status: "unhealthy",
      message: "REDIS_URL 未配置",
    };
  }

  try {
    await ensureTaskWorkerStarted();

    const [
      scriptCounts,
      audioCounts,
      qualityCounts,
      signalSyncCounts,
      autoPipelineCounts,
      deadLetterCounts,
      recovery,
    ] = await Promise.all([
      getScriptQueue().getJobCounts(),
      getAudioQueue().getJobCounts(),
      getQualityQueue().getJobCounts(),
      getSignalSyncQueue().getJobCounts(),
      getAutoPipelineQueue().getJobCounts(),
      getDeadLetterQueue().getJobCounts(),
      recoverStalledProcessingTasks(),
    ]);

    return {
      status: "healthy",
      message: "Task queue online",
      script: scriptCounts,
      audio: audioCounts,
      quality: qualityCounts,
      signalSync: signalSyncCounts,
      autoPipeline: autoPipelineCounts,
      deadLetter: deadLetterCounts,
      recovery,
      heartbeat: {
        intervalMs: HEARTBEAT_INTERVAL_MS,
        stalledThresholdMs: STALLED_TASK_THRESHOLD_MS,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Task queue unavailable",
    };
  }
}

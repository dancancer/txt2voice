import prisma from "@/lib/prisma";
import {
  MAX_RECOVERY_BATCH,
  RECOVERY_COOLDOWN_MS,
  RUNNING_STATES,
  STALLED_TASK_THRESHOLD_MS,
} from "@/lib/task-queue/core/constants";
import {
  getQueueJobState,
  queueState,
} from "@/lib/task-queue/core/runtime";
import type { RecoveryResult } from "@/lib/task-queue/core/types";
import { replayProcessingTask } from "@/lib/task-queue/ops/replay";
import type { QueueTaskType } from "@/lib/task-queue/replay-payload";
import { markTaskFailed } from "@/lib/task-queue/worker-state";

const getFallbackStatus = (
  taskType: string
): "uploaded" | "completed" | "processed" | "script_generated" | "manual_review_pending" | "audio_review_ready" | "completed_with_errors" | "error" => {
  if (taskType === "SCRIPT_GENERATION") {
    return "processed";
  }
  if (taskType === "AUDIO_GENERATION") {
    return "script_generated";
  }
  if (taskType === "QUALITY_CHECK") {
    return "completed_with_errors";
  }
  if (taskType === "QUALITY_SIGNAL_SYNC") {
    return "completed";
  }
  if (taskType === "FINAL_ASSEMBLY") {
    return "completed_with_errors";
  }
  if (taskType === "MANUAL_REVIEW_SYNC") {
    return "audio_review_ready";
  }
  if (taskType === "AUTO_PIPELINE_COMPENSATION") {
    return "uploaded";
  }
  return "error";
};

export async function recoverStalledProcessingTasks(): Promise<RecoveryResult> {
  const now = Date.now();

  if (queueState.recovering) {
    return {
      status: "skipped",
      reason: "recovery_in_progress",
      scanned: 0,
      recovered: 0,
      failed: 0,
      staleBefore: new Date(now - STALLED_TASK_THRESHOLD_MS).toISOString(),
    };
  }

  if (now - queueState.lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
    return {
      status: "skipped",
      reason: "recovery_cooldown",
      scanned: 0,
      recovered: 0,
      failed: 0,
      staleBefore: new Date(now - STALLED_TASK_THRESHOLD_MS).toISOString(),
    };
  }

  queueState.recovering = true;
  queueState.lastRecoveryAt = now;

  const staleBefore = new Date(now - STALLED_TASK_THRESHOLD_MS);
  let scanned = 0;
  let recovered = 0;
  let failed = 0;

  try {
    const staleTasks = await prisma.processingTask.findMany({
      where: {
        status: "processing",
        taskType: {
          in: [
            "SCRIPT_GENERATION",
            "AUDIO_GENERATION",
            "QUALITY_CHECK",
            "QUALITY_SIGNAL_SYNC",
            "AUTO_PIPELINE",
            "AUTO_PIPELINE_COMPENSATION",
            "FINAL_ASSEMBLY",
            "MANUAL_REVIEW_SYNC",
          ],
        },
        updatedAt: {
          lt: staleBefore,
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: MAX_RECOVERY_BATCH,
    });

    scanned = staleTasks.length;

    for (const task of staleTasks) {
      try {
        const queueStateResult = await getQueueJobState(
          task.taskType as QueueTaskType,
          task.id
        );

        if (
          queueStateResult.exists &&
          queueStateResult.state &&
          RUNNING_STATES.has(queueStateResult.state as never)
        ) {
          continue;
        }

        await replayProcessingTask(task.id, {
          force: true,
          reason: "watchdog_recovery",
        });
        recovered += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        await markTaskFailed(
          task.id,
          task.bookId,
          getFallbackStatus(task.taskType),
          `自动恢复失败：${message}`,
          {
            recoveryReason: "watchdog_recovery_failed",
            heartbeatTimeoutMs: STALLED_TASK_THRESHOLD_MS,
            recoveredAt: new Date().toISOString(),
            queueJobId: task.externalTaskId,
          }
        );
      }
    }

    return {
      status: "ok",
      scanned,
      recovered,
      failed,
      staleBefore: staleBefore.toISOString(),
    };
  } finally {
    queueState.recovering = false;
  }
}

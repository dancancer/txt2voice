import prisma from "@/lib/prisma";
import {
  extractPayloadFromTask,
  isRecoverableTask,
} from "@/lib/task-queue/replay-payload";
import type {
  ReplayControlOptions,
  ReplayResult,
} from "@/lib/task-queue/core/types";
import {
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue/ops/enqueue";

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

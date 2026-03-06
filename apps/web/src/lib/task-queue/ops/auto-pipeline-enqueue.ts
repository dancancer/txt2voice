import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { buildAutoPipelineDedupeKey } from "@/lib/task-queue/dedupe";
import {
  AUTO_PIPELINE_COMPENSATION_JOB_OPTIONS,
  AUTO_PIPELINE_JOB_OPTIONS,
  AUTO_PIPELINE_QUEUE_NAME,
} from "@/lib/task-queue/core/constants";
import { addOrReuseJob, getAutoPipelineQueue } from "@/lib/task-queue/core/runtime";
import type {
  AutoPipelineQueueInput,
  QueueControlOptions,
} from "@/lib/task-queue/core/types";

export const normalizeAutoPipelineInput = (
  input: AutoPipelineQueueInput
): Required<Pick<AutoPipelineQueueInput, "taskId" | "bookId" | "options">> &
  Pick<
    AutoPipelineQueueInput,
    "mode" | "triggerSource" | "triggerMetadata" | "allowReuseRunningTask"
  > => ({
  taskId: input.taskId,
  bookId: input.bookId,
  options: input.options || {},
  mode: input.mode || "pipeline",
  triggerSource: input.triggerSource,
  triggerMetadata: input.triggerMetadata || {},
  allowReuseRunningTask: input.allowReuseRunningTask,
});

export async function enqueueAutoPipelineJobInternal(
  input: AutoPipelineQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  const normalizedInput = normalizeAutoPipelineInput(input);
  const queue = getAutoPipelineQueue();
  const dedupeKey = buildAutoPipelineDedupeKey(normalizedInput);
  const jobOptions =
    normalizedInput.mode === "trigger_compensation"
      ? AUTO_PIPELINE_COMPENSATION_JOB_OPTIONS
      : AUTO_PIPELINE_JOB_OPTIONS;
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      options: normalizedInput.options || {},
      triggerMetadata: normalizedInput.triggerMetadata || {},
      allowReuseRunningTask: normalizedInput.allowReuseRunningTask ?? true,
      dedupeKey,
    },
    {
      ...jobOptions,
      jobId: normalizedInput.taskId,
    },
    control.allowReuse ?? true
  );

  const jobId = String(addResult.job.id);
  const taskData = await mergeTaskData(normalizedInput.taskId, {
    message: addResult.reused ? "任务已在队列中执行" : "任务已入队，等待执行",
    metadata: {
      queueName: AUTO_PIPELINE_QUEUE_NAME,
      queueJobId: jobId,
      dedupeKey,
      queueMode: "redis_worker",
      queueState: addResult.state,
      enqueueReason: control.reason || "api_request",
      queuePayload: {
        options: normalizedInput.options || {},
        mode: normalizedInput.mode,
        triggerSource: normalizedInput.triggerSource || null,
        triggerMetadata: normalizedInput.triggerMetadata || {},
        allowReuseRunningTask: normalizedInput.allowReuseRunningTask ?? true,
      },
      enqueuedAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: normalizedInput.taskId },
    data: {
      status: "processing",
      completedAt: null,
      errorMessage: null,
      externalTaskId: jobId,
      taskData,
    },
  });

  return { jobId, dedupeKey, reused: addResult.reused, state: addResult.state };
}

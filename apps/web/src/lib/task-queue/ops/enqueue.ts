import prisma from "@/lib/prisma";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  buildAutoPipelineDedupeKey,
  buildAudioDedupeKey,
  buildQualityDedupeKey,
  buildScriptDedupeKey,
} from "@/lib/task-queue/dedupe";
import {
  AUDIO_JOB_OPTIONS,
  AUDIO_QUEUE_NAME,
  AUTO_PIPELINE_JOB_OPTIONS,
  AUTO_PIPELINE_QUEUE_NAME,
  QUALITY_JOB_OPTIONS,
  QUALITY_QUEUE_NAME,
  SCRIPT_JOB_OPTIONS,
  SCRIPT_QUEUE_NAME,
} from "@/lib/task-queue/core/constants";
import {
  addOrReuseJob,
  getAutoPipelineQueue,
  getAudioQueue,
  getQualityQueue,
  getScriptQueue,
} from "@/lib/task-queue/core/runtime";
import type {
  AutoPipelineQueueInput,
  AudioGenerationQueueInput,
  QualityCheckQueueInput,
  QueueControlOptions,
  ScriptGenerationQueueInput,
} from "@/lib/task-queue/core/types";
import { ensureTaskWorkerStarted } from "@/lib/task-queue/ops/worker";

const normalizeScriptInput = (
  input: ScriptGenerationQueueInput
): ScriptGenerationQueueInput => ({
  taskId: input.taskId,
  bookId: input.bookId,
  options: input.options || {},
  extraParams: input.extraParams || {},
});

const normalizeAudioInput = (
  input: AudioGenerationQueueInput
): AudioGenerationQueueInput => ({
  taskId: input.taskId,
  bookId: input.bookId,
  type: input.type,
  chapterId: input.chapterId,
  scriptSentenceIds: input.scriptSentenceIds,
  voiceProfileId: input.voiceProfileId,
  autoMerge: Boolean(input.autoMerge),
  options: input.options || {},
});

const normalizeQualityInput = (
  input: QualityCheckQueueInput
): QualityCheckQueueInput => ({
  taskId: input.taskId,
  bookId: input.bookId,
  type: input.type,
  chapterId: input.chapterId,
  audioFileIds: input.audioFileIds || [],
});

const normalizeAutoPipelineInput = (
  input: AutoPipelineQueueInput
): AutoPipelineQueueInput => ({
  taskId: input.taskId,
  bookId: input.bookId,
  options: (input.options || {}) as AutoPipelineOptions,
});

export async function enqueueScriptGenerationJob(
  input: ScriptGenerationQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeScriptInput(input);
  const queue = getScriptQueue();
  const dedupeKey = buildScriptDedupeKey(normalizedInput);
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      options: normalizedInput.options || {},
      extraParams: normalizedInput.extraParams || {},
      dedupeKey,
    },
    {
      ...SCRIPT_JOB_OPTIONS,
      jobId: normalizedInput.taskId,
    },
    control.allowReuse ?? true
  );

  const jobId = String(addResult.job.id);
  const taskData = await mergeTaskData(normalizedInput.taskId, {
    message: addResult.reused ? "任务已在队列中执行" : "任务已入队，等待执行",
    metadata: {
      queueName: SCRIPT_QUEUE_NAME,
      queueJobId: jobId,
      dedupeKey,
      queueMode: "redis_worker",
      queueState: addResult.state,
      enqueueReason: control.reason || "api_request",
      queuePayload: {
        options: normalizedInput.options,
        extraParams: normalizedInput.extraParams,
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

export async function enqueueAudioGenerationJob(
  input: AudioGenerationQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeAudioInput(input);
  const queue = getAudioQueue();
  const dedupeKey = buildAudioDedupeKey(normalizedInput);
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      autoMerge: Boolean(normalizedInput.autoMerge),
      options: normalizedInput.options || {},
      dedupeKey,
    },
    {
      ...AUDIO_JOB_OPTIONS,
      jobId: normalizedInput.taskId,
    },
    control.allowReuse ?? true
  );

  const jobId = String(addResult.job.id);
  const taskData = await mergeTaskData(normalizedInput.taskId, {
    message: addResult.reused ? "任务已在队列中执行" : "任务已入队，等待执行",
    metadata: {
      queueName: AUDIO_QUEUE_NAME,
      queueJobId: jobId,
      dedupeKey,
      queueMode: "redis_worker",
      queueState: addResult.state,
      enqueueReason: control.reason || "api_request",
      queuePayload: {
        type: normalizedInput.type,
        chapterId: normalizedInput.chapterId || null,
        scriptSentenceIds: normalizedInput.scriptSentenceIds || [],
        voiceProfileId: normalizedInput.voiceProfileId || null,
        autoMerge: Boolean(normalizedInput.autoMerge),
        options: normalizedInput.options || {},
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

export async function enqueueQualityCheckJob(
  input: QualityCheckQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeQualityInput(input);
  const queue = getQualityQueue();
  const dedupeKey = buildQualityDedupeKey(normalizedInput);
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      audioFileIds: normalizedInput.audioFileIds || [],
      dedupeKey,
    },
    {
      ...QUALITY_JOB_OPTIONS,
      jobId: normalizedInput.taskId,
    },
    control.allowReuse ?? true
  );

  const jobId = String(addResult.job.id);
  const taskData = await mergeTaskData(normalizedInput.taskId, {
    message: addResult.reused ? "任务已在队列中执行" : "任务已入队，等待执行",
    metadata: {
      queueName: QUALITY_QUEUE_NAME,
      queueJobId: jobId,
      dedupeKey,
      queueMode: "redis_worker",
      queueState: addResult.state,
      enqueueReason: control.reason || "api_request",
      queuePayload: {
        type: normalizedInput.type,
        chapterId: normalizedInput.chapterId || null,
        audioFileIds: normalizedInput.audioFileIds || [],
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

export async function enqueueAutoPipelineJob(
  input: AutoPipelineQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeAutoPipelineInput(input);
  const queue = getAutoPipelineQueue();
  const dedupeKey = buildAutoPipelineDedupeKey(normalizedInput);
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      options: normalizedInput.options || {},
      dedupeKey,
    },
    {
      ...AUTO_PIPELINE_JOB_OPTIONS,
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

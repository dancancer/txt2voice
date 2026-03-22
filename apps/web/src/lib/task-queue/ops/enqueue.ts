import type Bull from "bull";
import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  buildAudioDedupeKey,
  buildQualityDedupeKey,
  buildScriptDedupeKey,
  buildSignalSyncDedupeKey,
} from "@/lib/task-queue/dedupe";
import {
  AUDIO_JOB_OPTIONS,
  AUDIO_SYNTHESIS_JOB_OPTIONS,
  AUDIO_QUEUE_NAME,
  LLM_JOB_OPTIONS,
  QUALITY_JOB_OPTIONS,
  QUALITY_QUEUE_NAME,
  SIGNAL_SYNC_JOB_OPTIONS,
  SIGNAL_SYNC_QUEUE_NAME,
  SCRIPT_JOB_OPTIONS,
  SCRIPT_QUEUE_NAME,
} from "@/lib/task-queue/core/constants";
import {
  addOrReuseJob,
  getAudioQueue,
  getAudioSynthesisQueue,
  getLLMQueue,
  getQualityQueue,
  getScriptQueue,
  getSignalSyncQueue,
} from "@/lib/task-queue/core/runtime";
import type {
  AutoPipelineQueueInput,
  AudioGenerationQueueInput,
  AudioSynthesisQueueInput,
  LLMExecutionQueueInput,
  QualityCheckQueueInput,
  QualitySignalSyncQueueInput,
  QueueControlOptions,
  ScriptGenerationQueueInput,
} from "@/lib/task-queue/core/types";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";
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

const normalizeAudioSynthesisInput = (
  input: AudioSynthesisQueueInput
): AudioSynthesisQueueInput => ({
  requestId: input.requestId,
  request: input.request,
  options: input.options || {},
  metadata: input.metadata || {},
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

const normalizeSignalSyncInput = (
  input: QualitySignalSyncQueueInput
): QualitySignalSyncQueueInput => ({
  taskId: input.taskId,
  bookId: input.bookId,
  type: input.type,
  chapterId: input.chapterId,
  audioFileIds: input.audioFileIds || [],
  forceResync: Boolean(input.forceResync),
  signalModelRuntime: input.signalModelRuntime || {},
});

const normalizeLLMInput = (
  input: LLMExecutionQueueInput
): LLMExecutionQueueInput => ({
  requestId: input.requestId,
  provider: input.provider,
  prompt: input.prompt,
  systemPrompt: input.systemPrompt,
  metadata: input.metadata || {},
  requestOptions: input.requestOptions || {},
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

export async function enqueueQualitySignalSyncJob(
  input: QualitySignalSyncQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeSignalSyncInput(input);
  const queue = getSignalSyncQueue();
  const dedupeKey = buildSignalSyncDedupeKey(normalizedInput);
  const addResult = await addOrReuseJob(
    queue,
    {
      ...normalizedInput,
      audioFileIds: normalizedInput.audioFileIds || [],
      forceResync: Boolean(normalizedInput.forceResync),
      signalModelRuntime: normalizedInput.signalModelRuntime || {},
      dedupeKey,
    },
    {
      ...SIGNAL_SYNC_JOB_OPTIONS,
      jobId: normalizedInput.taskId,
    },
    control.allowReuse ?? true
  );

  const jobId = String(addResult.job.id);
  const taskData = await mergeTaskData(normalizedInput.taskId, {
    message: addResult.reused ? "任务已在队列中执行" : "任务已入队，等待执行",
    metadata: {
      queueName: SIGNAL_SYNC_QUEUE_NAME,
      queueJobId: jobId,
      dedupeKey,
      queueMode: "redis_worker",
      queueState: addResult.state,
      enqueueReason: control.reason || "api_request",
      queuePayload: {
        type: normalizedInput.type,
        chapterId: normalizedInput.chapterId || null,
        audioFileIds: normalizedInput.audioFileIds || [],
        forceResync: Boolean(normalizedInput.forceResync),
        signalModelRuntime: normalizedInput.signalModelRuntime || {},
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
  return enqueueAutoPipelineJobInternal(input, control);
}

export async function enqueueLLMExecutionJob(
  input: LLMExecutionQueueInput
): Promise<{
  jobId: string;
  job: Bull.Job;
}> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeLLMInput(input);
  const queue = getLLMQueue();
  const job = await queue.add(
    {
      ...normalizedInput,
      metadata: normalizedInput.metadata || {},
      requestOptions: normalizedInput.requestOptions || {},
    },
    {
      ...LLM_JOB_OPTIONS,
      jobId: normalizedInput.requestId,
    }
  );

  return {
    jobId: String(job.id),
    job,
  };
}

export async function enqueueAudioSynthesisJob(
  input: AudioSynthesisQueueInput
): Promise<{
  jobId: string;
  job: Bull.Job;
}> {
  await ensureTaskWorkerStarted();

  const normalizedInput = normalizeAudioSynthesisInput(input);
  const queue = getAudioSynthesisQueue();
  const job = await queue.add(
    {
      ...normalizedInput,
      options: normalizedInput.options || {},
      metadata: normalizedInput.metadata || {},
    },
    {
      ...AUDIO_SYNTHESIS_JOB_OPTIONS,
      jobId: normalizedInput.requestId,
    }
  );

  return {
    jobId: String(job.id),
    job,
  };
}

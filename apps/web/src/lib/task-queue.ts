// 一旦我被更新，请更新我的开头注释
// input: 任务入参与队列配置
// output: 队列入队/worker 启动能力
// pos: 任务基础设施
import Bull from "bull";
import { createHash } from "crypto";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import prisma, { ProcessingTask } from "@/lib/prisma";
import { jsonObject, mergeTaskData } from "@/lib/processing-task-utils";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";

const SCRIPT_QUEUE_NAME = "txt2voice:script-generation";
const AUDIO_QUEUE_NAME = "txt2voice:audio-generation";
const DEAD_LETTER_QUEUE_NAME = "txt2voice:dead-letter";

type QueueTaskType = "SCRIPT_GENERATION" | "AUDIO_GENERATION";
type BookFallbackStatus = "processed" | "script_generated";
type JobRuntimeState = "waiting" | "active" | "delayed" | "paused";

const HEARTBEAT_INTERVAL_MS = Number(
  process.env.TASK_HEARTBEAT_INTERVAL_MS || 10_000
);
const STALLED_TASK_THRESHOLD_MS = Number(
  process.env.TASK_STALLED_THRESHOLD_MS || 5 * 60 * 1_000
);
const RECOVERY_COOLDOWN_MS = Number(
  process.env.TASK_RECOVERY_COOLDOWN_MS || 60 * 1_000
);
const MAX_RECOVERY_BATCH = Number(process.env.TASK_RECOVERY_BATCH_SIZE || 20);

const RUNNING_STATES = new Set<JobRuntimeState>([
  "waiting",
  "active",
  "delayed",
  "paused",
]);

export interface ScriptGenerationQueueInput {
  taskId: string;
  bookId: string;
  options?: Partial<ScriptGenerationOptions>;
  extraParams?: ScriptGenerationExtraParams;
}

export interface AudioGenerationQueueInput {
  taskId: string;
  bookId: string;
  type: AudioGenerationTaskType;
  chapterId?: string;
  scriptSentenceIds?: string[];
  voiceProfileId?: string;
  autoMerge?: boolean;
  options?: AudioGenerationOptions;
}

interface ScriptGenerationJobData extends ScriptGenerationQueueInput {
  options: Partial<ScriptGenerationOptions>;
  extraParams: ScriptGenerationExtraParams;
  dedupeKey: string;
}

interface AudioGenerationJobData extends AudioGenerationQueueInput {
  autoMerge: boolean;
  options: AudioGenerationOptions;
  dedupeKey: string;
}

interface DeadLetterJobData {
  taskId: string;
  taskType: QueueTaskType;
  bookId: string;
  queueJobId: string;
  errorMessage: string;
  failedAt: string;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
}

interface TaskQueueState {
  scriptQueue: Bull.Queue<ScriptGenerationJobData> | null;
  audioQueue: Bull.Queue<AudioGenerationJobData> | null;
  deadLetterQueue: Bull.Queue<DeadLetterJobData> | null;
  workerStarted: boolean;
  recovering: boolean;
  lastRecoveryAt: number;
}

interface QueueAddResult<T> {
  job: Bull.Job<T>;
  reused: boolean;
  state: string;
}

interface QueueControlOptions {
  allowReuse?: boolean;
  reason?: string;
}

interface ReplayControlOptions {
  force?: boolean;
  reason?: string;
}

interface ReplayResult {
  taskId: string;
  taskType: QueueTaskType;
  jobId: string;
  reused: boolean;
  reason: string;
}

interface RecoveryResult {
  status: "ok" | "skipped";
  reason?: string;
  scanned: number;
  recovered: number;
  failed: number;
  staleBefore: string;
}

interface ScriptPayloadContainer {
  kind: "script";
  input: ScriptGenerationQueueInput;
}

interface AudioPayloadContainer {
  kind: "audio";
  input: AudioGenerationQueueInput;
}

type PayloadContainer = ScriptPayloadContainer | AudioPayloadContainer;

declare global {
  var __txt2voiceTaskQueueState: TaskQueueState | undefined;
}

const queueState: TaskQueueState = globalThis.__txt2voiceTaskQueueState ?? {
  scriptQueue: null,
  audioQueue: null,
  deadLetterQueue: null,
  workerStarted: false,
  recovering: false,
  lastRecoveryAt: 0,
};

globalThis.__txt2voiceTaskQueueState = queueState;

const SCRIPT_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
  timeout: 30 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

const AUDIO_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 15_000,
  },
  timeout: 120 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

const DEAD_LETTER_JOB_OPTIONS: Bull.JobOptions = {
  removeOnComplete: false,
  removeOnFail: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL 未配置，无法启动持久化任务队列");
  }
  return redisUrl;
}

function createQueue<T>(
  name: string,
  options?: {
    defaultJobOptions?: Bull.JobOptions;
  }
): Bull.Queue<T> {
  const queue = new Bull<T>(name, getRedisUrl(), {
    defaultJobOptions: options?.defaultJobOptions || {
      removeOnComplete: 500,
      removeOnFail: 1_000,
    },
    settings: {
      maxStalledCount: 2,
      stalledInterval: 30_000,
    },
  });

  queue.on("error", (error) => {
    console.error(`[task-queue] ${name} error`, error);
  });

  queue.on("stalled", (job) => {
    console.warn(`[task-queue] ${name} stalled`, {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    });
  });

  queue.on("completed", (job) => {
    console.log(`[task-queue] ${name} completed`, { jobId: job.id });
  });

  queue.on("failed", (job, error) => {
    console.error(`[task-queue] ${name} failed`, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: error?.message,
    });
  });

  return queue;
}

function getScriptQueue(): Bull.Queue<ScriptGenerationJobData> {
  if (!queueState.scriptQueue) {
    queueState.scriptQueue = createQueue<ScriptGenerationJobData>(
      SCRIPT_QUEUE_NAME
    );
  }
  return queueState.scriptQueue;
}

function getAudioQueue(): Bull.Queue<AudioGenerationJobData> {
  if (!queueState.audioQueue) {
    queueState.audioQueue = createQueue<AudioGenerationJobData>(
      AUDIO_QUEUE_NAME
    );
  }
  return queueState.audioQueue;
}

function getDeadLetterQueue(): Bull.Queue<DeadLetterJobData> {
  if (!queueState.deadLetterQueue) {
    queueState.deadLetterQueue = createQueue<DeadLetterJobData>(
      DEAD_LETTER_QUEUE_NAME,
      {
        defaultJobOptions: DEAD_LETTER_JOB_OPTIONS,
      }
    );
  }
  return queueState.deadLetterQueue;
}

function hashScope(payload: unknown): string {
  return createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}

function buildScriptDedupeKey(input: ScriptGenerationQueueInput): string {
  const normalized = {
    startFromSegmentId: input.extraParams?.startFromSegmentId || null,
    startFromOrderIndex: input.extraParams?.startFromOrderIndex ?? null,
    regenerateSegments: Boolean(input.extraParams?.regenerateSegments),
    segmentIds: (input.extraParams?.segmentIds || []).slice().sort(),
    limitToSegments: input.extraParams?.limitToSegments ?? null,
  };
  return `script:${input.bookId}:${hashScope(normalized)}`;
}

function buildAudioDedupeKey(input: AudioGenerationQueueInput): string {
  const normalized = {
    type: input.type,
    chapterId: input.chapterId || null,
    scriptSentenceIds: (input.scriptSentenceIds || []).slice().sort(),
    voiceProfileId: input.voiceProfileId || null,
    provider: input.options?.provider || null,
  };
  return `audio:${input.bookId}:${hashScope(normalized)}`;
}

function extractBackoffDelay(job: Bull.Job<any>): number | null {
  if (typeof job.opts.backoff === "number") {
    return job.opts.backoff;
  }
  if (
    job.opts.backoff &&
    typeof job.opts.backoff === "object" &&
    "delay" in job.opts.backoff &&
    typeof job.opts.backoff.delay === "number"
  ) {
    return job.opts.backoff.delay;
  }
  return null;
}

async function markTaskAttemptStart(taskId: string, job: Bull.Job<any>): Promise<void> {
  const taskData = await mergeTaskData(taskId, {
    message: "任务已进入执行队列",
    metadata: {
      queueJobId: String(job.id || taskId),
      queueAttempt: job.attemptsMade + 1,
      heartbeatAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "processing",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      taskData,
    },
  });
}

async function touchTaskHeartbeat(
  taskId: string,
  job: Bull.Job<any>
): Promise<void> {
  const taskData = await mergeTaskData(taskId, {
    metadata: {
      queueJobId: String(job.id || taskId),
      queueAttempt: job.attemptsMade + 1,
      heartbeatAt: new Date().toISOString(),
      workerPid: process.pid,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      taskData,
    },
  });
}

async function withTaskHeartbeat<T>(
  taskId: string,
  job: Bull.Job<any>,
  run: () => Promise<T>
): Promise<T> {
  await touchTaskHeartbeat(taskId, job);

  const timer = setInterval(() => {
    void touchTaskHeartbeat(taskId, job).catch((error) => {
      console.error("[task-queue] heartbeat update failed", {
        taskId,
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, HEARTBEAT_INTERVAL_MS);

  if (typeof (timer as any).unref === "function") {
    (timer as any).unref();
  }

  try {
    return await run();
  } finally {
    clearInterval(timer);
  }
}

async function addDeadLetter(params: {
  taskId: string;
  taskType: QueueTaskType;
  bookId: string;
  queueJobId: string;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const queue = getDeadLetterQueue();
    await queue.add(
      {
        ...params,
        failedAt: new Date().toISOString(),
      },
      {
        ...DEAD_LETTER_JOB_OPTIONS,
        jobId: `${params.taskId}:${Date.now()}`,
      }
    );
  } catch (error) {
    console.error("[task-queue] failed to write dead-letter", {
      taskId: params.taskId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function markTaskFailed(
  taskId: string,
  bookId: string,
  fallbackStatus: BookFallbackStatus,
  message: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const taskData = await mergeTaskData(taskId, {
    message: "任务执行失败",
    metadata,
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      taskData,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: { status: fallbackStatus },
  });
}

async function handleRetryState(
  job: Bull.Job<any>,
  taskId: string,
  errorMessage: string
): Promise<void> {
  const maxAttempts = job.opts.attempts ?? 1;
  const currentAttempt = job.attemptsMade + 1;
  const remaining = Math.max(maxAttempts - currentAttempt, 0);
  const retryDelayMs = extractBackoffDelay(job);

  const taskData = await mergeTaskData(taskId, {
    message: `任务执行失败，准备重试（剩余 ${remaining} 次）`,
    metadata: {
      retryAttempt: currentAttempt,
      retryRemaining: remaining,
      retryDelayMs,
      lastError: errorMessage,
      queueJobId: String(job.id),
      heartbeatAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "processing",
      errorMessage: null,
      taskData,
    },
  });
}

async function handleWorkerFailure(params: {
  taskType: QueueTaskType;
  job: Bull.Job<any>;
  taskId: string;
  bookId: string;
  fallbackStatus: BookFallbackStatus;
  error: unknown;
  payload: Record<string, unknown>;
}) {
  const { taskType, job, taskId, bookId, fallbackStatus, error, payload } = params;
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const maxAttempts = job.opts.attempts ?? 1;
  const currentAttempt = job.attemptsMade + 1;
  const isLastAttempt = currentAttempt >= maxAttempts;

  if (!isLastAttempt) {
    await handleRetryState(job, taskId, errorMessage);
    return;
  }

  await addDeadLetter({
    taskId,
    taskType,
    bookId,
    queueJobId: String(job.id),
    errorMessage,
    attempt: currentAttempt,
    maxAttempts,
    payload,
  });

  await markTaskFailed(taskId, bookId, fallbackStatus, errorMessage, {
    retryAttempt: currentAttempt,
    retryMaxAttempts: maxAttempts,
    queueJobId: String(job.id),
    lastError: errorMessage,
    pushedToDeadLetter: true,
  });
}

async function addOrReuseJob<T>(
  queue: Bull.Queue<T>,
  data: T,
  options: Bull.JobOptions,
  allowReuse: boolean
): Promise<QueueAddResult<T>> {
  const jobId = options.jobId ? String(options.jobId) : undefined;

  if (jobId) {
    const existing = await queue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();
      if (allowReuse && RUNNING_STATES.has(state as JobRuntimeState)) {
        return {
          job: existing,
          reused: true,
          state,
        };
      }

      try {
        await existing.remove();
      } catch (error) {
        console.warn("[task-queue] remove existing job failed", {
          queueName: queue.name,
          jobId,
          state,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const created = await queue.add(data, options);
  return {
    job: created,
    reused: false,
    state: "waiting",
  };
}

async function getQueueJobState(
  taskType: QueueTaskType,
  taskId: string
): Promise<{ state: string | null; exists: boolean }> {
  const queue = taskType === "SCRIPT_GENERATION" ? getScriptQueue() : getAudioQueue();
  const job = await queue.getJob(taskId);
  if (!job) {
    return { state: null, exists: false };
  }

  return {
    state: await job.getState(),
    exists: true,
  };
}

function buildScriptReplayPayloadFromTask(task: ProcessingTask): ScriptGenerationQueueInput {
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
      ? rawTaskData.segmentIds.filter(
          (value): value is string => typeof value === "string"
        )
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
}

function buildAudioReplayPayloadFromTask(
  task: ProcessingTask
): AudioGenerationQueueInput | null {
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
      ? metadata.scriptSentenceIds.filter(
          (value): value is string => typeof value === "string"
        )
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
    },
  };
}

function extractPayloadFromTask(task: ProcessingTask): PayloadContainer | null {
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
          extraParams:
            (asRecord(queuePayload.extraParams) || {}) as ScriptGenerationExtraParams,
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

  return null;
}

function isRecoverableTask(taskType: string): taskType is QueueTaskType {
  return taskType === "SCRIPT_GENERATION" || taskType === "AUDIO_GENERATION";
}

export async function ensureTaskWorkerStarted(): Promise<void> {
  if (queueState.workerStarted) {
    return;
  }

  const scriptQueue = getScriptQueue();
  const audioQueue = getAudioQueue();
  getDeadLetterQueue();

  scriptQueue.process(2, async (job: Bull.Job<ScriptGenerationJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, async () =>
        runScriptGenerationTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          options: job.data.options,
          extraParams: job.data.extraParams,
        })
      );
    } catch (error) {
      await handleWorkerFailure({
        taskType: "SCRIPT_GENERATION",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus: "processed",
        error,
        payload: {
          ...job.data,
        },
      });
      throw error;
    }
  });

  audioQueue.process(2, async (job: Bull.Job<AudioGenerationJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, async () =>
        runAudioGenerationTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          type: job.data.type,
          chapterId: job.data.chapterId,
          scriptSentenceIds: job.data.scriptSentenceIds,
          voiceProfileId: job.data.voiceProfileId,
          autoMerge: job.data.autoMerge,
          options: job.data.options,
        })
      );
    } catch (error) {
      await handleWorkerFailure({
        taskType: "AUDIO_GENERATION",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus: "script_generated",
        error,
        payload: {
          ...job.data,
        },
      });
      throw error;
    }
  });

  queueState.workerStarted = true;
}

export async function enqueueScriptGenerationJob(
  input: ScriptGenerationQueueInput,
  control: QueueControlOptions = {}
): Promise<{ jobId: string; dedupeKey: string; reused: boolean; state: string }> {
  await ensureTaskWorkerStarted();

  const normalizedInput: ScriptGenerationQueueInput = {
    taskId: input.taskId,
    bookId: input.bookId,
    options: input.options || {},
    extraParams: input.extraParams || {},
  };

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

  const normalizedInput: AudioGenerationQueueInput = {
    taskId: input.taskId,
    bookId: input.bookId,
    type: input.type,
    chapterId: input.chapterId,
    scriptSentenceIds: input.scriptSentenceIds,
    voiceProfileId: input.voiceProfileId,
    autoMerge: Boolean(input.autoMerge),
    options: input.options || {},
  };

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
          in: ["SCRIPT_GENERATION", "AUDIO_GENERATION"],
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

        if (queueStateResult.exists && queueStateResult.state && RUNNING_STATES.has(queueStateResult.state as JobRuntimeState)) {
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
          task.taskType === "SCRIPT_GENERATION" ? "processed" : "script_generated",
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

export async function getTaskQueueHealth(): Promise<Record<string, unknown>> {
  if (!process.env.REDIS_URL) {
    return {
      status: "unhealthy",
      message: "REDIS_URL 未配置",
    };
  }

  try {
    await ensureTaskWorkerStarted();

    const [scriptCounts, audioCounts, deadLetterCounts, recovery] = await Promise.all([
      getScriptQueue().getJobCounts(),
      getAudioQueue().getJobCounts(),
      getDeadLetterQueue().getJobCounts(),
      recoverStalledProcessingTasks(),
    ]);

    return {
      status: "healthy",
      message: "Task queue online",
      script: scriptCounts,
      audio: audioCounts,
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

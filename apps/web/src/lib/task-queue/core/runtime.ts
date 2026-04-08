import Bull from "bull";
import type { QueueTaskType } from "@/lib/task-queue/replay-payload";
import type { DeadLetterInput } from "@/lib/task-queue/worker-state";
import {
  AUDIO_QUEUE_NAME,
  AUDIO_SYNTHESIS_JOB_OPTIONS,
  AUDIO_SYNTHESIS_QUEUE_NAME,
  AUTO_PIPELINE_QUEUE_NAME,
  DEAD_LETTER_JOB_OPTIONS,
  DEAD_LETTER_QUEUE_NAME,
  LLM_JOB_OPTIONS,
  LLM_QUEUE_NAME,
  QUALITY_QUEUE_NAME,
  SIGNAL_SYNC_QUEUE_NAME,
  RUNNING_STATES,
  SCRIPT_QUEUE_NAME,
} from "./constants";
import type {
  AudioGenerationJobData,
  AudioSynthesisJobData,
  AutoPipelineJobData,
  DeadLetterJobData,
  JobRuntimeState,
  LLMExecutionJobData,
  QualityCheckJobData,
  QualitySignalSyncJobData,
  QueueAddResult,
  ScriptGenerationJobData,
  TaskQueueState,
} from "./types";

declare global {
  var __txt2voiceTaskQueueState: TaskQueueState | undefined;
}

export const queueState: TaskQueueState = globalThis.__txt2voiceTaskQueueState ?? {
  scriptQueue: null,
  audioQueue: null,
  audioSynthesisQueue: null,
  qualityQueue: null,
  signalSyncQueue: null,
  autoPipelineQueue: null,
  llmQueue: null,
  deadLetterQueue: null,
  workerStarted: false,
  recovering: false,
  lastRecoveryAt: 0,
};

globalThis.__txt2voiceTaskQueueState = queueState;

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

export function getScriptQueue(): Bull.Queue<ScriptGenerationJobData> {
  if (!queueState.scriptQueue) {
    queueState.scriptQueue = createQueue<ScriptGenerationJobData>(SCRIPT_QUEUE_NAME);
  }
  return queueState.scriptQueue;
}

export function getAudioQueue(): Bull.Queue<AudioGenerationJobData> {
  if (!queueState.audioQueue) {
    queueState.audioQueue = createQueue<AudioGenerationJobData>(AUDIO_QUEUE_NAME);
  }
  return queueState.audioQueue;
}

export function getAudioSynthesisQueue(): Bull.Queue<AudioSynthesisJobData> {
  if (!queueState.audioSynthesisQueue) {
    queueState.audioSynthesisQueue = createQueue<AudioSynthesisJobData>(
      AUDIO_SYNTHESIS_QUEUE_NAME,
      {
        defaultJobOptions: AUDIO_SYNTHESIS_JOB_OPTIONS,
      }
    );
  }
  return queueState.audioSynthesisQueue;
}

export function getQualityQueue(): Bull.Queue<QualityCheckJobData> {
  if (!queueState.qualityQueue) {
    queueState.qualityQueue = createQueue<QualityCheckJobData>(QUALITY_QUEUE_NAME);
  }
  return queueState.qualityQueue;
}

export function getSignalSyncQueue(): Bull.Queue<QualitySignalSyncJobData> {
  if (!queueState.signalSyncQueue) {
    queueState.signalSyncQueue = createQueue<QualitySignalSyncJobData>(SIGNAL_SYNC_QUEUE_NAME);
  }
  return queueState.signalSyncQueue;
}

export function getAutoPipelineQueue(): Bull.Queue<AutoPipelineJobData> {
  if (!queueState.autoPipelineQueue) {
    queueState.autoPipelineQueue = createQueue<AutoPipelineJobData>(
      AUTO_PIPELINE_QUEUE_NAME
    );
  }
  return queueState.autoPipelineQueue;
}

export function getLLMQueue(): Bull.Queue<LLMExecutionJobData> {
  if (!queueState.llmQueue) {
    queueState.llmQueue = createQueue<LLMExecutionJobData>(LLM_QUEUE_NAME, {
      defaultJobOptions: LLM_JOB_OPTIONS,
    });
  }
  return queueState.llmQueue;
}

export function getDeadLetterQueue(): Bull.Queue<DeadLetterJobData> {
  if (!queueState.deadLetterQueue) {
    queueState.deadLetterQueue = createQueue<DeadLetterJobData>(DEAD_LETTER_QUEUE_NAME, {
      defaultJobOptions: DEAD_LETTER_JOB_OPTIONS,
    });
  }
  return queueState.deadLetterQueue;
}

export async function addDeadLetter(params: DeadLetterInput): Promise<void> {
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

export async function addOrReuseJob<T>(
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

export async function getQueueJobState(
  taskType: QueueTaskType,
  taskId: string
): Promise<{ state: string | null; exists: boolean }> {
  const queue =
    taskType === "SCRIPT_GENERATION"
      ? getScriptQueue()
      : taskType === "AUDIO_GENERATION"
        ? getAudioQueue()
        : taskType === "QUALITY_CHECK"
          ? getQualityQueue()
          : taskType === "QUALITY_SIGNAL_SYNC"
            ? getSignalSyncQueue()
            : getAutoPipelineQueue();
  const job = await queue.getJob(taskId);
  if (!job) {
    return { state: null, exists: false };
  }

  return {
    state: await job.getState(),
    exists: true,
  };
}

export async function cancelProcessingTaskJob(
  taskType: QueueTaskType,
  taskId: string
): Promise<{ canceled: boolean; state: string | null; exists: boolean }> {
  const queue =
    taskType === "SCRIPT_GENERATION"
      ? getScriptQueue()
      : taskType === "AUDIO_GENERATION"
        ? getAudioQueue()
        : taskType === "QUALITY_CHECK"
          ? getQualityQueue()
          : taskType === "QUALITY_SIGNAL_SYNC"
            ? getSignalSyncQueue()
            : getAutoPipelineQueue();
  const job = await queue.getJob(taskId);

  if (!job) {
    return {
      canceled: false,
      state: null,
      exists: false,
    };
  }

  const state = await job.getState();
  if (!RUNNING_STATES.has(state as JobRuntimeState) || state === "active") {
    return {
      canceled: false,
      state,
      exists: true,
    };
  }

  try {
    await job.remove();
    return {
      canceled: true,
      state,
      exists: true,
    };
  } catch (error) {
    console.warn("[task-queue] cancel job failed", {
      queueName: queue.name,
      taskType,
      taskId,
      state,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      canceled: false,
      state,
      exists: true,
    };
  }
}

import type Bull from "bull";
import type { JobRuntimeState } from "./types";

export const TASK_QUEUE_NAMESPACE =
  process.env.TASK_QUEUE_NAMESPACE?.trim() ||
  `txt2voice:${(process.env.PORT || "3000").trim()}`;

export const LEGACY_QUEUE_NAMESPACE = "txt2voice";

export const SCRIPT_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:script-generation`;
export const AUDIO_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:audio-generation`;
export const AUDIO_SYNTHESIS_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:audio-synthesis`;
export const QUALITY_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:quality-check`;
export const SIGNAL_SYNC_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:quality-signal-sync`;
export const AUTO_PIPELINE_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:auto-pipeline`;
export const LLM_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:llm-execution`;
export const DEAD_LETTER_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:dead-letter`;

export const LLM_MAX_CONCURRENCY = Math.max(
  1,
  Number(process.env.LLM_MAX_CONCURRENCY || 4)
);

export const HEARTBEAT_INTERVAL_MS = Number(
  process.env.TASK_HEARTBEAT_INTERVAL_MS || 10_000
);
export const AUDIO_SYNTHESIS_MAX_CONCURRENCY = Math.max(
  1,
  Number(process.env.AUDIO_SYNTHESIS_MAX_CONCURRENCY || 6)
);
export const STALLED_TASK_THRESHOLD_MS = Number(
  process.env.TASK_STALLED_THRESHOLD_MS || 5 * 60 * 1_000
);
export const RECOVERY_COOLDOWN_MS = Number(
  process.env.TASK_RECOVERY_COOLDOWN_MS || 60 * 1_000
);
export const MAX_RECOVERY_BATCH = Number(process.env.TASK_RECOVERY_BATCH_SIZE || 20);

export const RUNNING_STATES = new Set<JobRuntimeState>([
  "waiting",
  "active",
  "delayed",
  "paused",
]);

export const SCRIPT_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
  timeout: 30 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

export const AUDIO_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 15_000,
  },
  timeout: 120 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

export const AUDIO_SYNTHESIS_JOB_OPTIONS: Bull.JobOptions = {
  attempts: Number(process.env.AUDIO_SYNTHESIS_JOB_MAX_ATTEMPTS || 3),
  backoff: {
    type: "exponential",
    delay: Number(process.env.AUDIO_SYNTHESIS_JOB_BACKOFF_DELAY_MS || 2_000),
  },
  timeout: Number(process.env.AUDIO_SYNTHESIS_JOB_TIMEOUT_MS || 10 * 60 * 1_000),
  removeOnComplete: 2_000,
  removeOnFail: 4_000,
};

export const QUALITY_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 2,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
  timeout: 30 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

export const SIGNAL_SYNC_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 2,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
  timeout: 30 * 60 * 1_000,
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

export const AUTO_PIPELINE_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 1,
  timeout: 180 * 60 * 1_000,
  removeOnComplete: 200,
  removeOnFail: 500,
};

export const AUTO_PIPELINE_COMPENSATION_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 6,
  backoff: {
    type: "exponential",
    delay: 30_000,
  },
  timeout: 5 * 60 * 1_000,
  removeOnComplete: 200,
  removeOnFail: 500,
};

export const LLM_JOB_OPTIONS: Bull.JobOptions = {
  attempts: Number(process.env.LLM_JOB_MAX_ATTEMPTS || 3),
  backoff: {
    type: "exponential",
    delay: Number(process.env.LLM_JOB_BACKOFF_DELAY_MS || 1_000),
  },
  timeout: Number(process.env.LLM_JOB_TIMEOUT_MS || 120_000),
  removeOnComplete: 1_000,
  removeOnFail: 2_000,
};

export const DEAD_LETTER_JOB_OPTIONS: Bull.JobOptions = {
  removeOnComplete: false,
  removeOnFail: false,
};

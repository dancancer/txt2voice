import type Bull from "bull";
import type { JobRuntimeState } from "./types";

export const TASK_QUEUE_NAMESPACE =
  process.env.TASK_QUEUE_NAMESPACE?.trim() ||
  `txt2voice:${(process.env.PORT || "3000").trim()}`;

export const LEGACY_QUEUE_NAMESPACE = "txt2voice";

export const SCRIPT_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:script-generation`;
export const AUDIO_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:audio-generation`;
export const DEAD_LETTER_QUEUE_NAME = `${TASK_QUEUE_NAMESPACE}:dead-letter`;

export const HEARTBEAT_INTERVAL_MS = Number(
  process.env.TASK_HEARTBEAT_INTERVAL_MS || 10_000
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

export const DEAD_LETTER_JOB_OPTIONS: Bull.JobOptions = {
  removeOnComplete: false,
  removeOnFail: false,
};

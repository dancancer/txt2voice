import type Bull from "bull";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { ScriptGenerationOptions } from "@/lib/script-generator";
import type { ScriptGenerationExtraParams } from "@/lib/script-generation-runner";
import type { QueueTaskType } from "@/lib/task-queue/replay-payload";

export type JobRuntimeState = "waiting" | "active" | "delayed" | "paused";

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

export interface ScriptGenerationJobData extends ScriptGenerationQueueInput {
  options: Partial<ScriptGenerationOptions>;
  extraParams: ScriptGenerationExtraParams;
  dedupeKey: string;
}

export interface AudioGenerationJobData extends AudioGenerationQueueInput {
  autoMerge: boolean;
  options: AudioGenerationOptions;
  dedupeKey: string;
}

export interface DeadLetterJobData {
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

export interface TaskQueueState {
  scriptQueue: Bull.Queue<ScriptGenerationJobData> | null;
  audioQueue: Bull.Queue<AudioGenerationJobData> | null;
  deadLetterQueue: Bull.Queue<DeadLetterJobData> | null;
  workerStarted: boolean;
  recovering: boolean;
  lastRecoveryAt: number;
}

export interface QueueAddResult<T> {
  job: Bull.Job<T>;
  reused: boolean;
  state: string;
}

export interface QueueControlOptions {
  allowReuse?: boolean;
  reason?: string;
}

export interface ReplayControlOptions {
  force?: boolean;
  reason?: string;
}

export interface ReplayResult {
  taskId: string;
  taskType: QueueTaskType;
  jobId: string;
  reused: boolean;
  reason: string;
}

export interface RecoveryResult {
  status: "ok" | "skipped";
  reason?: string;
  scanned: number;
  recovered: number;
  failed: number;
  staleBefore: string;
}

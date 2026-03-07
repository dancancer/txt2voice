import type Bull from "bull";
import type { AutoPipelineOptions } from "@/lib/auto-pipeline-runner";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioGenerationTaskType } from "@/lib/audio-generation-runner";
import type { QualityCheckTaskType } from "@/lib/quality-check-runner";
import type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync-runner";
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

export interface QualityCheckQueueInput {
  taskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}

export interface QualitySignalSyncQueueInput {
  taskId: string;
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  forceResync?: boolean;
  signalModelRuntime?: Record<string, unknown>;
}

export type AutoPipelineQueueMode = "pipeline" | "trigger_compensation";

export interface AutoPipelineQueueInput {
  taskId: string;
  bookId: string;
  options?: AutoPipelineOptions;
  mode?: AutoPipelineQueueMode;
  triggerSource?: string;
  triggerMetadata?: Record<string, unknown>;
  allowReuseRunningTask?: boolean;
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

export interface QualityCheckJobData extends QualityCheckQueueInput {
  audioFileIds: string[];
  dedupeKey: string;
}

export interface QualitySignalSyncJobData extends QualitySignalSyncQueueInput {
  audioFileIds: string[];
  forceResync: boolean;
  dedupeKey: string;
}

export interface AutoPipelineJobData extends AutoPipelineQueueInput {
  options: AutoPipelineOptions;
  mode: AutoPipelineQueueMode;
  triggerMetadata: Record<string, unknown>;
  allowReuseRunningTask: boolean;
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
  qualityQueue: Bull.Queue<QualityCheckJobData> | null;
  signalSyncQueue: Bull.Queue<QualitySignalSyncJobData> | null;
  autoPipelineQueue: Bull.Queue<AutoPipelineJobData> | null;
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

import type Bull from "bull";
import { runAutoPipelineTask } from "@/lib/auto-pipeline-runner";
import { runAutoPipelineCompensationTask } from "@/lib/auto-pipeline-compensation-runner";
import { runFinalAssemblyTask } from "@/lib/final-assembly-runner";
import { runManualReviewSyncTask } from "@/lib/manual-review-sync-runner";
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";
import { isTaskCanceledError } from "@/lib/task-cancellation";
import { runAudioSynthesisJob } from "@/lib/task-queue/ops/audio-synthesis-execute";
import { runLLMExecutionJob } from "@/lib/task-queue/ops/llm-execute";
import { runQualityCheckTask } from "@/lib/quality-check-runner";
import { runQualitySignalSyncTask } from "@/lib/quality-signal-sync-runner";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";
import {
  AUDIO_QUEUE_NAME,
  AUDIO_SYNTHESIS_MAX_CONCURRENCY,
  AUDIO_SYNTHESIS_QUEUE_NAME,
  AUTO_PIPELINE_QUEUE_NAME,
  HEARTBEAT_INTERVAL_MS,
  LLM_MAX_CONCURRENCY,
  LLM_QUEUE_NAME,
  QUALITY_QUEUE_NAME,
  SCRIPT_QUEUE_NAME,
  SIGNAL_SYNC_QUEUE_NAME,
  TASK_QUEUE_NAMESPACE,
} from "@/lib/task-queue/core/constants";
import {
  addDeadLetter,
  getAutoPipelineQueue,
  getAudioQueue,
  getAudioSynthesisQueue,
  getDeadLetterQueue,
  getLLMQueue,
  getQualityQueue,
  getScriptQueue,
  getSignalSyncQueue,
  queueState,
} from "@/lib/task-queue/core/runtime";
import type {
  AutoPipelineJobData,
  AudioGenerationJobData,
  AudioSynthesisJobData,
  LLMExecutionJobData,
  QualityCheckJobData,
  QualitySignalSyncJobData,
  ScriptGenerationJobData,
} from "@/lib/task-queue/core/types";
import {
  handleWorkerFailure,
  markTaskAttemptStart,
  withTaskHeartbeat,
} from "@/lib/task-queue/worker-state";

export async function ensureTaskWorkerStarted(): Promise<void> {
  if (queueState.workerStarted) {
    return;
  }

  const scriptQueue = getScriptQueue();
  const audioQueue = getAudioQueue();
  const audioSynthesisQueue = getAudioSynthesisQueue();
  const qualityQueue = getQualityQueue();
  const signalSyncQueue = getSignalSyncQueue();
  const autoPipelineQueue = getAutoPipelineQueue();
  const llmQueue = getLLMQueue();
  getDeadLetterQueue();

  console.info("[task-queue] worker started", {
    namespace: TASK_QUEUE_NAMESPACE,
    scriptQueue: SCRIPT_QUEUE_NAME,
    audioQueue: AUDIO_QUEUE_NAME,
    audioSynthesisQueue: AUDIO_SYNTHESIS_QUEUE_NAME,
    qualityQueue: QUALITY_QUEUE_NAME,
    signalSyncQueue: SIGNAL_SYNC_QUEUE_NAME,
    autoPipelineQueue: AUTO_PIPELINE_QUEUE_NAME,
    llmQueue: LLM_QUEUE_NAME,
  });

  scriptQueue.process(2, async (job: Bull.Job<ScriptGenerationJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () =>
        runScriptGenerationTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          options: job.data.options,
          extraParams: job.data.extraParams,
        })
      );
    } catch (error) {
      if (isTaskCanceledError(error)) {
        return;
      }
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
        addDeadLetter,
      });
      throw error;
    }
  });

  audioQueue.process(2, async (job: Bull.Job<AudioGenerationJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () =>
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
      if (isTaskCanceledError(error)) {
        return;
      }
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
        addDeadLetter,
      });
      throw error;
    }
  });

  audioSynthesisQueue.process(
    AUDIO_SYNTHESIS_MAX_CONCURRENCY,
    async (job: Bull.Job<AudioSynthesisJobData>) => {
      return runAudioSynthesisJob(job.data, {
        attempt: job.attemptsMade + 1,
        jobId: typeof job.id === "string" ? job.id : String(job.id || ""),
      });
    }
  );

  qualityQueue.process(2, async (job: Bull.Job<QualityCheckJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () =>
        runQualityCheckTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          type: job.data.type,
          chapterId: job.data.chapterId,
          audioFileIds: job.data.audioFileIds,
        })
      );
    } catch (error) {
      if (isTaskCanceledError(error)) {
        return;
      }
      await handleWorkerFailure({
        taskType: "QUALITY_CHECK",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus: "completed_with_errors",
        error,
        payload: {
          ...job.data,
        },
        addDeadLetter,
      });
      throw error;
    }
  });

  signalSyncQueue.process(2, async (job: Bull.Job<QualitySignalSyncJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () =>
        runQualitySignalSyncTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          type: job.data.type,
          chapterId: job.data.chapterId,
          audioFileIds: job.data.audioFileIds,
          forceResync: job.data.forceResync,
        })
      );
    } catch (error) {
      if (isTaskCanceledError(error)) {
        return;
      }
      await handleWorkerFailure({
        taskType: "QUALITY_SIGNAL_SYNC",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus: "completed",
        error,
        payload: {
          ...job.data,
        },
        addDeadLetter,
      });
      throw error;
    }
  });

  autoPipelineQueue.process(1, async (job: Bull.Job<AutoPipelineJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    const mode = job.data.mode || "pipeline";

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () => {
        if (mode === "trigger_compensation") {
          return runAutoPipelineCompensationTask({
            taskId: job.data.taskId,
            bookId: job.data.bookId,
            options: job.data.options,
            triggerSource: job.data.triggerSource,
            triggerMetadata: job.data.triggerMetadata,
            allowReuseRunningTask: job.data.allowReuseRunningTask,
          });
        }
        if (mode === "final_assembly") {
          const payload = job.data.workflowPayload || {};
          return runFinalAssemblyTask({
            taskId: job.data.taskId,
            bookId: job.data.bookId,
            type: (payload.type as any) || "book",
            chapterId: typeof payload.chapterId === "string" ? payload.chapterId : undefined,
            segmentId: typeof payload.segmentId === "string" ? payload.segmentId : undefined,
            options: (payload.options as any) || {},
          });
        }
        if (mode === "manual_review_sync") {
          const payload = job.data.workflowPayload || {};
          return runManualReviewSyncTask({
            taskId: job.data.taskId,
            bookId: job.data.bookId,
            autoTriggerFinalAssembly: payload.autoTriggerFinalAssembly !== false,
            finalAssemblyPayload:
              payload.finalAssembly && typeof payload.finalAssembly === "object"
                ? (payload.finalAssembly as Record<string, unknown>)
                : {},
          });
        }
        return runAutoPipelineTask({
          taskId: job.data.taskId,
          bookId: job.data.bookId,
          options: job.data.options,
        });
      });
    } catch (error) {
      if (isTaskCanceledError(error)) {
        return;
      }
      await handleWorkerFailure({
        taskType:
          mode === "trigger_compensation"
            ? "AUTO_PIPELINE_COMPENSATION"
            : mode === "final_assembly"
              ? "FINAL_ASSEMBLY"
              : mode === "manual_review_sync"
                ? "MANUAL_REVIEW_SYNC"
                : "AUTO_PIPELINE",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus:
          mode === "trigger_compensation"
            ? "uploaded"
            : mode === "manual_review_sync"
              ? "manual_review_pending"
              : "error",
        error,
        payload: {
          ...job.data,
        },
        addDeadLetter,
      });
      throw error;
    }
  });

  llmQueue.process(LLM_MAX_CONCURRENCY, async (job: Bull.Job<LLMExecutionJobData>) => {
    return runLLMExecutionJob(job.data, {
      attempt: job.attemptsMade + 1,
      jobId: typeof job.id === "string" ? job.id : String(job.id || ""),
    });
  });

  queueState.workerStarted = true;
}

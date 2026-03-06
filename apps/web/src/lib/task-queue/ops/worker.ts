import type Bull from "bull";
import { runAutoPipelineTask } from "@/lib/auto-pipeline-runner";
import { runAutoPipelineCompensationTask } from "@/lib/auto-pipeline-compensation-runner";
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";
import { runQualityCheckTask } from "@/lib/quality-check-runner";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";
import { warnIfLegacyNamespaceHasPendingJobs } from "@/lib/task-queue/namespace-check";
import {
  AUDIO_QUEUE_NAME,
  AUTO_PIPELINE_QUEUE_NAME,
  HEARTBEAT_INTERVAL_MS,
  LEGACY_QUEUE_NAMESPACE,
  QUALITY_QUEUE_NAME,
  SCRIPT_QUEUE_NAME,
  TASK_QUEUE_NAMESPACE,
} from "@/lib/task-queue/core/constants";
import {
  addDeadLetter,
  getAutoPipelineQueue,
  getAudioQueue,
  getDeadLetterQueue,
  getQualityQueue,
  getScriptQueue,
  queueState,
} from "@/lib/task-queue/core/runtime";
import type {
  AutoPipelineJobData,
  AudioGenerationJobData,
  QualityCheckJobData,
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
  const qualityQueue = getQualityQueue();
  const autoPipelineQueue = getAutoPipelineQueue();
  getDeadLetterQueue();

  console.info("[task-queue] worker started", {
    namespace: TASK_QUEUE_NAMESPACE,
    scriptQueue: SCRIPT_QUEUE_NAME,
    audioQueue: AUDIO_QUEUE_NAME,
    qualityQueue: QUALITY_QUEUE_NAME,
    autoPipelineQueue: AUTO_PIPELINE_QUEUE_NAME,
  });

  await warnIfLegacyNamespaceHasPendingJobs(
    audioQueue,
    TASK_QUEUE_NAMESPACE,
    LEGACY_QUEUE_NAMESPACE
  );

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

  autoPipelineQueue.process(1, async (job: Bull.Job<AutoPipelineJobData>) => {
    await markTaskAttemptStart(job.data.taskId, job);

    const isCompensation = job.data.mode === "trigger_compensation";

    try {
      await withTaskHeartbeat(job.data.taskId, job, HEARTBEAT_INTERVAL_MS, async () =>
        isCompensation
          ? runAutoPipelineCompensationTask({
              taskId: job.data.taskId,
              bookId: job.data.bookId,
              options: job.data.options,
              triggerSource: job.data.triggerSource,
              triggerMetadata: job.data.triggerMetadata,
              allowReuseRunningTask: job.data.allowReuseRunningTask,
            })
          : runAutoPipelineTask({
              taskId: job.data.taskId,
              bookId: job.data.bookId,
              options: job.data.options,
            })
      );
    } catch (error) {
      await handleWorkerFailure({
        taskType: isCompensation ? "AUTO_PIPELINE_COMPENSATION" : "AUTO_PIPELINE",
        job,
        taskId: job.data.taskId,
        bookId: job.data.bookId,
        fallbackStatus: isCompensation ? "uploaded" : "error",
        error,
        payload: {
          ...job.data,
        },
        addDeadLetter,
      });
      throw error;
    }
  });

  queueState.workerStarted = true;
}

import type Bull from "bull";
import { runAudioGenerationTask } from "@/lib/audio-generation-runner";
import { runScriptGenerationTask } from "@/lib/script-generation-runner";
import { warnIfLegacyNamespaceHasPendingJobs } from "@/lib/task-queue/namespace-check";
import {
  AUDIO_QUEUE_NAME,
  HEARTBEAT_INTERVAL_MS,
  LEGACY_QUEUE_NAMESPACE,
  SCRIPT_QUEUE_NAME,
  TASK_QUEUE_NAMESPACE,
} from "@/lib/task-queue/core/constants";
import {
  addDeadLetter,
  getAudioQueue,
  getDeadLetterQueue,
  getScriptQueue,
  queueState,
} from "@/lib/task-queue/core/runtime";
import type {
  AudioGenerationJobData,
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
  getDeadLetterQueue();

  console.info("[task-queue] worker started", {
    namespace: TASK_QUEUE_NAMESPACE,
    scriptQueue: SCRIPT_QUEUE_NAME,
    audioQueue: AUDIO_QUEUE_NAME,
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

  queueState.workerStarted = true;
}

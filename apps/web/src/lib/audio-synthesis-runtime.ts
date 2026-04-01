import { randomUUID } from "crypto";
import { toAudioJobError } from "@/lib/audio-job-error";
import {
  enqueueAudioSynthesisJob,
  type AudioSynthesisJobResult,
  type AudioSynthesisQueueInput,
} from "@/lib/task-queue";

export interface AudioSynthesisRuntimeRequest
  extends Omit<AudioSynthesisQueueInput, "requestId"> {
  requestId?: string;
}

export async function runAudioSynthesisRequest(
  request: AudioSynthesisRuntimeRequest
): Promise<AudioSynthesisJobResult> {
  const requestId = request.requestId || randomUUID();
  const { job } = await enqueueAudioSynthesisJob({
    requestId,
    request: request.request,
    options: request.options || {},
    metadata: request.metadata || {},
  });

  try {
    const result = (await job.finished()) as AudioSynthesisJobResult;
    const queueJobId = String(job.id);
    const waitMs =
      typeof job.processedOn === "number" && typeof job.timestamp === "number"
        ? Math.max(job.processedOn - job.timestamp, 0)
        : 0;
    const totalElapsedMs =
      typeof job.finishedOn === "number" && typeof job.timestamp === "number"
        ? Math.max(job.finishedOn - job.timestamp, 0)
        : 0;

    return {
      ...result,
      waitMs,
      totalElapsedMs,
      retriesUsed:
        typeof result.retriesUsed === "number"
          ? result.retriesUsed
          : Math.max(job.attemptsMade, 0),
      queueJobId,
      startedAt:
        typeof job.processedOn === "number"
          ? new Date(job.processedOn).toISOString()
          : null,
      finishedAt:
        typeof job.finishedOn === "number"
          ? new Date(job.finishedOn).toISOString()
          : null,
    };
  } catch (error) {
    throw toAudioJobError(error instanceof Error ? error.message : error);
  }
}

import { randomUUID } from "crypto";
import { toLLMJobError } from "@/lib/llm-job-error";
import {
  enqueueLLMExecutionJob,
  type LLMExecutionJobResult,
  type LLMExecutionQueueInput,
} from "@/lib/task-queue";

export interface LLMRuntimeRequest
  extends Omit<LLMExecutionQueueInput, "requestId"> {
  requestId?: string;
}

export async function runLLMRequest(
  request: LLMRuntimeRequest
): Promise<LLMExecutionJobResult> {
  const requestId = request.requestId || randomUUID();
  const { job } = await enqueueLLMExecutionJob({
    requestId,
    provider: request.provider,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    metadata: request.metadata || {},
    requestOptions: request.requestOptions || {},
  });

  try {
    const result = (await job.finished()) as LLMExecutionJobResult;
    const queueJobId = String(job.id);
    const waitMs =
      typeof job.processedOn === "number" && typeof job.timestamp === "number"
        ? Math.max(job.processedOn - job.timestamp, 0)
        : 0;
    const totalElapsedMs =
      typeof job.finishedOn === "number" && typeof job.timestamp === "number"
        ? Math.max(job.finishedOn - job.timestamp, result.latencyMs)
        : result.latencyMs;

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
    throw toLLMJobError(error instanceof Error ? error.message : error);
  }
}

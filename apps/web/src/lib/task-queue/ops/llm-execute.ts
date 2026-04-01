import { serializeLLMJobError } from "@/lib/llm-job-error";
import { executeProviderLLMCall } from "@/lib/llm-service";
import type {
  LLMExecutionJobData,
  LLMExecutionJobResult,
} from "@/lib/task-queue/core/types";

export interface LLMExecutionJobContext {
  attempt: number;
  jobId?: string;
}

export async function runLLMExecutionJob(
  data: LLMExecutionJobData,
  context: LLMExecutionJobContext
): Promise<LLMExecutionJobResult> {
  try {
    const result = await executeProviderLLMCall({
      provider: data.provider,
      prompt: data.prompt,
      systemPrompt: data.systemPrompt,
      requestOptions: data.requestOptions,
    });

    return {
      ...result,
      attempt: context.attempt,
      retriesUsed: Math.max(context.attempt - 1, 0),
    };
  } catch (error) {
    throw new Error(
      serializeLLMJobError(error, {
        provider: data.provider.name,
        attempt: context.attempt,
        retriesUsed: Math.max(context.attempt - 1, 0),
      })
    );
  }
}

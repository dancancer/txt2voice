import {
  getConfiguredLLMProvider,
  type LLMProvider,
} from "@/lib/llm-service";
import { runLLMRequest, type LLMRuntimeRequest } from "@/lib/llm-runtime";
import type { LLMExecutionRequestOptions } from "@/lib/task-queue";

export interface LLMAdapterRequest {
  prompt: string;
  systemPrompt?: string;
  provider?: LLMProvider;
  metadata?: Record<string, unknown>;
  requestOptions?: LLMExecutionRequestOptions;
  requestId?: string;
}

export interface LLMAdapterResponse {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: Record<string, unknown> | null;
  attempt: number;
  waitMs?: number;
  totalElapsedMs?: number;
  retriesUsed?: number;
  queueJobId?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface LLMAdapter {
  call(input: LLMAdapterRequest): Promise<LLMAdapterResponse>;
}

interface LLMAdapterDeps {
  runRequest: (request: LLMRuntimeRequest) => Promise<LLMAdapterResponse>;
  getProvider: () => LLMProvider;
}

const toAdapterResponse = (
  result: Awaited<ReturnType<typeof runLLMRequest>>
): LLMAdapterResponse => ({
  ...result,
  usage: result.usage ?? null,
});

export function createDefaultLLMAdapter(
  deps: Partial<LLMAdapterDeps> = {}
): LLMAdapter {
  const runRequest = deps.runRequest ?? runLLMRequest;
  const getProvider = deps.getProvider ?? getConfiguredLLMProvider;

  return {
    async call(input: LLMAdapterRequest): Promise<LLMAdapterResponse> {
      const result = await runRequest({
        requestId: input.requestId,
        provider: input.provider ?? getProvider(),
        prompt: input.prompt,
        systemPrompt: input.systemPrompt,
        metadata: input.metadata,
        requestOptions: input.requestOptions,
      });

      return toAdapterResponse(result);
    },
  };
}

export const defaultLLMAdapter = createDefaultLLMAdapter();

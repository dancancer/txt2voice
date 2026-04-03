import {
  resolveConfiguredLLMProvider,
  type LLMProvider,
} from "@/lib/llm-service";
import { runLLMRequest, type LLMRuntimeRequest } from "@/lib/llm-runtime";
import type { LLMExecutionRequestOptions } from "@/lib/task-queue";

export interface LLMAdapterRequest {
  prompt: string;
  systemPrompt?: string;
  provider?: LLMProvider;
  modelId?: string;
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
  waitMs: number;
  retriesUsed: number;
  totalElapsedMs: number;
}

export interface LLMAdapter {
  call(input: LLMAdapterRequest): Promise<LLMAdapterResponse>;
}

interface LLMAdapterDeps {
  runRequest: (
    request: LLMRuntimeRequest
  ) => Promise<Awaited<ReturnType<typeof runLLMRequest>>>;
  getProvider: (modelId?: string) => Promise<LLMProvider> | LLMProvider;
}

const toAdapterResponse = (
  result: Awaited<ReturnType<typeof runLLMRequest>>
): LLMAdapterResponse => ({
  content: result.content,
  provider: result.provider,
  model: result.model,
  latencyMs: result.latencyMs,
  usage: result.usage ?? null,
  attempt: typeof result.attempt === "number" ? result.attempt : 1,
  waitMs: typeof result.waitMs === "number" ? result.waitMs : 0,
  retriesUsed:
    typeof result.retriesUsed === "number" ? result.retriesUsed : 0,
  totalElapsedMs:
    typeof result.totalElapsedMs === "number"
      ? result.totalElapsedMs
      : result.latencyMs,
});

export function createDefaultLLMAdapter(
  deps: Partial<LLMAdapterDeps> = {}
): LLMAdapter {
  const runRequest = deps.runRequest ?? runLLMRequest;
  const getProvider = deps.getProvider ?? resolveConfiguredLLMProvider;

  return {
    async call(input: LLMAdapterRequest): Promise<LLMAdapterResponse> {
      const result = await runRequest({
        requestId: input.requestId,
        provider: input.provider ?? await getProvider(input.modelId),
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

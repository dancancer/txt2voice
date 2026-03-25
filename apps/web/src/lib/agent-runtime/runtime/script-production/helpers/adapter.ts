import { TTSError } from "@/lib/error-handler";
import type { LLMExecutionEvent } from "@/lib/llm-service";
import type { LLMAdapter } from "../../../adapters/llm-adapter";
import { asErrorMessage } from "./metadata";

export const createObservedAdapter = (params: {
  adapter: LLMAdapter;
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}): LLMAdapter => ({
  call: async (input) => {
    params.onExecutionEvent?.({
      status: "submitted",
      provider: input.provider?.name || "unknown",
      model: input.provider?.model || "unknown",
    });

    try {
      const result = await params.adapter.call(input);
      params.onExecutionEvent?.({
        status: "completed",
        content: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        attempt: result.attempt,
        usage: result.usage,
        waitMs: result.waitMs,
        retriesUsed: result.retriesUsed,
        totalElapsedMs: result.totalElapsedMs,
      });
      return result;
    } catch (error) {
      const details =
        error instanceof TTSError &&
        error.details &&
        typeof error.details === "object" &&
        !Array.isArray(error.details)
          ? (error.details as Record<string, unknown>)
          : {};
      const attempt =
        typeof details.attempt === "number" ? Number(details.attempt) : 1;
      const retriesUsed =
        typeof details.retriesUsed === "number"
          ? Number(details.retriesUsed)
          : Math.max(attempt - 1, 0);

      params.onExecutionEvent?.({
        status: "failed",
        provider:
          error instanceof TTSError
            ? error.provider
            : input.provider?.name || "unknown",
        retryable: error instanceof TTSError ? error.retryable : true,
        attempt,
        retriesUsed,
        message: asErrorMessage(error),
      });
      throw error;
    }
  },
});

export const createObservedDefaultAdapter = (params: {
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}): LLMAdapter => {
  let runtimePromise: Promise<{
    adapter: LLMAdapter;
    provider: {
      name: string;
      apiKey: string;
      baseURL?: string;
      model: string;
    };
  }> | null = null;

  const loadRuntime = async () => {
    if (!runtimePromise) {
      runtimePromise = Promise.all([
        import("../../../adapters/llm-adapter"),
        import("@/lib/llm-service"),
      ]).then(([adapterModule, llmServiceModule]) => {
        const provider = llmServiceModule.getConfiguredLLMProvider();
        return {
          adapter: adapterModule.createDefaultLLMAdapter(),
          provider,
        };
      });
    }

    return runtimePromise;
  };

  return {
    async call(input) {
      const runtime = await loadRuntime();
      const provider = input.provider ?? runtime.provider;

      return createObservedAdapter({
        adapter: runtime.adapter,
        onExecutionEvent: params.onExecutionEvent,
      }).call({
        ...input,
        provider,
      });
    },
  };
};

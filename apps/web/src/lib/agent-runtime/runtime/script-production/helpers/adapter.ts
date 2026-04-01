import { TTSError } from "@/lib/error-handler";
import type { LLMExecutionEvent } from "@/lib/llm-service";
import type { LLMAdapter } from "../../../adapters/llm-adapter";
import type { ExecutionEvent } from "../../../protocol/events";
import { asErrorMessage } from "./metadata";

interface AdapterTraceContext {
  workflowRunId: string;
  createId: () => string;
  appendTrace: (event: ExecutionEvent) => Promise<void> | void;
  now?: () => Date;
}

const asTracePayload = (input: {
  stageId?: unknown;
  source?: unknown;
  provider?: string;
  model?: string;
  contentLength?: number;
}) => ({
  ...(typeof input.stageId === "string" ? { stageId: input.stageId } : {}),
  ...(typeof input.source === "string" ? { source: input.source } : {}),
  ...(input.provider ? { provider: input.provider } : {}),
  ...(input.model ? { model: input.model } : {}),
  ...(typeof input.contentLength === "number"
    ? { contentLength: input.contentLength }
    : {}),
});

const appendAdapterTrace = async (params: {
  trace?: AdapterTraceContext;
  kind: string;
  status: "started" | "completed" | "failed";
  payload: Record<string, unknown>;
}) => {
  if (!params.trace) {
    return;
  }

  await params.trace.appendTrace({
    id: params.trace.createId(),
    kind: params.kind,
    createdAt: (params.trace.now ?? (() => new Date()))().toISOString(),
    workflowRunId: params.trace.workflowRunId,
    status: params.status,
    payload: params.payload,
  });
};

export const createObservedAdapter = (params: {
  adapter: LLMAdapter;
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
  trace?: AdapterTraceContext;
}): LLMAdapter => ({
  call: async (input) => {
    params.onExecutionEvent?.({
      status: "submitted",
      provider: input.provider?.name || "unknown",
      model: input.provider?.model || "unknown",
    });
    await appendAdapterTrace({
      trace: params.trace,
      kind: "llm_requested",
      status: "started",
      payload: asTracePayload({
        stageId: input.metadata?.stageId,
        source: input.metadata?.source,
        provider: input.provider?.name || "unknown",
        model: input.provider?.model || "unknown",
      }),
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
      await appendAdapterTrace({
        trace: params.trace,
        kind: "structured_output_received",
        status: "completed",
        payload: asTracePayload({
          stageId: input.metadata?.stageId,
          source: input.metadata?.source,
          provider: result.provider,
          model: result.model,
          contentLength: result.content.length,
        }),
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
  trace?: AdapterTraceContext;
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
        trace: params.trace,
      }).call({
        ...input,
        provider,
      });
    },
  };
};

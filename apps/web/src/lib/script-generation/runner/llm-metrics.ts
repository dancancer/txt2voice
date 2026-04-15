import type { LLMExecutionEvent } from "@/lib/llm/events";
import type { ScriptGenerationLLMMetrics } from "@/lib/script-generation/runner/types";

export const createLLMMetricsCollector = () => {
  const providerBuckets = new Map<
    string,
    {
      submitted: number;
      completed: number;
      failed: number;
      retried: number;
      totalLatencyMs: number;
      totalWaitMs: number;
    }
  >();
  let submitted = 0;
  let completed = 0;
  let failed = 0;
  let retried = 0;
  let totalLatencyMs = 0;
  let totalWaitMs = 0;

  const getBucket = (provider: string) => {
    const key = provider.trim() || "unknown";
    const existing = providerBuckets.get(key);
    if (existing) {
      return existing;
    }

    const created = {
      submitted: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      totalLatencyMs: 0,
      totalWaitMs: 0,
    };
    providerBuckets.set(key, created);
    return created;
  };

  return {
    observe(event: LLMExecutionEvent) {
      const bucket = getBucket(event.provider);
      if (event.status === "submitted") {
        submitted += 1;
        bucket.submitted += 1;
        return;
      }

      const retriesUsed =
        typeof event.retriesUsed === "number"
          ? Math.max(event.retriesUsed, 0)
          : typeof event.attempt === "number"
            ? Math.max(event.attempt - 1, 0)
            : 0;

      retried += retriesUsed;
      bucket.retried += retriesUsed;

      if (event.status === "completed") {
        completed += 1;
        bucket.completed += 1;
        totalLatencyMs += event.latencyMs;
        bucket.totalLatencyMs += event.latencyMs;
        totalWaitMs += event.waitMs || 0;
        bucket.totalWaitMs += event.waitMs || 0;
        return;
      }

      failed += 1;
      bucket.failed += 1;
    },

    snapshot(): ScriptGenerationLLMMetrics {
      return {
        submitted,
        completed,
        failed,
        retried,
        averageLatencyMs: completed > 0 ? Math.round(totalLatencyMs / completed) : 0,
        averageWaitMs: completed > 0 ? Math.round(totalWaitMs / completed) : 0,
        providers: Array.from(providerBuckets.entries())
          .map(([provider, bucket]) => ({
            provider,
            submitted: bucket.submitted,
            completed: bucket.completed,
            failed: bucket.failed,
            retried: bucket.retried,
            averageLatencyMs:
              bucket.completed > 0
                ? Math.round(bucket.totalLatencyMs / bucket.completed)
                : 0,
            averageWaitMs:
              bucket.completed > 0
                ? Math.round(bucket.totalWaitMs / bucket.completed)
                : 0,
          }))
          .sort((left, right) => left.provider.localeCompare(right.provider)),
      };
    },
  };
};

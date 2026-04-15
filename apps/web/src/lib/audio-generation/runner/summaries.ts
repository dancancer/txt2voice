import type {
  AudioChildJobMetrics,
  RouterDecisionSummary,
} from "@/lib/audio-generation/runner/types";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const extractRouterDecisionField = (
  metadata: unknown,
  field: "selectedEngine" | "selectedSource"
): string | null => {
  const metadataRecord = asRecord(metadata);
  const decision = asRecord(metadataRecord?.routerDecision);
  const value = decision && typeof decision[field] === "string" ? decision[field].trim() : "";
  return value.length > 0 ? value : null;
};

const resolveAudioChildJobProvider = (
  result: Record<string, unknown>,
  fallbackProvider?: string | null
): string => {
  const directProvider =
    typeof result.provider === "string" && result.provider.trim().length > 0
      ? result.provider.trim().toLowerCase()
      : null;
  if (directProvider) {
    return directProvider;
  }

  const metadataProvider = extractRouterDecisionField(result.metadata, "selectedEngine");
  if (metadataProvider) {
    return metadataProvider.toLowerCase();
  }

  if (typeof fallbackProvider === "string" && fallbackProvider.trim().length > 0) {
    return fallbackProvider.trim().toLowerCase();
  }

  return "unknown";
};

export const summarizeAudioChildJobs = (
  results: any[],
  fallbackProvider?: string | null
): AudioChildJobMetrics => {
  const providerMap = new Map<
    string,
    {
      submitted: number;
      completed: number;
      failed: number;
      retried: number;
      totalWaitMs: number;
      totalLatencyMs: number;
      observedCount: number;
    }
  >();

  let completed = 0;
  let failed = 0;
  let retried = 0;
  let totalWaitMs = 0;
  let totalLatencyMs = 0;
  let observedCount = 0;

  for (const result of results) {
    const provider = resolveAudioChildJobProvider(result || {}, fallbackProvider);
    const bucket = providerMap.get(provider) || {
      submitted: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      totalWaitMs: 0,
      totalLatencyMs: 0,
      observedCount: 0,
    };

    bucket.submitted += 1;
    const resultRetries =
      typeof result?.retriesUsed === "number" ? Math.max(result.retriesUsed, 0) : 0;
    retried += resultRetries;
    bucket.retried += resultRetries;

    const waitMs = typeof result?.waitMs === "number" ? Math.max(result.waitMs, 0) : 0;
    const latencyMs =
      typeof result?.totalElapsedMs === "number"
        ? Math.max(result.totalElapsedMs, 0)
        : 0;

    totalWaitMs += waitMs;
    totalLatencyMs += latencyMs;
    observedCount += 1;
    bucket.totalWaitMs += waitMs;
    bucket.totalLatencyMs += latencyMs;
    bucket.observedCount += 1;

    if (result?.success === true) {
      completed += 1;
      bucket.completed += 1;
    } else {
      failed += 1;
      bucket.failed += 1;
    }

    providerMap.set(provider, bucket);
  }

  return {
    submitted: results.length,
    completed,
    failed,
    retried,
    averageWaitMs: observedCount > 0 ? Math.round(totalWaitMs / observedCount) : 0,
    averageLatencyMs:
      observedCount > 0 ? Math.round(totalLatencyMs / observedCount) : 0,
    providers: Array.from(providerMap.entries())
      .map(([provider, bucket]) => ({
        provider,
        submitted: bucket.submitted,
        completed: bucket.completed,
        failed: bucket.failed,
        retried: bucket.retried,
        averageWaitMs:
          bucket.observedCount > 0
            ? Math.round(bucket.totalWaitMs / bucket.observedCount)
            : 0,
        averageLatencyMs:
          bucket.observedCount > 0
            ? Math.round(bucket.totalLatencyMs / bucket.observedCount)
            : 0,
      }))
      .sort((left, right) => left.provider.localeCompare(right.provider)),
  };
};

export const summarizeRouterDecisions = (results: any[]): RouterDecisionSummary => {
  const engineMap = new Map<
    string,
    {
      engine: string;
      total: number;
      success: number;
      failed: number;
      fallbackCount: number;
    }
  >();
  const sourceMap = new Map<
    string,
    {
      source: string;
      total: number;
      success: number;
      failed: number;
    }
  >();
  const policyVersionMap = new Map<string, { policyVersion: string; total: number }>();

  let decisionCount = 0;
  let fallbackCount = 0;

  for (const result of results) {
    const metadata = asRecord(result?.metadata);
    const decision = asRecord(metadata?.routerDecision);
    if (!decision) {
      continue;
    }

    decisionCount += 1;
    const success = Boolean(result?.success);
    const selectedEngine =
      (typeof decision.selectedEngine === "string" &&
        decision.selectedEngine.trim().toLowerCase()) ||
      "unknown";
    const selectedSource =
      (typeof decision.selectedSource === "string" &&
        decision.selectedSource.trim().toLowerCase()) ||
      "unknown";
    const fallback = decision.isFallback === true;
    const policyVersion =
      (typeof decision.policyVersion === "string" && decision.policyVersion.trim()) ||
      "unknown";

    if (fallback) {
      fallbackCount += 1;
    }

    const engineBucket = engineMap.get(selectedEngine) || {
      engine: selectedEngine,
      total: 0,
      success: 0,
      failed: 0,
      fallbackCount: 0,
    };
    engineBucket.total += 1;
    if (success) engineBucket.success += 1;
    else engineBucket.failed += 1;
    if (fallback) engineBucket.fallbackCount += 1;
    engineMap.set(selectedEngine, engineBucket);

    const sourceBucket = sourceMap.get(selectedSource) || {
      source: selectedSource,
      total: 0,
      success: 0,
      failed: 0,
    };
    sourceBucket.total += 1;
    if (success) sourceBucket.success += 1;
    else sourceBucket.failed += 1;
    sourceMap.set(selectedSource, sourceBucket);

    const policyBucket = policyVersionMap.get(policyVersion) || {
      policyVersion,
      total: 0,
    };
    policyBucket.total += 1;
    policyVersionMap.set(policyVersion, policyBucket);
  }

  return {
    totalResults: results.length,
    decisionCount,
    fallbackCount,
    byEngine: Array.from(engineMap.values()).sort((left, right) => right.total - left.total),
    bySource: Array.from(sourceMap.values()).sort((left, right) => right.total - left.total),
    byPolicyVersion: Array.from(policyVersionMap.values()).sort(
      (left, right) => right.total - left.total
    ),
  };
};

import {
  AudioRetryPass,
  buildAudioRetryPass,
  buildNextAudioRetryPass,
} from "@/lib/audio-retry-plan";

import {
  type AudioBatchGenerationSummary,
  type AudioBatchGenerationHooks,
  type AudioGenerationOptions,
  type AudioGenerationRequest,
  type AudioGenerationResult,
  type AudioReliabilityPassSummary,
  asRecord,
} from "../types";

async function runBatchPass(params: {
  requests: AudioGenerationRequest[];
  options: AudioGenerationOptions;
  defaultOptions: AudioGenerationOptions;
  generateSingleAudio: (
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ) => Promise<AudioGenerationResult>;
}): Promise<AudioGenerationResult[]> {
  const finalOptions = { ...params.defaultOptions, ...params.options };
  const results: AudioGenerationResult[] = [];
  const batchSize = finalOptions.batchSize || 5;

  for (let index = 0; index < params.requests.length; index += batchSize) {
    const batch = params.requests.slice(index, index + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((request) => params.generateSingleAudio(request, finalOptions))
    );

    batchResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error:
            result.reason instanceof Error ? result.reason.message : "Unknown error",
        });
      }
    });

    if (index + batchSize < params.requests.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, finalOptions.retryDelay || 1000)
      );
    }
  }

  return results;
}

function calculateFirstPassSuccessRate(
  passSummaries: AudioReliabilityPassSummary[]
): number {
  const firstPass = passSummaries[0];
  if (!firstPass || firstPass.requestCount === 0) {
    return 0;
  }

  return Number((firstPass.successCount / firstPass.requestCount).toFixed(4));
}

function calculateAverageDurationMs(results: AudioGenerationResult[]): number {
  const completed = results.filter(
    (result): result is AudioGenerationResult & { duration: number } =>
      result.success === true &&
      typeof result.duration === "number" &&
      result.duration >= 0
  );

  if (completed.length === 0) {
    return 0;
  }

  const totalDurationMs = completed.reduce(
    (sum, result) => sum + Math.round(result.duration * 1000),
    0
  );

  return Math.round(totalDurationMs / completed.length);
}

function summarizeProviderFailures(
  results: AudioGenerationResult[],
  fallbackProvider?: string
) {
  const providerFailures = new Map<string, number>();

  for (const result of results) {
    if (result.success) {
      continue;
    }

    const routerDecision =
      result.metadata && typeof result.metadata === "object"
        ? asRecord(
            (result.metadata as Record<string, unknown>).routerDecision as any
          )
        : undefined;
    const provider =
      (typeof routerDecision?.selectedEngine === "string" &&
        routerDecision.selectedEngine.trim().toLowerCase()) ||
      (typeof fallbackProvider === "string" && fallbackProvider.trim().toLowerCase()) ||
      "unknown";

    providerFailures.set(provider, (providerFailures.get(provider) || 0) + 1);
  }

  return Array.from(providerFailures.entries())
    .map(([provider, failed]) => ({ provider, failed }))
    .sort((left, right) => right.failed - left.failed);
}

export async function generateBatchAudioWithReliability(params: {
  requests: AudioGenerationRequest[];
  options: AudioGenerationOptions;
  defaultOptions: AudioGenerationOptions;
  hooks?: AudioBatchGenerationHooks;
  generateSingleAudio: (
    request: AudioGenerationRequest,
    options: AudioGenerationOptions
  ) => Promise<AudioGenerationResult>;
}): Promise<AudioBatchGenerationSummary> {
  const { requests, options, defaultOptions, generateSingleAudio } = params;
  const getRequestId = (request: AudioGenerationRequest) => request.scriptSentenceId;
  const finalOptions = { ...defaultOptions, ...options };
  const finalResults = new Map<string, AudioGenerationResult>();
  const attemptedResults: AudioGenerationResult[] = [];
  const passSummaries: AudioReliabilityPassSummary[] = [];

  if (requests.length === 0) {
    return {
      results: [],
      reliability: {
        policyProvider:
          typeof finalOptions.provider === "string" && finalOptions.provider.trim()
            ? finalOptions.provider.trim().toLowerCase()
            : "mixed",
        firstPassSuccessRate: 0,
        retryRounds: 0,
        averageDurationMs: 0,
        providerFailures: [],
        passSummaries: [],
      },
    };
  }

  let pass: AudioRetryPass<AudioGenerationRequest> | null = buildAudioRetryPass({
    provider: finalOptions.provider,
    passName: "pass-1",
    requests,
    getRequestId,
  });

  while (pass) {
    const passStartedAt = Date.now();
    const passResults = await runBatchPass({
      requests: pass.requests,
      options: {
        ...finalOptions,
        batchSize: pass.concurrency,
        retryDelay: pass.cooldownMs,
      },
      defaultOptions,
      generateSingleAudio,
    });

    attemptedResults.push(...passResults);
    pass.requests.forEach((request, index) => {
      finalResults.set(
        getRequestId(request),
        passResults[index] || {
          success: false,
          error: "Unknown error",
        }
      );
    });

    const successCount = passResults.filter((result) => result.success).length;
    passSummaries.push({
      passName: pass.passName,
      requestCount: pass.requests.length,
      successCount,
      failedCount: pass.requests.length - successCount,
      concurrency: pass.concurrency,
      durationMs: Date.now() - passStartedAt,
    });

    const latestPassSummary = passSummaries[passSummaries.length - 1];
    if (latestPassSummary) {
      await params.hooks?.onPassComplete?.(latestPassSummary);
    }

    pass = buildNextAudioRetryPass({
      provider: finalOptions.provider,
      previousPass: pass,
      results: passResults,
      getRequestId,
    });
  }

  const orderedResults = requests.map(
    (request) =>
      finalResults.get(getRequestId(request)) || {
        success: false,
        error: "Unknown error",
      }
  );

  return {
    results: orderedResults,
    reliability: {
      policyProvider:
        typeof finalOptions.provider === "string" && finalOptions.provider.trim()
          ? finalOptions.provider.trim().toLowerCase()
          : "mixed",
      firstPassSuccessRate: calculateFirstPassSuccessRate(passSummaries),
      retryRounds: Math.max(0, passSummaries.length - 1),
      averageDurationMs: calculateAverageDurationMs(orderedResults),
      providerFailures: summarizeProviderFailures(
        attemptedResults,
        finalOptions.provider
      ),
      passSummaries,
    },
  };
}

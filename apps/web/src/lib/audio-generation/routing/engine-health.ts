import type prisma from "@/lib/prisma";
import type { AudioRouteEngineHealth } from "@/lib/audio-engine-router";

import type { EngineHealthCacheValue } from "../types";

const ENGINE_HEALTH_CACHE_TTL_MS = 60 * 1000;
const ENGINE_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;
const engineHealthCache = new Map<string, EngineHealthCacheValue>();

export async function getEngineHealthSnapshot(params: {
  bookId: string;
  providers: string[];
  prismaClient: typeof prisma;
}): Promise<Record<string, AudioRouteEngineHealth>> {
  const { bookId, providers, prismaClient } = params;

  if (providers.length === 0) {
    return {};
  }

  const cacheKey = `${bookId}:${providers.slice().sort().join(",")}`;
  const now = Date.now();
  const cached = engineHealthCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  const attempts = await prismaClient.synthesisAttempt.findMany({
    where: {
      bookId,
      engine: {
        in: providers,
      },
      startedAt: {
        gte: new Date(now - ENGINE_HEALTH_WINDOW_MS),
      },
    },
    select: {
      engine: true,
      status: true,
      errorCode: true,
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 300,
  });

  const snapshot: Record<string, AudioRouteEngineHealth> = {};
  for (const provider of providers) {
    const providerAttempts = attempts.filter((attempt) => attempt.engine === provider);
    const total = providerAttempts.length;
    const failed = providerAttempts.filter((attempt) => attempt.status === "failed").length;
    const timeoutFailed = providerAttempts.filter((attempt) => {
      if (attempt.status !== "failed") {
        return false;
      }

      const code =
        typeof attempt.errorCode === "string" ? attempt.errorCode.toUpperCase() : "";
      return code.includes("TIMEOUT") || code.includes("RATE_LIMIT");
    }).length;
    const failureRate = total > 0 ? Number((failed / total).toFixed(4)) : 0;
    const timeoutRate = total > 0 ? Number((timeoutFailed / total).toFixed(4)) : 0;

    snapshot[provider] = {
      provider,
      sampleSize: total,
      failureRate,
      timeoutRate,
      healthy: total < 5 || (failureRate <= 0.45 && timeoutRate <= 0.25),
      updatedAt: new Date(now).toISOString(),
    };
  }

  engineHealthCache.set(cacheKey, {
    expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
    snapshot,
  });

  return snapshot;
}

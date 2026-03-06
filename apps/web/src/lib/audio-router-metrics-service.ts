// 一旦我被更新，请更新我的开头注释
// input: 路由指标查询参数/数据库依赖
// output: 音频路由命中与降级聚合结果
// pos: 音频引擎路由观测服务
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;

export interface AudioRouterMetricsQuery {
  windowDays: number;
  source?: string;
  engine?: string;
  policyVersion?: string;
}

interface MutableMetricBucket {
  total: number;
  success: number;
  failed: number;
  fallbackCount: number;
  fallbackSuccessCount: number;
  decisionCount: number;
}

export interface AudioRouterMetricsResult {
  window: {
    days: number;
    since: string;
    until: string;
  };
  filter: {
    source: string | null;
    engine: string | null;
    policyVersion: string | null;
  };
  totals: MutableMetricBucket & {
    decisionCoverageRate: number;
    failureRate: number;
    fallbackRate: number;
  };
  byEngine: Array<
    MutableMetricBucket & {
      engine: string;
      decisionCoverageRate: number;
      failureRate: number;
      fallbackRate: number;
    }
  >;
  bySource: Array<
    MutableMetricBucket & {
      source: string;
      decisionCoverageRate: number;
      failureRate: number;
      fallbackRate: number;
    }
  >;
  byPolicyVersion: Array<{
    policyVersion: string;
    total: number;
    fallbackCount: number;
    failed: number;
  }>;
  topRules: Array<{
    rule: string;
    count: number;
  }>;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeSource = (value: string): string => value.trim().toLowerCase();
const normalizeEngine = (value: string): string => value.trim().toLowerCase();

const initMetricBucket = (): MutableMetricBucket => ({
  total: 0,
  success: 0,
  failed: 0,
  fallbackCount: 0,
  fallbackSuccessCount: 0,
  decisionCount: 0,
});

const withRates = <T extends MutableMetricBucket>(bucket: T) => {
  const total = bucket.total;
  return {
    ...bucket,
    decisionCoverageRate: total > 0 ? Number((bucket.decisionCount / total).toFixed(4)) : 0,
    failureRate: total > 0 ? Number((bucket.failed / total).toFixed(4)) : 0,
    fallbackRate: total > 0 ? Number((bucket.fallbackCount / total).toFixed(4)) : 0,
  };
};

const parseWindowDays = (value: string | null): number => {
  if (!value) {
    return DEFAULT_WINDOW_DAYS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_WINDOW_DAYS) {
    throw new ValidationError(`days 必须是 1-${MAX_WINDOW_DAYS} 的整数`);
  }

  return parsed;
};

export const parseAudioRouterMetricsQuery = (
  searchParams: URLSearchParams
): AudioRouterMetricsQuery => {
  const source = asString(searchParams.get("source"));
  const engine = asString(searchParams.get("engine"));
  const policyVersion = asString(searchParams.get("policyVersion"));

  return {
    windowDays: parseWindowDays(searchParams.get("days")),
    source: source ? normalizeSource(source) : undefined,
    engine: engine ? normalizeEngine(engine) : undefined,
    policyVersion,
  };
};

const resolveDecision = (requestPayload: unknown) => {
  const payload = asRecord(requestPayload);
  const decision = asRecord(payload?.routerDecision);

  return {
    exists: Boolean(decision),
    source: normalizeSource(asString(decision?.selectedSource) || "unknown"),
    engine: normalizeEngine(asString(decision?.selectedEngine) || "unknown"),
    rule: asString(decision?.selectedRule) || "unknown",
    policyVersion: asString(decision?.policyVersion) || "unknown",
    isFallback: decision?.isFallback === true,
  };
};

const upsertMetricBucket = <T>(
  map: Map<string, T>,
  key: string,
  create: () => T
): T => {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const next = create();
  map.set(key, next);
  return next;
};

const applyMetric = ({
  bucket,
  success,
  isFallback,
  hasDecision,
}: {
  bucket: MutableMetricBucket;
  success: boolean;
  isFallback: boolean;
  hasDecision: boolean;
}) => {
  bucket.total += 1;
  if (success) {
    bucket.success += 1;
  } else {
    bucket.failed += 1;
  }
  if (hasDecision) {
    bucket.decisionCount += 1;
  }
  if (isFallback) {
    bucket.fallbackCount += 1;
    if (success) {
      bucket.fallbackSuccessCount += 1;
    }
  }
};

export const getAudioRouterMetrics = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: AudioRouterMetricsQuery;
}): Promise<AudioRouterMetricsResult> => {
  const until = new Date();
  const since = new Date(until.getTime() - query.windowDays * DAY_MS);

  const attempts = await prisma.synthesisAttempt.findMany({
    where: {
      bookId,
      startedAt: {
        gte: since,
      },
    },
    select: {
      status: true,
      engine: true,
      requestPayload: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const totals = initMetricBucket();
  const byEngineMap = new Map<string, MutableMetricBucket & { engine: string }>();
  const bySourceMap = new Map<string, MutableMetricBucket & { source: string }>();
  const byPolicyVersionMap = new Map<
    string,
    {
      policyVersion: string;
      total: number;
      fallbackCount: number;
      failed: number;
    }
  >();
  const ruleMap = new Map<string, number>();

  for (const attempt of attempts) {
    const success = attempt.status === "completed";
    const engine = normalizeEngine(attempt.engine || "unknown");
    const decision = resolveDecision(attempt.requestPayload);
    const source = decision.source;

    if (query.engine && engine !== query.engine) {
      continue;
    }
    if (query.source && source !== query.source) {
      continue;
    }
    if (query.policyVersion && decision.policyVersion !== query.policyVersion) {
      continue;
    }

    applyMetric({
      bucket: totals,
      success,
      isFallback: decision.isFallback,
      hasDecision: decision.exists,
    });

    const engineBucket = upsertMetricBucket(byEngineMap, engine, () => ({
      engine,
      ...initMetricBucket(),
    }));
    applyMetric({
      bucket: engineBucket,
      success,
      isFallback: decision.isFallback,
      hasDecision: decision.exists,
    });

    const sourceBucket = upsertMetricBucket(bySourceMap, source, () => ({
      source,
      ...initMetricBucket(),
    }));
    applyMetric({
      bucket: sourceBucket,
      success,
      isFallback: decision.isFallback,
      hasDecision: decision.exists,
    });

    const policyBucket = upsertMetricBucket(byPolicyVersionMap, decision.policyVersion, () => ({
      policyVersion: decision.policyVersion,
      total: 0,
      fallbackCount: 0,
      failed: 0,
    }));
    policyBucket.total += 1;
    if (decision.isFallback) {
      policyBucket.fallbackCount += 1;
    }
    if (!success) {
      policyBucket.failed += 1;
    }

    if (decision.exists) {
      ruleMap.set(decision.rule, (ruleMap.get(decision.rule) || 0) + 1);
    }
  }

  return {
    window: {
      days: query.windowDays,
      since: since.toISOString(),
      until: until.toISOString(),
    },
    filter: {
      source: query.source || null,
      engine: query.engine || null,
      policyVersion: query.policyVersion || null,
    },
    totals: withRates(totals),
    byEngine: Array.from(byEngineMap.values())
      .map((bucket) => withRates(bucket))
      .sort((left, right) => right.total - left.total),
    bySource: Array.from(bySourceMap.values())
      .map((bucket) => withRates(bucket))
      .sort((left, right) => right.total - left.total),
    byPolicyVersion: Array.from(byPolicyVersionMap.values()).sort(
      (left, right) => right.total - left.total
    ),
    topRules: Array.from(ruleMap.entries())
      .map(([rule, count]) => ({ rule, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
  };
};

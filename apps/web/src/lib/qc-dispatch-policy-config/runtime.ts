// 一旦我被更新，请更新我的开头注释
// input: 书籍上下文/策略覆盖参数
// output: 三级策略运行时合并与配置视图
// pos: 配置中心运行时解析
import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { QcDispatchPolicy, QcDispatchPolicyScopeType, ResolvedQcDispatchPolicy, mergeDispatchPolicies, parseDispatchPolicy } from "@/lib/qc-dispatch-policy";
import {
  DispatchPolicyBookContext,
  DispatchPolicyResolutionResult,
  DispatchPolicyScopeConfig,
  DispatchPolicyScopeRuntime,
  DispatchPolicyScopeState,
  DispatchPolicySettingsView,
  MAX_ROLLOUT_PERCENTAGE,
} from "@/lib/qc-dispatch-policy-config/types";
import { normalizeScopeType, readScopeKeyFromMetadata } from "@/lib/qc-dispatch-policy-config/parsers";

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const shouldApplyByRollout = ({
  scopeType,
  scopeKey,
  bookId,
  rolloutPercentage,
}: {
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string;
  bookId: string;
  rolloutPercentage: number;
}): { applied: boolean; reason: string; bucket: number | null } => {
  if (rolloutPercentage >= MAX_ROLLOUT_PERCENTAGE) {
    return {
      applied: true,
      reason: "full_rollout",
      bucket: null,
    };
  }

  if (rolloutPercentage <= 0) {
    return {
      applied: false,
      reason: "rollout_disabled",
      bucket: 99,
    };
  }

  const seed = `${scopeType}:${scopeKey}:${bookId}`;
  const bucket = stableHash(seed) % 100;
  return {
    applied: bucket < rolloutPercentage,
    reason: bucket < rolloutPercentage ? "rollout_hit" : "rollout_miss",
    bucket,
  };
};

const toScopeConfigMapKey = (
  scopeType: QcDispatchPolicyScopeType,
  scopeKey: string
): string => {
  return `${scopeType}:${scopeKey}`;
};

export const getBookContext = async (
  bookId: string
): Promise<DispatchPolicyBookContext> => {
  const book = await prisma.book.findUnique({
    where: {
      id: bookId,
    },
    select: {
      id: true,
      tenantId: true,
      projectId: true,
      metadata: true,
    },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  return {
    bookId: book.id,
    tenantId:
      book.tenantId ||
      readScopeKeyFromMetadata(book.metadata, ["tenantId", "tenant_key", "tenant"]),
    projectId:
      book.projectId ||
      readScopeKeyFromMetadata(book.metadata, ["projectId", "project_key", "project"]),
  };
};

export const loadScopeConfigs = async ({
  context,
}: {
  context: DispatchPolicyBookContext;
}): Promise<Map<string, DispatchPolicyScopeConfig>> => {
  const scopes: Array<{ scopeType: QcDispatchPolicyScopeType; scopeKey: string }> = [
    {
      scopeType: "book",
      scopeKey: context.bookId,
    },
  ];

  if (context.projectId) {
    scopes.push({
      scopeType: "project",
      scopeKey: context.projectId,
    });
  }

  if (context.tenantId) {
    scopes.push({
      scopeType: "tenant",
      scopeKey: context.tenantId,
    });
  }

  const configs = await prisma.qcDispatchPolicyConfig.findMany({
    where: {
      OR: scopes.map((scope) => ({
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey,
      })),
    },
    select: {
      id: true,
      scopeType: true,
      scopeKey: true,
      policy: true,
      isActive: true,
      rolloutPercentage: true,
      version: true,
      updatedAt: true,
      lastChangeNote: true,
      updatedBy: true,
    },
  });

  const configMap = new Map<string, DispatchPolicyScopeConfig>();
  for (const config of configs) {
    const scopeType = normalizeScopeType(config.scopeType);
    if (!scopeType) {
      continue;
    }

    const parsedPolicy = parseDispatchPolicy({
      value: config.policy,
      strict: false,
      path: `config.${config.id}.policy`,
    });

    if (!parsedPolicy) {
      continue;
    }

    configMap.set(toScopeConfigMapKey(scopeType, config.scopeKey), {
      scopeType,
      scopeKey: config.scopeKey,
      id: config.id,
      version: config.version,
      policy: parsedPolicy,
      isActive: config.isActive,
      rolloutPercentage: config.rolloutPercentage,
      updatedAt: config.updatedAt,
      lastChangeNote: config.lastChangeNote,
      updatedBy: config.updatedBy,
    });
  }

  return configMap;
};

export const buildRuntimeScopes = ({
  context,
  configMap,
}: {
  context: DispatchPolicyBookContext;
  configMap: Map<string, DispatchPolicyScopeConfig>;
}): DispatchPolicyScopeRuntime[] => {
  const definitions: Array<{
    scopeType: QcDispatchPolicyScopeType;
    scopeKey: string | null;
  }> = [
    {
      scopeType: "tenant",
      scopeKey: context.tenantId,
    },
    {
      scopeType: "project",
      scopeKey: context.projectId,
    },
    {
      scopeType: "book",
      scopeKey: context.bookId,
    },
  ];

  return definitions.map((definition) => {
    if (!definition.scopeKey) {
      return {
        scopeType: definition.scopeType,
        scopeKey: null,
        configId: null,
        version: null,
        isActive: false,
        rolloutPercentage: null,
        policy: null,
        applied: false,
        appliedReason: "scope_key_missing",
        rolloutBucket: null,
      };
    }

    const config = configMap.get(
      toScopeConfigMapKey(definition.scopeType, definition.scopeKey)
    );

    if (!config) {
      return {
        scopeType: definition.scopeType,
        scopeKey: definition.scopeKey,
        configId: null,
        version: null,
        isActive: false,
        rolloutPercentage: null,
        policy: null,
        applied: false,
        appliedReason: "config_missing",
        rolloutBucket: null,
      };
    }

    if (!config.isActive) {
      return {
        scopeType: definition.scopeType,
        scopeKey: definition.scopeKey,
        configId: config.id,
        version: config.version,
        isActive: false,
        rolloutPercentage: config.rolloutPercentage,
        policy: config.policy,
        applied: false,
        appliedReason: "inactive",
        rolloutBucket: null,
      };
    }

    const rollout = shouldApplyByRollout({
      scopeType: definition.scopeType,
      scopeKey: definition.scopeKey,
      bookId: context.bookId,
      rolloutPercentage: config.rolloutPercentage,
    });

    return {
      scopeType: definition.scopeType,
      scopeKey: definition.scopeKey,
      configId: config.id,
      version: config.version,
      isActive: true,
      rolloutPercentage: config.rolloutPercentage,
      policy: config.policy,
      applied: rollout.applied,
      appliedReason: rollout.reason,
      rolloutBucket: rollout.bucket,
    };
  });
};

export const resolvePolicyFromRuntimeScopes = ({
  runtimeScopes,
  overridePolicy,
}: {
  runtimeScopes: DispatchPolicyScopeRuntime[];
  overridePolicy?: QcDispatchPolicy;
}): ResolvedQcDispatchPolicy => {
  const sources: Array<QcDispatchPolicy | undefined> = runtimeScopes
    .filter((scope) => scope.applied && scope.policy)
    .map((scope) => scope.policy || undefined);

  if (overridePolicy) {
    sources.push(overridePolicy);
  }

  return mergeDispatchPolicies({
    sources,
  });
};

export const resolveDispatchPolicyForBook = async ({
  bookId,
  overridePolicy,
}: {
  bookId: string;
  overridePolicy?: QcDispatchPolicy;
}): Promise<DispatchPolicyResolutionResult> => {
  const context = await getBookContext(bookId);
  const configMap = await loadScopeConfigs({ context });
  const runtimeScopes = buildRuntimeScopes({ context, configMap });

  return {
    context,
    runtimeScopes,
    resolvedPolicy: resolvePolicyFromRuntimeScopes({ runtimeScopes, overridePolicy }),
  };
};

const toScopeState = (
  scopeType: QcDispatchPolicyScopeType,
  scopeKey: string | null,
  configStateMap: Map<string, DispatchPolicyScopeState>
): DispatchPolicyScopeState => {
  if (!scopeKey) {
    return {
      scopeType,
      scopeKey: null,
      config: null,
      revisions: [],
    };
  }

  const configState = configStateMap.get(toScopeConfigMapKey(scopeType, scopeKey));
  if (!configState) {
    return {
      scopeType,
      scopeKey,
      config: null,
      revisions: [],
    };
  }

  return configState;
};

export const getDispatchPolicySettingsForBook = async ({
  bookId,
  historyLimit,
}: {
  bookId: string;
  historyLimit?: number;
}): Promise<DispatchPolicySettingsView> => {
  const context = await getBookContext(bookId);
  const configMap = await loadScopeConfigs({ context });
  const runtimeScopes = buildRuntimeScopes({ context, configMap });

  const limit = historyLimit && historyLimit > 0 ? historyLimit : 10;
  const configs = await prisma.qcDispatchPolicyConfig.findMany({
    where: {
      OR: runtimeScopes
        .filter((scope) => scope.scopeKey)
        .map((scope) => ({
          scopeType: scope.scopeType,
          scopeKey: scope.scopeKey as string,
        })),
    },
    orderBy: [{ scopeType: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      scopeType: true,
      scopeKey: true,
      version: true,
      policy: true,
      isActive: true,
      rolloutPercentage: true,
      updatedAt: true,
      lastChangeNote: true,
      updatedBy: true,
      revisions: {
        orderBy: {
          version: "desc",
        },
        take: limit,
        select: {
          id: true,
          version: true,
          changeType: true,
          changedBy: true,
          changeNote: true,
          createdAt: true,
        },
      },
    },
  });

  const configStateMap = new Map<string, DispatchPolicyScopeState>();
  for (const config of configs) {
    const scopeType = normalizeScopeType(config.scopeType);
    if (!scopeType) {
      continue;
    }

    const policy = parseDispatchPolicy({
      value: config.policy,
      strict: false,
      path: `config.${config.id}.policy`,
    });

    configStateMap.set(toScopeConfigMapKey(scopeType, config.scopeKey), {
      scopeType,
      scopeKey: config.scopeKey,
      config: policy
        ? {
            id: config.id,
            version: config.version,
            policy,
            isActive: config.isActive,
            rolloutPercentage: config.rolloutPercentage,
            updatedAt: config.updatedAt,
            lastChangeNote: config.lastChangeNote,
            updatedBy: config.updatedBy,
          }
        : null,
      revisions: config.revisions,
    });
  }

  return {
    context,
    runtimeScopes,
    resolvedPolicy: resolvePolicyFromRuntimeScopes({ runtimeScopes }),
    scopeStates: [
      toScopeState("tenant", context.tenantId, configStateMap),
      toScopeState("project", context.projectId, configStateMap),
      toScopeState("book", context.bookId, configStateMap),
    ],
  };
};

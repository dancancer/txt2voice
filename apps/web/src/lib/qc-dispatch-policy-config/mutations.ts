// 一旦我被更新，请更新我的开头注释
// input: 策略变更请求/范围上下文
// output: 配置写入结果/审计版本与回滚结果
// pos: 配置中心变更服务
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  QcDispatchPolicy,
  QcDispatchPolicyScopeType,
  ResolvedQcDispatchPolicy,
  parseDispatchPolicy,
  toJsonDispatchPolicyPatch,
} from "@/lib/qc-dispatch-policy";
import {
  DEFAULT_ROLLOUT_PERCENTAGE,
  DispatchPolicyBookContext,
  RollbackDispatchPolicyConfigPayload,
  UpsertDispatchPolicyConfigPayload,
} from "@/lib/qc-dispatch-policy-config/types";
import {
  asBoolean,
  asRecord,
  normalizeRolloutPercentage,
  normalizeScopeType,
  resolveScopeKey,
} from "@/lib/qc-dispatch-policy-config/parsers";
import { getBookContext, resolveDispatchPolicyForBook } from "@/lib/qc-dispatch-policy-config/runtime";

const buildRevisionSnapshot = ({
  scopeType,
  scopeKey,
  policy,
  isActive,
  rolloutPercentage,
}: {
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string;
  policy: Prisma.InputJsonValue;
  isActive: boolean;
  rolloutPercentage: number;
}): Prisma.InputJsonValue => {
  return {
    scopeType,
    scopeKey,
    policy,
    isActive,
    rolloutPercentage,
  };
};

const parseRevisionSnapshot = (
  snapshot: Prisma.JsonValue
): {
  policy: QcDispatchPolicy;
  isActive: boolean;
  rolloutPercentage: number;
} => {
  const snapshotRecord = asRecord(snapshot);
  if (!snapshotRecord) {
    throw new ValidationError("历史快照损坏：snapshot 必须是对象");
  }

  const policy = parseDispatchPolicy({
    value: snapshotRecord.policy,
    strict: true,
    path: "revision.snapshot.policy",
  });
  if (!policy) {
    throw new ValidationError("历史快照损坏：policy 为空");
  }

  const isActive = asBoolean(snapshotRecord.isActive);
  if (isActive === undefined) {
    throw new ValidationError("历史快照损坏：isActive 非布尔值");
  }

  const rolloutPercentage = normalizeRolloutPercentage(
    snapshotRecord.rolloutPercentage,
    "revision.snapshot.rolloutPercentage"
  );
  if (rolloutPercentage === undefined) {
    throw new ValidationError("历史快照损坏：rolloutPercentage 缺失");
  }

  return {
    policy,
    isActive,
    rolloutPercentage,
  };
};

const resolveStoredPolicy = ({
  payload,
  currentPolicy,
}: {
  payload?: QcDispatchPolicy;
  currentPolicy: Prisma.JsonValue | null | undefined;
}): QcDispatchPolicy => {
  if (payload) {
    return payload;
  }

  const parsedCurrentPolicy = parseDispatchPolicy({
    value: currentPolicy,
    strict: false,
    path: "config.policy",
  });

  if (!parsedCurrentPolicy) {
    throw new ValidationError("policy 不能为空");
  }

  return parsedCurrentPolicy;
};

const buildScopeContext = async ({
  bookId,
  scopeType,
  scopeId,
}: {
  bookId: string;
  scopeType: QcDispatchPolicyScopeType;
  scopeId?: string;
}): Promise<{
  context: DispatchPolicyBookContext;
  scopeKey: string;
}> => {
  const context = await getBookContext(bookId);
  const scopeKey = resolveScopeKey({
    scopeType,
    scopeId,
    context,
  });

  return {
    context,
    scopeKey,
  };
};

export const upsertDispatchPolicyConfig = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: UpsertDispatchPolicyConfigPayload;
}): Promise<{
  context: DispatchPolicyBookContext;
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string;
  configId: string;
  version: number;
  policy: ResolvedQcDispatchPolicy;
}> => {
  const { context, scopeKey } = await buildScopeContext({
    bookId,
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
  });

  const existing = await prisma.qcDispatchPolicyConfig.findUnique({
    where: {
      scopeType_scopeKey: {
        scopeType: payload.scopeType,
        scopeKey,
      },
    },
    select: {
      id: true,
      version: true,
      policy: true,
      isActive: true,
      rolloutPercentage: true,
    },
  });

  if (
    payload.expectedVersion !== undefined &&
    existing &&
    payload.expectedVersion !== existing.version
  ) {
    throw new ValidationError(
      `expectedVersion=${payload.expectedVersion} 与当前版本 ${existing.version} 不一致`
    );
  }

  if (
    payload.expectedVersion !== undefined &&
    !existing &&
    payload.expectedVersion !== 1
  ) {
    throw new ValidationError("配置尚未创建，expectedVersion 只能为 1");
  }

  const storedPolicy = resolveStoredPolicy({
    payload: payload.policy,
    currentPolicy: existing?.policy,
  });
  const isActive = payload.isActive ?? existing?.isActive ?? true;
  const rolloutPercentage =
    payload.rolloutPercentage ??
    existing?.rolloutPercentage ??
    DEFAULT_ROLLOUT_PERCENTAGE;
  const nextVersion = existing ? existing.version + 1 : 1;

  const policyJson = toJsonDispatchPolicyPatch(storedPolicy);

  const nextConfig = await prisma.$transaction(async (tx) => {
    const upserted = await tx.qcDispatchPolicyConfig.upsert({
      where: {
        scopeType_scopeKey: {
          scopeType: payload.scopeType,
          scopeKey,
        },
      },
      create: {
        scopeType: payload.scopeType,
        scopeKey,
        bookId: payload.scopeType === "book" ? context.bookId : null,
        policy: policyJson,
        isActive,
        rolloutPercentage,
        version: nextVersion,
        lastChangeNote: payload.changeNote || null,
        updatedBy: payload.updatedBy || null,
      },
      update: {
        policy: policyJson,
        isActive,
        rolloutPercentage,
        version: nextVersion,
        lastChangeNote: payload.changeNote || null,
        updatedBy: payload.updatedBy || null,
      },
      select: {
        id: true,
        version: true,
      },
    });

    await tx.qcDispatchPolicyRevision.create({
      data: {
        configId: upserted.id,
        version: upserted.version,
        changeType: existing ? "update" : "create",
        snapshot: buildRevisionSnapshot({
          scopeType: payload.scopeType,
          scopeKey,
          policy: policyJson,
          isActive,
          rolloutPercentage,
        }),
        changedBy: payload.updatedBy || null,
        changeNote: payload.changeNote || null,
      },
    });

    return upserted;
  });

  const resolved = await resolveDispatchPolicyForBook({
    bookId: context.bookId,
  });

  return {
    context,
    scopeType: payload.scopeType,
    scopeKey,
    configId: nextConfig.id,
    version: nextConfig.version,
    policy: resolved.resolvedPolicy,
  };
};

export const rollbackDispatchPolicyConfig = async ({
  bookId,
  payload,
}: {
  bookId: string;
  payload: RollbackDispatchPolicyConfigPayload;
}): Promise<{
  context: DispatchPolicyBookContext;
  scopeType: QcDispatchPolicyScopeType;
  scopeKey: string;
  rolledBackToVersion: number;
  version: number;
  policy: ResolvedQcDispatchPolicy;
}> => {
  const { context, scopeKey } = await buildScopeContext({
    bookId,
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
  });

  const config = await prisma.qcDispatchPolicyConfig.findUnique({
    where: {
      scopeType_scopeKey: {
        scopeType: payload.scopeType,
        scopeKey,
      },
    },
    include: {
      revisions: {
        where: {
          version: payload.targetVersion,
        },
        take: 1,
      },
    },
  });

  if (!config) {
    throw new ValidationError("目标 scope 尚未配置策略，无法回滚");
  }

  if (
    payload.expectedVersion !== undefined &&
    payload.expectedVersion !== config.version
  ) {
    throw new ValidationError(
      `expectedVersion=${payload.expectedVersion} 与当前版本 ${config.version} 不一致`
    );
  }

  const targetRevision = config.revisions[0];
  if (!targetRevision) {
    throw new ValidationError(`未找到版本 ${payload.targetVersion} 的策略快照`);
  }

  const snapshot = parseRevisionSnapshot(targetRevision.snapshot);
  const snapshotPolicy = toJsonDispatchPolicyPatch(snapshot.policy);
  const nextVersion = config.version + 1;

  await prisma.$transaction(async (tx) => {
    await tx.qcDispatchPolicyConfig.update({
      where: {
        id: config.id,
      },
      data: {
        policy: snapshotPolicy,
        isActive: snapshot.isActive,
        rolloutPercentage: snapshot.rolloutPercentage,
        version: nextVersion,
        lastChangeNote:
          payload.changeNote ||
          `rollback_to_v${payload.targetVersion}_from_v${config.version}`,
        updatedBy: payload.updatedBy || null,
      },
    });

    await tx.qcDispatchPolicyRevision.create({
      data: {
        configId: config.id,
        version: nextVersion,
        changeType: "rollback",
        snapshot: buildRevisionSnapshot({
          scopeType: normalizeScopeType(config.scopeType) || payload.scopeType,
          scopeKey,
          policy: snapshotPolicy,
          isActive: snapshot.isActive,
          rolloutPercentage: snapshot.rolloutPercentage,
        }),
        changedBy: payload.updatedBy || null,
        changeNote:
          payload.changeNote ||
          `rollback_to_v${payload.targetVersion}_from_v${config.version}`,
      },
    });
  });

  const resolved = await resolveDispatchPolicyForBook({
    bookId: context.bookId,
  });

  return {
    context,
    scopeType: payload.scopeType,
    scopeKey,
    rolledBackToVersion: payload.targetVersion,
    version: nextVersion,
    policy: resolved.resolvedPolicy,
  };
};

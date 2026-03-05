// 一旦我被更新，请更新我的开头注释
// input: 原始请求参数/上下文
// output: 规范化配置参数/范围校验
// pos: 配置中心解析工具
import { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { QcDispatchPolicyScopeType, parseDispatchPolicy } from "@/lib/qc-dispatch-policy";
import {
  DEFAULT_SCOPE_TYPE,
  DispatchPolicyBookContext,
  MAX_HISTORY_LIMIT,
  MAX_ROLLOUT_PERCENTAGE,
  RollbackDispatchPolicyConfigPayload,
  UpsertDispatchPolicyConfigPayload,
} from "@/lib/qc-dispatch-policy-config/types";

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

export const asInteger = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    if (Number.isInteger(value) && Number.isFinite(value)) {
      return value;
    }
    return undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

export const normalizeScopeType = (
  value: unknown
): QcDispatchPolicyScopeType | undefined => {
  const normalized = asString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "tenant" || normalized === "project" || normalized === "book") {
    return normalized;
  }

  return undefined;
};

export const normalizeRolloutPercentage = (
  value: unknown,
  path: string
): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = asInteger(value);
  if (
    parsed === undefined ||
    parsed < 0 ||
    parsed > MAX_ROLLOUT_PERCENTAGE
  ) {
    throw new ValidationError(`${path} 必须是 0-100 的整数`);
  }

  return parsed;
};

const normalizeExpectedVersion = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = asInteger(value);
  if (parsed === undefined || parsed < 1) {
    throw new ValidationError("expectedVersion 必须是 >= 1 的整数");
  }

  return parsed;
};

const normalizeHistoryLimit = (value: unknown): number => {
  if (value === undefined || value === null) {
    return 10;
  }

  const parsed = asInteger(value);
  if (parsed === undefined || parsed < 1 || parsed > MAX_HISTORY_LIMIT) {
    throw new ValidationError(`historyLimit 必须是 1-${MAX_HISTORY_LIMIT} 的整数`);
  }

  return parsed;
};

export const readScopeKeyFromMetadata = (
  metadata: Prisma.JsonValue | null | undefined,
  keys: string[]
): string | null => {
  const metadataRecord = asRecord(metadata);
  if (!metadataRecord) {
    return null;
  }

  for (const key of keys) {
    const direct = asString(metadataRecord[key]);
    if (direct) {
      return direct;
    }
  }

  for (const key of keys) {
    const nested = asRecord(metadataRecord[key]);
    const nestedId = asString(nested?.id) || asString(nested?.key);
    if (nestedId) {
      return nestedId;
    }
  }

  return null;
};

export const resolveScopeKey = ({
  scopeType,
  scopeId,
  context,
}: {
  scopeType: QcDispatchPolicyScopeType;
  scopeId?: string;
  context: DispatchPolicyBookContext;
}): string => {
  if (scopeType === "book") {
    return context.bookId;
  }

  if (scopeId) {
    return scopeId;
  }

  if (scopeType === "tenant") {
    if (!context.tenantId) {
      throw new ValidationError("当前书籍未绑定 tenantId，无法更新 tenant 级策略");
    }
    return context.tenantId;
  }

  if (!context.projectId) {
    throw new ValidationError("当前书籍未绑定 projectId，无法更新 project 级策略");
  }

  return context.projectId;
};

export const parseDispatchPolicyConfigPayload = (
  body: unknown
): UpsertDispatchPolicyConfigPayload => {
  const payload = asRecord(body) || {};
  const parsedScopeType = normalizeScopeType(payload.scopeType);
  const scopeType = parsedScopeType || DEFAULT_SCOPE_TYPE;
  if (!parsedScopeType && payload.scopeType !== undefined) {
    throw new ValidationError("scopeType 仅支持 tenant/project/book");
  }

  const scopeId = asString(payload.scopeId);
  const policy = parseDispatchPolicy({
    value: payload.policy,
    strict: true,
    path: "policy",
  });

  const isActive = asBoolean(payload.isActive);
  if (payload.isActive !== undefined && isActive === undefined) {
    throw new ValidationError("isActive 必须是布尔值");
  }

  const rolloutPercentage = normalizeRolloutPercentage(
    payload.rolloutPercentage,
    "rolloutPercentage"
  );

  const updatedBy = asString(payload.updatedBy);
  if (updatedBy && updatedBy.length > 64) {
    throw new ValidationError("updatedBy 不能超过 64 字符");
  }

  const changeNote = asString(payload.changeNote);
  if (changeNote && changeNote.length > 500) {
    throw new ValidationError("changeNote 不能超过 500 字符");
  }

  const expectedVersion = normalizeExpectedVersion(payload.expectedVersion);

  if (!policy && isActive === undefined && rolloutPercentage === undefined) {
    throw new ValidationError("至少需要提供 policy/isActive/rolloutPercentage 之一");
  }

  return {
    scopeType,
    scopeId,
    policy,
    isActive,
    rolloutPercentage,
    updatedBy,
    changeNote,
    expectedVersion,
  };
};

export const parseRollbackDispatchPolicyPayload = (
  body: unknown
): RollbackDispatchPolicyConfigPayload => {
  const payload = asRecord(body) || {};
  const parsedScopeType = normalizeScopeType(payload.scopeType);
  const scopeType = parsedScopeType || DEFAULT_SCOPE_TYPE;
  if (!parsedScopeType && payload.scopeType !== undefined) {
    throw new ValidationError("scopeType 仅支持 tenant/project/book");
  }

  const scopeId = asString(payload.scopeId);
  const targetVersion = asInteger(payload.targetVersion);
  if (!targetVersion || targetVersion < 1) {
    throw new ValidationError("targetVersion 必须是 >= 1 的整数");
  }

  const updatedBy = asString(payload.updatedBy);
  if (updatedBy && updatedBy.length > 64) {
    throw new ValidationError("updatedBy 不能超过 64 字符");
  }

  const changeNote = asString(payload.changeNote);
  if (changeNote && changeNote.length > 500) {
    throw new ValidationError("changeNote 不能超过 500 字符");
  }

  const expectedVersion = normalizeExpectedVersion(payload.expectedVersion);

  return {
    scopeType,
    scopeId,
    targetVersion,
    updatedBy,
    changeNote,
    expectedVersion,
  };
};

export const parseDispatchPolicySettingsQuery = (
  searchParams: URLSearchParams
): { historyLimit: number } => {
  return {
    historyLimit: normalizeHistoryLimit(searchParams.get("historyLimit")),
  };
};

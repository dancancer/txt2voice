// 一旦我被更新，请更新我的开头注释
// input: 原始策略 JSON/校验选项
// output: 标准化策略对象/合并结果
// pos: dispatchPolicy 契约解析与合并
import { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";

export type QcDispatchPolicyScopeType = "tenant" | "project" | "book";

export interface QcIssueTypeDispatchPolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
}

export interface QcDispatchPolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
  issueTypePolicies?: Record<string, QcIssueTypeDispatchPolicy>;
}

export interface ResolvedQcDispatchPolicy {
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number;
  issueTypePolicies: Record<string, QcIssueTypeDispatchPolicy>;
}

export interface ParseDispatchPolicyOptions {
  strict: boolean;
  path: string;
}

export const DEFAULT_MAX_AUTO_REJECTED_COUNT = 2;
export const MAX_ALLOWED_AUTO_REJECTED_COUNT = 20;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const normalizeIssueType = (value: string): string => {
  return value.trim().toUpperCase();
};

const parseMaxAutoRejectedCount = ({
  value,
  strict,
  path,
}: {
  value: unknown;
  strict: boolean;
  path: string;
}): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numeric = asNumber(value);
  const normalized =
    numeric !== undefined && Number.isInteger(numeric) ? Number(numeric) : undefined;

  if (
    normalized === undefined ||
    normalized < 0 ||
    normalized > MAX_ALLOWED_AUTO_REJECTED_COUNT
  ) {
    if (strict) {
      throw new ValidationError(
        `${path} 必须是 0-${MAX_ALLOWED_AUTO_REJECTED_COUNT} 的整数`
      );
    }
    return undefined;
  }

  return normalized;
};

const parseIssueTypeDispatchPolicy = ({
  value,
  strict,
  path,
}: {
  value: unknown;
  strict: boolean;
  path: string;
}): QcIssueTypeDispatchPolicy | undefined => {
  const record = asRecord(value);
  if (!record) {
    if (strict) {
      throw new ValidationError(`${path} 必须是对象`);
    }
    return undefined;
  }

  const autoCreatePendingOnReject = asBoolean(record.autoCreatePendingOnReject);
  if (
    strict &&
    record.autoCreatePendingOnReject !== undefined &&
    autoCreatePendingOnReject === undefined
  ) {
    throw new ValidationError(`${path}.autoCreatePendingOnReject 必须是布尔值`);
  }

  const maxAutoRejectedCount = parseMaxAutoRejectedCount({
    value: record.maxAutoRejectedCount,
    strict,
    path: `${path}.maxAutoRejectedCount`,
  });

  if (
    autoCreatePendingOnReject === undefined &&
    maxAutoRejectedCount === undefined
  ) {
    return undefined;
  }

  return {
    ...(autoCreatePendingOnReject !== undefined
      ? {
          autoCreatePendingOnReject,
        }
      : {}),
    ...(maxAutoRejectedCount !== undefined
      ? {
          maxAutoRejectedCount,
        }
      : {}),
  };
};

export const parseDispatchPolicy = ({
  value,
  strict,
  path,
}: {
  value: unknown;
} & ParseDispatchPolicyOptions): QcDispatchPolicy | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    if (strict) {
      throw new ValidationError(`${path} 必须是对象`);
    }
    return undefined;
  }

  const autoCreatePendingOnReject = asBoolean(record.autoCreatePendingOnReject);
  if (
    strict &&
    record.autoCreatePendingOnReject !== undefined &&
    autoCreatePendingOnReject === undefined
  ) {
    throw new ValidationError(`${path}.autoCreatePendingOnReject 必须是布尔值`);
  }

  const maxAutoRejectedCount = parseMaxAutoRejectedCount({
    value: record.maxAutoRejectedCount,
    strict,
    path: `${path}.maxAutoRejectedCount`,
  });

  const issueTypePoliciesRecord = asRecord(record.issueTypePolicies);
  if (strict && record.issueTypePolicies !== undefined && !issueTypePoliciesRecord) {
    throw new ValidationError(`${path}.issueTypePolicies 必须是对象`);
  }

  const issueTypePolicies: Record<string, QcIssueTypeDispatchPolicy> = {};
  if (issueTypePoliciesRecord) {
    for (const [rawIssueType, itemPolicy] of Object.entries(issueTypePoliciesRecord)) {
      const issueType = normalizeIssueType(rawIssueType);
      if (!issueType) {
        if (strict) {
          throw new ValidationError(`${path}.issueTypePolicies 包含空 issueType`);
        }
        continue;
      }

      const parsedItemPolicy = parseIssueTypeDispatchPolicy({
        value: itemPolicy,
        strict,
        path: `${path}.issueTypePolicies.${issueType}`,
      });

      if (parsedItemPolicy) {
        issueTypePolicies[issueType] = parsedItemPolicy;
      }
    }
  }

  if (
    autoCreatePendingOnReject === undefined &&
    maxAutoRejectedCount === undefined &&
    Object.keys(issueTypePolicies).length === 0
  ) {
    return undefined;
  }

  return {
    ...(autoCreatePendingOnReject !== undefined
      ? {
          autoCreatePendingOnReject,
        }
      : {}),
    ...(maxAutoRejectedCount !== undefined
      ? {
          maxAutoRejectedCount,
        }
      : {}),
    ...(Object.keys(issueTypePolicies).length > 0
      ? {
          issueTypePolicies,
        }
      : {}),
  };
};

export const mergeDispatchPolicies = ({
  sources,
}: {
  sources: Array<QcDispatchPolicy | undefined>;
}): ResolvedQcDispatchPolicy => {
  const mergedIssueTypePolicies: Record<string, QcIssueTypeDispatchPolicy> = {};

  for (const source of sources) {
    if (!source?.issueTypePolicies) {
      continue;
    }

    for (const [rawIssueType, issuePolicy] of Object.entries(source.issueTypePolicies)) {
      const issueType = normalizeIssueType(rawIssueType);
      if (!issueType) {
        continue;
      }

      const current = mergedIssueTypePolicies[issueType] || {};
      mergedIssueTypePolicies[issueType] = {
        ...current,
        ...issuePolicy,
      };
    }
  }

  const defaultPolicy: QcDispatchPolicy = {
    autoCreatePendingOnReject: true,
    maxAutoRejectedCount: DEFAULT_MAX_AUTO_REJECTED_COUNT,
  };

  const orderedSources = [defaultPolicy, ...sources];

  const autoCreatePendingOnReject = orderedSources.reduce<boolean>(
    (value, source) => {
      if (source?.autoCreatePendingOnReject === undefined) {
        return value;
      }
      return source.autoCreatePendingOnReject;
    },
    true
  );

  const maxAutoRejectedCount = orderedSources.reduce<number>(
    (value, source) => {
      if (source?.maxAutoRejectedCount === undefined) {
        return value;
      }
      return source.maxAutoRejectedCount;
    },
    DEFAULT_MAX_AUTO_REJECTED_COUNT
  );

  return {
    autoCreatePendingOnReject,
    maxAutoRejectedCount,
    issueTypePolicies: mergedIssueTypePolicies,
  };
};

export const toJsonDispatchPolicy = (
  policy: ResolvedQcDispatchPolicy
): Prisma.InputJsonValue => {
  const issueTypePolicies: Record<string, Prisma.InputJsonValue> = {};
  for (const [issueType, issuePolicy] of Object.entries(policy.issueTypePolicies)) {
    const issuePolicyPayload: Record<string, Prisma.InputJsonValue> = {};
    if (issuePolicy.autoCreatePendingOnReject !== undefined) {
      issuePolicyPayload.autoCreatePendingOnReject =
        issuePolicy.autoCreatePendingOnReject;
    }
    if (issuePolicy.maxAutoRejectedCount !== undefined) {
      issuePolicyPayload.maxAutoRejectedCount = issuePolicy.maxAutoRejectedCount;
    }
    if (Object.keys(issuePolicyPayload).length > 0) {
      issueTypePolicies[issueType] = issuePolicyPayload;
    }
  }

  return {
    autoCreatePendingOnReject: policy.autoCreatePendingOnReject,
    maxAutoRejectedCount: policy.maxAutoRejectedCount,
    issueTypePolicies,
  };
};

export const toJsonDispatchPolicyPatch = (
  policy: QcDispatchPolicy
): Prisma.InputJsonValue => {
  const payload: Record<string, Prisma.InputJsonValue> = {};

  if (policy.autoCreatePendingOnReject !== undefined) {
    payload.autoCreatePendingOnReject = policy.autoCreatePendingOnReject;
  }
  if (policy.maxAutoRejectedCount !== undefined) {
    payload.maxAutoRejectedCount = policy.maxAutoRejectedCount;
  }

  if (policy.issueTypePolicies) {
    const issueTypePolicies: Record<string, Prisma.InputJsonValue> = {};
    for (const [issueType, issuePolicy] of Object.entries(policy.issueTypePolicies)) {
      const issuePayload: Record<string, Prisma.InputJsonValue> = {};
      if (issuePolicy.autoCreatePendingOnReject !== undefined) {
        issuePayload.autoCreatePendingOnReject =
          issuePolicy.autoCreatePendingOnReject;
      }
      if (issuePolicy.maxAutoRejectedCount !== undefined) {
        issuePayload.maxAutoRejectedCount = issuePolicy.maxAutoRejectedCount;
      }
      if (Object.keys(issuePayload).length > 0) {
        issueTypePolicies[normalizeIssueType(issueType)] = issuePayload;
      }
    }

    if (Object.keys(issueTypePolicies).length > 0) {
      payload.issueTypePolicies = issueTypePolicies;
    }
  }

  return payload;
};

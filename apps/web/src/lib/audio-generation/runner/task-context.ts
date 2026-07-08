import type { Prisma } from "@/lib/prisma";
import type {
  JsonValue,
  ManualReviewBatchTaskContext,
  ManualReviewTaskContext,
  QcRetryDispatchPolicy,
  QcRetryIssueTypePolicy,
  QcRetryTaskContext,
} from "@/lib/audio-generation/runner/types";

const DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT = 2;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asBoolean = (value: unknown): boolean | undefined => {
  return typeof value === "boolean" ? value : undefined;
};

const asNonNegativeInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return undefined;
  }
  return Number(numeric);
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
};

const parseQcRetryIssueTypePolicies = (
  value: unknown
): Record<string, QcRetryIssueTypePolicy> => {
  const policyRecord = asRecord(value);
  if (!policyRecord) {
    return {};
  }

  const issueTypePolicies: Record<string, QcRetryIssueTypePolicy> = {};
  for (const [rawIssueType, issuePolicyValue] of Object.entries(policyRecord)) {
    const issueType = rawIssueType.trim().toUpperCase();
    if (!issueType) {
      continue;
    }

    const issuePolicy = asRecord(issuePolicyValue);
    if (!issuePolicy) {
      continue;
    }

    const autoCreatePendingOnReject = asBoolean(issuePolicy.autoCreatePendingOnReject);
    const maxAutoRejectedCount = asNonNegativeInteger(issuePolicy.maxAutoRejectedCount);
    if (
      autoCreatePendingOnReject === undefined &&
      maxAutoRejectedCount === undefined
    ) {
      continue;
    }

    issueTypePolicies[issueType] = {
      ...(autoCreatePendingOnReject !== undefined
        ? { autoCreatePendingOnReject }
        : {}),
      ...(maxAutoRejectedCount !== undefined ? { maxAutoRejectedCount } : {}),
    };
  }

  return issueTypePolicies;
};

export const toJsonQcRetryDispatchPolicy = (
  dispatchPolicy: QcRetryDispatchPolicy
): Prisma.InputJsonValue => {
  const issueTypePolicies: Record<string, Prisma.InputJsonValue> = {};
  for (const [issueType, issuePolicy] of Object.entries(dispatchPolicy.issueTypePolicies)) {
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
    autoCreatePendingOnReject: dispatchPolicy.autoCreatePendingOnReject,
    maxAutoRejectedCount: dispatchPolicy.maxAutoRejectedCount,
    issueTypePolicies,
  };
};

export const extractManualReviewTaskContext = (
  taskData: JsonValue
): ManualReviewTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "manual_review") {
    return null;
  }

  const manualReviewItemId =
    typeof metadata.manualReviewItemId === "string"
      ? metadata.manualReviewItemId
      : null;

  return manualReviewItemId ? { manualReviewItemId } : null;
};

export const extractManualReviewBatchTaskContext = (
  taskData: JsonValue
): ManualReviewBatchTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "manual_review_batch") {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata.selectedReviewItemIds);
  return selectedReviewItemIds.length > 0 ? { selectedReviewItemIds } : null;
};

export const extractQcRetryTaskContext = (
  taskData: JsonValue
): QcRetryTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "qc_retry") {
    return null;
  }

  const selectedReviewItemIds = asStringArray(metadata.selectedReviewItemIds);
  if (selectedReviewItemIds.length === 0) {
    return null;
  }

  const policySource = asRecord(metadata.dispatchPolicy) || metadata;
  const dispatchPolicy: QcRetryDispatchPolicy = {
    autoCreatePendingOnReject:
      asBoolean(policySource.autoCreatePendingOnReject) ?? true,
    maxAutoRejectedCount:
      asNonNegativeInteger(policySource.maxAutoRejectedCount) ??
      DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT,
    issueTypePolicies: parseQcRetryIssueTypePolicies(policySource.issueTypePolicies),
  };

  return {
    selectedReviewItemIds,
    dispatchPolicy,
  };
};

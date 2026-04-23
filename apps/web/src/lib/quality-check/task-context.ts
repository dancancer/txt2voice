import type { Prisma } from "@/lib/prisma";

type FastGateVerdictLike =
  | "pass"
  | "repair"
  | "manual_review"
  | "hard_fail";

export interface IssueTypeDispatchPolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
}

export interface CalibrationSampleLabel {
  audioFileId: string;
  expectedVerdict: FastGateVerdictLike;
  issueType: string;
  source: string;
  fallbackUsed: boolean;
}

interface CalibrationEvalTaskContext {
  enabled: boolean;
  dryRun: boolean;
  reportId: string | null;
  sampleSetId: string | null;
  sampleLabelsByAudioFileId: Record<string, CalibrationSampleLabel>;
}

export interface SignalSyncTaskContext {
  enabled: boolean;
  forceResync: boolean;
  signalPayloadByAudioFileId: Record<string, unknown>;
  signalPayloadBySentenceId: Record<string, unknown>;
  signalModelRuntime: Record<string, unknown>;
}

export interface QualityCheckTaskContext {
  source: string | null;
  manualReviewItemId: string;
  retryReviewItemIds: string[];
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number | null;
  issueTypePolicies: Record<string, IssueTypeDispatchPolicy>;
  calibrationEval: CalibrationEvalTaskContext;
  signalSync: SignalSyncTaskContext;
  taskMetadata: Record<string, unknown>;
}

const DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT = 2;

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

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

const asFastGateVerdict = (value: unknown): FastGateVerdictLike | null => {
  const verdict = asString(value);
  if (
    verdict === "pass" ||
    verdict === "repair" ||
    verdict === "manual_review" ||
    verdict === "hard_fail"
  ) {
    return verdict;
  }
  return null;
};

const parseIssueTypePolicies = (
  value: unknown
): Record<string, IssueTypeDispatchPolicy> => {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const issueTypePolicies: Record<string, IssueTypeDispatchPolicy> = {};
  for (const [rawIssueType, policyValue] of Object.entries(record)) {
    const issueType = rawIssueType.trim().toUpperCase();
    if (!issueType) {
      continue;
    }

    const policy = asRecord(policyValue);
    if (!policy) {
      continue;
    }

    const autoCreatePendingOnReject = asBoolean(policy.autoCreatePendingOnReject);
    const maxAutoRejectedCount = asNonNegativeInteger(policy.maxAutoRejectedCount);
    if (
      autoCreatePendingOnReject === undefined &&
      maxAutoRejectedCount === undefined
    ) {
      continue;
    }

    issueTypePolicies[issueType] = {
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
  }

  return issueTypePolicies;
};

const parseCalibrationSampleLabels = (
  value: unknown
): Record<string, CalibrationSampleLabel> => {
  if (!Array.isArray(value)) {
    return {};
  }

  const labelsByAudioFileId: Record<string, CalibrationSampleLabel> = {};
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const audioFileId = asString(record.audioFileId);
    const expectedVerdict = asFastGateVerdict(record.expectedVerdict);
    if (!audioFileId || !expectedVerdict) {
      continue;
    }

    labelsByAudioFileId[audioFileId] = {
      audioFileId,
      expectedVerdict,
      issueType: (asString(record.issueType) || "UNKNOWN").toUpperCase(),
      source: (asString(record.source) || "unknown").toLowerCase(),
      fallbackUsed: asBoolean(record.fallbackUsed) || false,
    };
  }

  return labelsByAudioFileId;
};

export const extractQualityCheckTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): QualityCheckTaskContext => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  const source = typeof metadata?.source === "string" ? metadata.source : null;
  const isQcRetrySource = source === "qc_retry";
  const isManualReviewBatchSource = source === "manual_review_batch";
  const calibrationEvalRecord = asRecord(metadata?.calibrationEval);
  const calibrationEvalEnabled =
    asBoolean(calibrationEvalRecord?.enabled) ?? source === "calibration_eval";
  const manualReviewItemId =
    typeof metadata?.manualReviewItemId === "string"
      ? metadata.manualReviewItemId
      : "";
  const retryReviewItemIds = asStringArray(metadata?.retryReviewItemIds);
  const syncSignalsBeforeRun =
    asBoolean(metadata?.syncSignalsBeforeRun) ?? source !== "calibration_eval";
  const forceSignalResync = asBoolean(metadata?.forceSignalResync) ?? false;

  const policySource = asRecord(metadata?.dispatchPolicy) || metadata;
  const autoCreatePendingOnReject =
    asBoolean(policySource?.autoCreatePendingOnReject) ?? isQcRetrySource;
  const maxAutoRejectedCount =
    asNonNegativeInteger(policySource?.maxAutoRejectedCount) ??
    (isQcRetrySource ? DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT : null);
  const issueTypePolicies = parseIssueTypePolicies(policySource?.issueTypePolicies);

  return {
    source,
    manualReviewItemId: source === "manual_review" ? manualReviewItemId : "",
    retryReviewItemIds:
      isQcRetrySource || isManualReviewBatchSource ? retryReviewItemIds : [],
    autoCreatePendingOnReject,
    maxAutoRejectedCount,
    issueTypePolicies,
    calibrationEval: {
      enabled: calibrationEvalEnabled,
      dryRun: asBoolean(calibrationEvalRecord?.dryRun) ?? true,
      reportId: asString(calibrationEvalRecord?.reportId) || null,
      sampleSetId: asString(calibrationEvalRecord?.sampleSetId) || null,
      sampleLabelsByAudioFileId: parseCalibrationSampleLabels(
        calibrationEvalRecord?.sampleLabels
      ),
    },
    signalSync: {
      enabled: syncSignalsBeforeRun,
      forceResync: forceSignalResync,
      signalPayloadByAudioFileId: asRecord(metadata?.signalPayloadByAudioFileId) || {},
      signalPayloadBySentenceId: asRecord(metadata?.signalPayloadBySentenceId) || {},
      signalModelRuntime: asRecord(metadata?.signalModelRuntime) || {},
    },
    taskMetadata: metadata || {},
  };
};

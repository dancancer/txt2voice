import { createHash } from "crypto";

import type { ExecutionEvent } from "../../../protocol/events";
import type { SkillDefinition } from "../../../protocol";
import type { SegmentFailureDetail } from "../types";
import type {
  ScriptProductionWorkflowMode,
  ScriptProductionBookSegment,
  SegmentOutcomeIndexItem,
} from "../shared-types";

export interface ScriptProductionWorkflowSummary {
  mode: ScriptProductionWorkflowMode;
  selectedSegmentIds: string[];
  totalSegments: number;
  processedSegments: number;
  failedSegments: number;
  failedSegmentIds: string[];
  persistedSentenceCount: number;
  persistedCharacterCount: number;
  formatRepairCount: number;
  semanticRetryCount: number;
  manualReviewRequiredCount: number;
  qualityRejectedCount: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  segmentOutcomeIndex: SegmentOutcomeIndexItem[];
  manualReviewSync?: {
    issueType: string;
    created: number;
    updated: number;
    pending: number;
    resolved: number;
  };
  stageSkillMetadata?: Record<string, SkillMetadataSnapshot>;
}

export interface SkillMetadataSnapshot {
  promptBundle?: string[];
  promptFingerprint?: string;
  modelPolicy?: string | null;
  repairPolicy?: string | null;
  successCriteria?: string[];
  telemetryTags?: string[];
}

interface PromptFingerprintSource {
  runtimeSystemPrompt?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

export interface ScriptProductionRuntimeMetadata {
  workflowRunId: string;
  workflowId: string;
  status: "completed" | "failed";
  mode: ScriptProductionWorkflowMode;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: ScriptProductionWorkflowSummary;
  traceEventCount: number;
  stageRunCount: number;
}

export const createRuntimeId = () =>
  `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildPromptFingerprint = (params: {
  promptBundle?: string[];
  promptSource?: PromptFingerprintSource;
}): string | undefined => {
  if (!Array.isArray(params.promptBundle)) {
    return undefined;
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        promptBundle: params.promptBundle,
        runtimeSystemPrompt: params.promptSource?.runtimeSystemPrompt ?? "",
        systemPrompt: params.promptSource?.systemPrompt ?? "",
        userPrompt: params.promptSource?.userPrompt ?? "",
      })
    )
    .digest("hex");
};

export const buildSkillMetadataSnapshot = (
  definition: Pick<
    SkillDefinition,
    | "promptBundle"
    | "modelPolicy"
    | "repairPolicy"
    | "successCriteria"
    | "telemetryTags"
  >,
  promptSource?: PromptFingerprintSource
): SkillMetadataSnapshot => ({
  ...(Array.isArray(definition.promptBundle)
    ? {
        promptBundle: [...definition.promptBundle],
        promptFingerprint: buildPromptFingerprint({
          promptBundle: definition.promptBundle,
          promptSource,
        }),
      }
    : {}),
  modelPolicy: definition.modelPolicy ?? null,
  repairPolicy: definition.repairPolicy ?? null,
  successCriteria: [...(definition.successCriteria ?? [])],
  telemetryTags: [...(definition.telemetryTags ?? [])],
});

export const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown_runtime_error";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export interface FailureArtifactContext {
  provider: string | null;
  rawResponse: string | null;
  structuredResult: Record<string, unknown> | null;
}

export const extractFailureArtifactContext = (
  value: unknown
): FailureArtifactContext => {
  const record = asRecord(value);
  const structuredResult = asRecord(record?.structuredResult);

  return {
    provider: asNullableString(record?.provider),
    rawResponse: asNullableString(record?.rawResponse),
    structuredResult: structuredResult
      ? (JSON.parse(JSON.stringify(structuredResult)) as Record<string, unknown>)
      : null,
  };
};

const buildSegmentPreview = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 120);

export const createFailureDetail = (params: {
  segment: ScriptProductionBookSegment;
  stage: string;
  errorCode: string;
  message: string;
  provider?: string | null;
  retryable?: boolean;
  coverageRatio?: number | null;
  issueCodes?: string[];
  issueMessages?: string[];
  issuePreviews?: string[];
  rawResponse?: string | null;
  structuredResult?: Record<string, unknown> | null;
}): SegmentFailureDetail => ({
  segmentId: params.segment.id,
  chapterId: params.segment.chapterId ?? null,
  orderIndex:
    typeof params.segment.orderIndex === "number" &&
    Number.isFinite(params.segment.orderIndex)
      ? params.segment.orderIndex
      : -1,
  stage: params.stage,
  errorCode: params.errorCode,
  message: params.message,
  provider: params.provider ?? null,
  retryable: params.retryable === true,
  coverageRatio:
    typeof params.coverageRatio === "number" ? params.coverageRatio : null,
  issueCodes: params.issueCodes || [],
  issueMessages: params.issueMessages || [params.message],
  issuePreviews: params.issuePreviews || [],
  segmentPreview: buildSegmentPreview(params.segment.content),
  segmentContent: params.segment.content,
  rawResponse: params.rawResponse ?? null,
  structuredResult: params.structuredResult ?? null,
});

export const remapFailureToParentSegment = (params: {
  parentSegment: ScriptProductionBookSegment;
  failure: SegmentFailureDetail;
}): SegmentFailureDetail =>
  createFailureDetail({
    segment: params.parentSegment,
    stage: params.failure.stage,
    errorCode: params.failure.errorCode,
    message: params.failure.message,
    provider: params.failure.provider,
    retryable: params.failure.retryable,
    coverageRatio: params.failure.coverageRatio,
    issueCodes: params.failure.issueCodes,
    issueMessages: params.failure.issueMessages,
    issuePreviews: params.failure.issuePreviews,
    rawResponse: params.failure.rawResponse,
    structuredResult: params.failure.structuredResult,
  });

export const createValidationTraceEvent = (params: {
  createId: () => string;
  now?: () => Date;
  workflowRunId: string;
  stageRunId: string;
  segment: ScriptProductionBookSegment;
  validationReport: {
    valid: boolean;
    coverageRatio: number;
    issues: Array<{ code: string }>;
  };
}): ExecutionEvent => ({
  id: params.createId(),
  kind: params.validationReport.valid
    ? "validation_succeeded"
    : "validation_failed",
  createdAt: (params.now ?? (() => new Date()))().toISOString(),
  workflowRunId: params.workflowRunId,
  stageRunId: params.stageRunId,
  status: params.validationReport.valid ? "completed" : "failed",
  payload: {
    segmentId: params.segment.id,
    chapterId: params.segment.chapterId ?? null,
    orderIndex:
      typeof params.segment.orderIndex === "number"
        ? params.segment.orderIndex
        : -1,
    coverageRatio: params.validationReport.coverageRatio,
    issueCodes: params.validationReport.issues.map((issue) => issue.code),
  },
});

export const createStageSummary = (params: {
  segment: ScriptProductionBookSegment;
  stageId: string;
  summary: Record<string, unknown>;
}): Record<string, unknown> => ({
  segmentId: params.segment.id,
  chapterId: params.segment.chapterId ?? null,
  orderIndex:
    typeof params.segment.orderIndex === "number"
      ? params.segment.orderIndex
      : -1,
  ...params.summary,
  stageId: params.stageId,
});

export const buildWorkflowSummary = (params: {
  mode: ScriptProductionWorkflowMode;
  selectedSegmentIds: string[];
  totalSegments: number;
  processedSegments: number;
  failedSegmentIds: string[];
  persistedSentenceCount: number;
  persistedCharacterCount: number;
  formatRepairCount: number;
  semanticRetryCount: number;
  manualReviewRequiredCount: number;
  qualityRejectedCount: number;
  startedAt: string;
  completedAt: string;
  segmentOutcomeIndex: SegmentOutcomeIndexItem[];
  manualReviewSync?: {
    issueType: string;
    created: number;
    updated: number;
    pending: number;
    resolved: number;
  };
  stageSkillMetadata?: Record<string, SkillMetadataSnapshot>;
}): ScriptProductionWorkflowSummary => {
  const durationMs = Math.max(
    new Date(params.completedAt).getTime() - new Date(params.startedAt).getTime(),
    0
  );

  return {
    mode: params.mode,
    selectedSegmentIds: params.selectedSegmentIds,
    totalSegments: params.totalSegments,
    processedSegments: params.processedSegments,
    failedSegments: params.failedSegmentIds.length,
    failedSegmentIds: params.failedSegmentIds,
    persistedSentenceCount: params.persistedSentenceCount,
    persistedCharacterCount: params.persistedCharacterCount,
    formatRepairCount: params.formatRepairCount,
    semanticRetryCount: params.semanticRetryCount,
    manualReviewRequiredCount: params.manualReviewRequiredCount,
    qualityRejectedCount: params.qualityRejectedCount,
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    durationMs,
    segmentOutcomeIndex: params.segmentOutcomeIndex,
    manualReviewSync: params.manualReviewSync,
    stageSkillMetadata: params.stageSkillMetadata,
  };
};

export const buildRuntimeMetadata = (params: {
  workflowRunId: string;
  workflowId: string;
  status: "completed" | "failed";
  mode: ScriptProductionWorkflowMode;
  startedAt: string;
  completedAt: string;
  summary: ScriptProductionWorkflowSummary;
  traceEventCount: number;
  stageRunCount: number;
}): ScriptProductionRuntimeMetadata => ({
  workflowRunId: params.workflowRunId,
  workflowId: params.workflowId,
  status: params.status,
  mode: params.mode,
  startedAt: params.startedAt,
  completedAt: params.completedAt,
  durationMs: params.summary.durationMs,
  summary: params.summary,
  traceEventCount: params.traceEventCount,
  stageRunCount: params.stageRunCount,
});

import { TTSError } from "@/lib/error-handler";
import type { LLMExecutionEvent } from "@/lib/llm-service";
import { refineFailedSegment } from "@/lib/script-generator/pipeline/refinement/failed-segment-refinement";
import { validateSegmentScript } from "@/lib/script-generator/pipeline/segment-script-validator";
import type { ExecutionEvent } from "../protocol/events";
import type { SegmentFailureDetail, SegmentSummary } from "@/lib/script-generator/types";
import {
  checkScriptCoverage,
  validateStructuredOutput,
} from "../tools/validation-tools";
import type { LLMAdapter } from "../adapters/llm-adapter";
import type { SegmentScriptDraft, ValidationReport } from "../context";
import type { RunSegmentScriptingStageResult } from "./stages/run-segment-scripting-stage";
import type { ScriptProductionWorkflowMode } from "./run-script-production-workflow";

export interface ScriptProductionBookSegment {
  id: string;
  chapterId?: string | null;
  orderIndex?: number;
  content: string;
}

export interface SegmentOutcomeIndexItem {
  segmentId: string;
  finalStatus: "success" | "failed";
  terminalStage: string;
  errorCode?: string;
}

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

export const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown_runtime_error";
};

const buildSegmentPreview = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 120);

const INPUT_REFINEMENT_SENTENCE_BOUNDARIES = new Set([
  "。",
  "！",
  "？",
  "；",
  "!",
  "?",
  "…",
]);

const INPUT_REFINEMENT_CLOSING_QUOTES = new Set([
  "”",
  "」",
  "』",
  "’",
  "\"",
  "'",
]);

const trimSlice = (content: string, start: number, end: number) => {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && /\s/.test(content[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(content[nextEnd - 1])) {
    nextEnd -= 1;
  }

  return {
    start: nextStart,
    end: nextEnd,
    content: content.slice(nextStart, nextEnd),
  };
};

const splitSegmentForInputRefinement = (content: string) => {
  const slices: Array<{ start: number; end: number; content: string }> = [];
  let cursor = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (!INPUT_REFINEMENT_SENTENCE_BOUNDARIES.has(content[index])) {
      continue;
    }

    let end = index + 1;
    while (
      end < content.length &&
      INPUT_REFINEMENT_CLOSING_QUOTES.has(content[end])
    ) {
      end += 1;
    }

    const slice = trimSlice(content, cursor, end);
    if (slice.content.length > 0) {
      slices.push(slice);
    }
    cursor = end;
  }

  const trailing = trimSlice(content, cursor, content.length);
  if (trailing.content.length > 0) {
    slices.push(trailing);
  }

  return slices.length > 1 ? slices : [];
};

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
    typeof params.segment.orderIndex === "number" && Number.isFinite(params.segment.orderIndex)
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

export const createObservedAdapter = (params: {
  adapter: LLMAdapter;
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}): LLMAdapter => ({
  call: async (input) => {
    params.onExecutionEvent?.({
      status: "submitted",
      provider: input.provider?.name || "unknown",
      model: input.provider?.model || "unknown",
    });

    try {
      const result = await params.adapter.call(input);
      params.onExecutionEvent?.({
        status: "completed",
        content: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        attempt: result.attempt,
        usage: result.usage,
        waitMs: result.waitMs,
        retriesUsed: result.retriesUsed,
        totalElapsedMs: result.totalElapsedMs,
      });
      return result;
    } catch (error) {
      const details =
        error instanceof TTSError &&
        error.details &&
        typeof error.details === "object" &&
        !Array.isArray(error.details)
          ? (error.details as Record<string, unknown>)
          : {};
      const attempt =
        typeof details.attempt === "number" ? Number(details.attempt) : 1;
      const retriesUsed =
        typeof details.retriesUsed === "number"
          ? Number(details.retriesUsed)
          : Math.max(attempt - 1, 0);

      params.onExecutionEvent?.({
        status: "failed",
        provider:
          error instanceof TTSError
            ? error.provider
            : input.provider?.name || "unknown",
        retryable: error instanceof TTSError ? error.retryable : true,
        attempt,
        retriesUsed,
        message: asErrorMessage(error),
      });
      throw error;
    }
  },
});

export const createObservedDefaultAdapter = (params: {
  onExecutionEvent?: (event: LLMExecutionEvent) => void;
}): LLMAdapter => {
  let runtimePromise: Promise<{
    adapter: LLMAdapter;
    provider: {
      name: string;
      apiKey: string;
      baseURL?: string;
      model: string;
    };
  }> | null = null;

  const loadRuntime = async () => {
    if (!runtimePromise) {
      runtimePromise = Promise.all([
        import("../adapters/llm-adapter"),
        import("@/lib/llm-service"),
      ]).then(([adapterModule, llmServiceModule]) => {
        const provider = llmServiceModule.getConfiguredLLMProvider();
        return {
          adapter: adapterModule.createDefaultLLMAdapter(),
          provider,
        };
      });
    }

    return runtimePromise;
  };

  return {
    async call(input) {
      const runtime = await loadRuntime();
      const provider = input.provider ?? runtime.provider;

      return createObservedAdapter({
        adapter: runtime.adapter,
        onExecutionEvent: params.onExecutionEvent,
      }).call({
        ...input,
        provider,
      });
    },
  };
};

export const resolveWorkflowSegments = (params: {
  mode: ScriptProductionWorkflowMode;
  allSegments: ScriptProductionBookSegment[];
  segmentIds?: string[];
  startFromSegmentId?: string | null;
  startFromOrderIndex?: number | null;
  limitToSegments?: number;
  resolvePartial: (params: {
    segments: any[];
    startFromSegmentId?: string | null;
    startFromOrderIndex?: number | null;
    limitToSegments?: number;
  }) => any[];
}): ScriptProductionBookSegment[] => {
  if (params.mode === "partial") {
    return params.resolvePartial({
      segments: params.allSegments,
      startFromSegmentId: params.startFromSegmentId,
      startFromOrderIndex: params.startFromOrderIndex,
      limitToSegments: params.limitToSegments,
    }) as ScriptProductionBookSegment[];
  }

  if (
    params.mode === "regenerate" &&
    Array.isArray(params.segmentIds) &&
    params.segmentIds.length > 0
  ) {
    const selectedIds = new Set(params.segmentIds);
    return params.allSegments.filter((segment) => selectedIds.has(segment.id));
  }

  return params.allSegments;
};

export const buildValidationReport = (params: {
  segment: ScriptProductionBookSegment;
  draft: SegmentScriptDraft;
}): ValidationReport => {
  const requiredRoot = validateStructuredOutput({
    value: params.draft,
    requiredKeys: ["segmentId", "lines"],
  });
  const issues: ValidationReport["issues"] = [];

  if (!requiredRoot.valid) {
    issues.push({
      code: "MISSING_REQUIRED_FIELDS",
      message: `missing fields: ${requiredRoot.missingKeys.join(", ")}`,
    });
  }

  const sourceFragments = Array.isArray(params.draft.lines)
    ? params.draft.lines
        .map((line) => (typeof line.sourceText === "string" ? line.sourceText : ""))
        .filter((text) => text.trim().length > 0)
    : [];
  const coverage = checkScriptCoverage({
    sourceText: params.segment.content,
    scriptFragments: sourceFragments,
  });

  const validatorResult = validateSegmentScript({
    segmentContent: params.segment.content,
    scriptSentences: params.draft.lines.map((line) => ({
      text: line.text,
      sourceText: line.sourceText,
      speaker: line.speaker,
    })),
  });

  const seenIssues = new Set<string>();
  for (const issue of validatorResult.issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seenIssues.has(key)) {
      continue;
    }
    seenIssues.add(key);
    issues.push({
      code: issue.code,
      message: issue.message,
    });
  }

  return {
    segmentId: params.segment.id,
    valid: issues.length === 0,
    coverageRatio: validatorResult.coverageRatio || coverage.coverageRatio,
    issues,
  };
};

export const buildInputRefinementSegments = (params: {
  segment: ScriptProductionBookSegment;
  validationReport?: ValidationReport;
}): ScriptProductionBookSegment[] => {
  const refineByIssues = (issueCodes: string[]) =>
    refineFailedSegment({
      segment: {
        id: params.segment.id,
        chapterId: params.segment.chapterId ?? null,
        orderIndex: params.segment.orderIndex,
        content: params.segment.content,
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes,
        coverageRatio: params.validationReport?.coverageRatio,
      },
    });

  const issueCodes = params.validationReport
    ? params.validationReport.issues.map((issue) => issue.code)
    : ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"];
  const refinedSegments = refineByIssues(issueCodes);

  const genericFallbackSegments =
    refinedSegments.length <= 1
      ? splitSegmentForInputRefinement(params.segment.content).map((slice, index) => ({
          id: `${params.segment.id}::refined-${index + 1}`,
          chapterId: params.segment.chapterId ?? null,
          orderIndex:
            typeof params.segment.orderIndex === "number"
              ? params.segment.orderIndex
              : -1,
          content: slice.content,
        }))
      : refinedSegments.map((slice) => ({
          id: slice.id,
          chapterId: slice.chapterId,
          orderIndex: slice.orderIndex,
          content: slice.content,
        }));

  return genericFallbackSegments;
};

export const mergeRefinedSegmentDrafts = (params: {
  parentSegmentId: string;
  drafts: SegmentScriptDraft[];
  now?: () => Date;
}): SegmentScriptDraft => {
  let nextOrder = 0;

  const lines = params.drafts.flatMap((draft) =>
    draft.lines.map((line) => ({
      ...line,
      id: `${params.parentSegmentId}::refined-line-${nextOrder + 1}`,
      orderInSegment: nextOrder++,
    }))
  );

  return {
    segmentId: params.parentSegmentId,
    lines,
    createdAt: (params.now ?? (() => new Date()))().toISOString(),
  };
};

export const toSegmentSummary = (
  segmentId: string,
  lineCount: number,
  characters: string[]
): SegmentSummary => ({
  segmentId,
  lineCount,
  characters,
});

export const resolveFailureArtifact = (
  result: Exclude<RunSegmentScriptingStageResult, { status: "completed" }>
): unknown => {
  const failedArtifact =
    result && typeof result === "object" && "failedArtifact" in result
      ? (result as { failedArtifact?: unknown }).failedArtifact
      : undefined;

  if (failedArtifact !== undefined) {
    return failedArtifact;
  }

  return {
    kind: "segment-scripting-failure",
    message: result.error || "segment_scripting_failed",
  };
};

export const createValidationTraceEvent = (params: {
  createId: () => string;
  now?: () => Date;
  workflowRunId: string;
  stageRunId: string;
  segment: ScriptProductionBookSegment;
  validationReport: ValidationReport;
}): ExecutionEvent => ({
  id: params.createId(),
  kind: params.validationReport.valid
    ? "validation.completed"
    : "validation.failed",
  createdAt: (params.now ?? (() => new Date()))().toISOString(),
  workflowRunId: params.workflowRunId,
  stageRunId: params.stageRunId,
  status: params.validationReport.valid ? "completed" : "failed",
  payload: {
    segmentId: params.segment.id,
    chapterId: params.segment.chapterId ?? null,
    orderIndex:
      typeof params.segment.orderIndex === "number" ? params.segment.orderIndex : -1,
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
    typeof params.segment.orderIndex === "number" ? params.segment.orderIndex : -1,
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

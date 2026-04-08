import { refineFailedSegment } from "./failed-segment-refinement";
import { validateSegmentScript } from "./segment-script-validator";
import type { SegmentSummary } from "../types";
import type { SegmentScriptDraft, ValidationReport } from "../../../context";
import {
  checkScriptCoverage,
  validateStructuredOutput,
} from "../../../tools/validation-tools";
import type { RunSegmentScriptingStageResult } from "../../stages/run-segment-scripting-stage";
import type { ScriptProductionBookSegment } from "../shared-types";

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
      ? splitSegmentForInputRefinement(params.segment.content).map(
          (slice, index) => ({
            id: `${params.segment.id}::refined-${index + 1}`,
            chapterId: params.segment.chapterId ?? null,
            orderIndex:
              typeof params.segment.orderIndex === "number"
                ? params.segment.orderIndex
                : -1,
            content: slice.content,
          })
        )
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

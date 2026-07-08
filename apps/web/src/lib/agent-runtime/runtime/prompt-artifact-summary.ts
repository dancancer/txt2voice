interface PromptArtifactSummaryOptions {
  maxRawResponseChars?: number;
  maxLines?: number;
}

const DEFAULT_RAW_RESPONSE_CHARS = 600;
const DEFAULT_MAX_LINES = 3;
const DEFAULT_LINE_TEXT_CHARS = 160;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const truncateText = (value: unknown, maxChars: number): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.slice(0, Math.max(0, maxChars));
};

const summarizeStructuredResult = (
  value: unknown,
  maxLines: number
): Record<string, unknown> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const summary: Record<string, unknown> = {};

  if (typeof value.segmentId === "string") {
    summary.segmentId = value.segmentId;
  }
  if (typeof value.valid === "boolean") {
    summary.valid = value.valid;
  }
  if (typeof value.coverageRatio === "number") {
    summary.coverageRatio = value.coverageRatio;
  }
  if (Array.isArray(value.issues)) {
    summary.issues = value.issues.slice(0, maxLines);
  }
  if (Array.isArray(value.lines)) {
    summary.lines = value.lines.slice(0, maxLines).map((line) => {
      if (!isRecord(line)) {
        return line;
      }

      return {
        id: line.id,
        sourceText: truncateText(line.sourceText, DEFAULT_LINE_TEXT_CHARS),
        text: truncateText(line.text, DEFAULT_LINE_TEXT_CHARS),
        speaker: line.speaker,
        orderInSegment: line.orderInSegment,
      };
    });
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
};

const summarizeValidationReport = (
  value: unknown,
  maxLines: number
): Record<string, unknown> | undefined => {
  return summarizeStructuredResult(value, maxLines);
};

export const summarizePromptArtifact = (
  artifact: unknown,
  options: PromptArtifactSummaryOptions = {}
): Record<string, unknown> | null => {
  if (!isRecord(artifact)) {
    return artifact === undefined ? null : { value: artifact };
  }

  const maxRawResponseChars =
    options.maxRawResponseChars ?? DEFAULT_RAW_RESPONSE_CHARS;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;

  const summary: Record<string, unknown> = {};

  if (typeof artifact.kind === "string") {
    summary.kind = artifact.kind;
  }
  if (typeof artifact.segmentId === "string") {
    summary.segmentId = artifact.segmentId;
  }
  if (typeof artifact.provider === "string") {
    summary.provider = artifact.provider;
  }
  if (typeof artifact.model === "string") {
    summary.model = artifact.model;
  }
  if (typeof artifact.message === "string") {
    summary.message = artifact.message;
  }

  const rawResponseExcerpt = truncateText(
    artifact.rawResponse,
    maxRawResponseChars
  );
  if (rawResponseExcerpt) {
    summary.rawResponseExcerpt = rawResponseExcerpt;
  }

  const structuredResult = summarizeStructuredResult(
    artifact.structuredResult,
    maxLines
  );
  if (structuredResult) {
    summary.structuredResult = structuredResult;
  }

  const directStructuredSummary = summarizeStructuredResult(artifact, maxLines);
  if (directStructuredSummary) {
    Object.assign(summary, directStructuredSummary);
  }

  const validationReport = summarizeValidationReport(
    artifact.validationReport,
    maxLines
  );
  if (validationReport) {
    summary.validationReport = validationReport;
  }

  return summary;
};

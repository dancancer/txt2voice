export type RawScriptSentence = {
  text?: unknown;
  sourceText?: unknown;
  speaker?: unknown;
};

export type SegmentScriptValidationIssueCode =
  | "EMPTY_DIALOGUES"
  | "MISSING_SOURCE_TEXT"
  | "EMPTY_TEXT"
  | "TEXT_SOURCE_MISMATCH"
  | "SOURCE_NOT_FOUND"
  | "NON_WHITESPACE_GAP"
  | "QUOTED_NARRATION"
  | "LOW_COVERAGE";

export interface SegmentScriptValidationIssue {
  code: SegmentScriptValidationIssueCode;
  message: string;
  index?: number;
  preview?: string;
}

export interface ValidatedScriptSentence {
  text: string;
  sourceText: string;
  speaker: string;
  sourceStart: number;
  sourceEnd: number;
  resolvedText: string;
}

export interface SegmentScriptValidationResult {
  valid: boolean;
  issues: SegmentScriptValidationIssue[];
  coverageRatio: number;
  lines: ValidatedScriptSentence[];
}

export interface QuotedSpan {
  body: string;
  start: number;
  end: number;
}

export interface BoundaryFragment {
  edge: string;
  detached: string;
}

export interface SegmentScriptDraftLine {
  id: string;
  sourceText: string;
  text: string;
  speaker: string;
  orderInSegment: number;
}

export interface SegmentScriptDraft {
  segmentId: string;
  lines: SegmentScriptDraftLine[];
  createdAt: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationReport {
  segmentId: string;
  valid: boolean;
  coverageRatio: number;
  issues: ValidationIssue[];
}

export type RepairAction = "retry" | "refine" | "manual_review";

export interface RepairDecision {
  segmentId: string;
  action: RepairAction;
  reason: string;
  retryable: boolean;
}

export type QualityDecision = "pass" | "fail" | "manual_review";

export interface QualityVerdict {
  segmentId: string;
  verdict: QualityDecision;
  score: number;
  reasons: string[];
}

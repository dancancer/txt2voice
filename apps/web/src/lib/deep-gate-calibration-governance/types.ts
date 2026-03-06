// 一旦我被更新，请更新我的开头注释
// input: 阈值治理模块类型定义
// output: 常量与接口声明
// pos: 阈值治理类型模块
import type { DeepGateThresholdTemplate, QualityGateVerdict } from "@/lib/quality-gate/types";

export const DEFAULT_SAMPLE_LIMIT = 240;
export const MIN_SAMPLE_LIMIT = 20;
export const MAX_SAMPLE_LIMIT = 2000;
export const MAX_OPERATOR_LENGTH = 64;
export const MAX_CHANGE_NOTE_LENGTH = 500;
export const MAX_GOVERNANCE_HISTORY = 80;

export const SUPPORTED_VERDICTS: QualityGateVerdict[] = [
  "pass",
  "repair",
  "manual_review",
  "hard_fail",
];

export interface CalibrationSample {
  q4Score: number;
  q5Score: number;
  expectedVerdict: QualityGateVerdict;
  issueType: string;
  source: string;
  fallbackUsed: boolean;
}

export interface RateSummaryBucket {
  total: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
}

export interface EvaluationSummary {
  sampleSize: number;
  passLikeCount: number;
  reviewLikeCount: number;
  exactMatchCount: number;
  exactMatchRate: number;
  falsePositiveCount: number;
  falsePositiveRate: number;
  falseNegativeCount: number;
  falseNegativeRate: number;
  fallbackCount: number;
  fallbackRate: number;
  predictedVerdictCounts: Record<QualityGateVerdict, number>;
  issueTypeBreakdown: Record<string, RateSummaryBucket>;
  sourceBreakdown: Record<string, RateSummaryBucket>;
}

export interface EvaluationComparison {
  exactMatchRateDelta: number;
  falsePositiveRateDelta: number;
  falseNegativeRateDelta: number;
  fallbackRateDelta: number;
}

export interface DeepGateCalibrationReportRecord {
  id: string;
  status: "evaluated" | "published";
  createdAt: string;
  createdBy: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
  sampleSize: number;
  baselineTemplate: DeepGateThresholdTemplate;
  candidateTemplate: DeepGateThresholdTemplate;
  baselineSummary: EvaluationSummary | null;
  candidateSummary: EvaluationSummary | null;
  comparison: EvaluationComparison | null;
  publishedVersion: number | null;
}

export interface DeepGateThresholdReleaseRecord {
  id: string;
  version: number;
  status: "active" | "superseded";
  changeType: "publish" | "rollback";
  reportId: string | null;
  template: DeepGateThresholdTemplate;
  createdAt: string;
  publishedBy: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
  previousVersion: number | null;
  rollbackTargetVersion: number | null;
}

export interface DeepGateThresholdGovernanceState {
  reports: DeepGateCalibrationReportRecord[];
  releases: DeepGateThresholdReleaseRecord[];
  activeVersion: number;
  activeReleaseId: string | null;
}

export interface EvaluateDeepGateCalibrationPayload {
  sampleLimit: number;
  samples: CalibrationSample[] | null;
  baselineTemplate: DeepGateThresholdTemplate | null;
  candidateTemplate: DeepGateThresholdTemplate | null;
  createdBy: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
}

export interface PublishDeepGateCalibrationPayload {
  reportId: string;
  publishedBy: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
  expectedVersion: number | null;
}

export interface RollbackDeepGateCalibrationPayload {
  targetVersion: number;
  rolledBackBy: string | null;
  reviewedBy: string | null;
  changeNote: string | null;
  expectedVersion: number | null;
}


// 一旦我被更新，请更新我的开头注释
// input: 质量门控流程类型
// output: Deep Gate/融合判定共享类型
// pos: 质量门控类型模块

export type QualityGateVerdict = "pass" | "repair" | "manual_review" | "hard_fail";

export type QualityIssueType = "FAST_GATE" | "EMOTION" | "CONTINUITY";

export interface FastGateSnapshot {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q1Score: number;
  q2Score: number;
  q3Score: number;
  charsPerSecond: number;
  reasons: string[];
  repairPlan: string[];
}

export interface DeepGateThresholdTemplate {
  q4PassScore: number;
  q4ManualReviewScore: number;
  q5PassScore: number;
  q5ManualReviewScore: number;
  chapterPassScore: number;
  chapterRepairScore: number;
  hardFailScore: number;
  falsePositiveDelta: number;
}

export interface DeepGateThresholdResolution {
  template: DeepGateThresholdTemplate;
  source: "default" | "book_metadata" | "task_override";
}

export interface ChapterGateContext {
  chapterId: string;
  sampleCount: number;
  averageCharsPerSecond: number;
  roleTypeAverages: Record<string, number>;
  voiceProfileAverages: Record<string, number>;
}

export interface ChapterGateSample {
  chapterId: string;
  roleType: string;
  voiceProfileId: string;
  charsPerSecond: number;
}

export interface DeepGateInput {
  text: string;
  roleType?: string | null;
  emotionLabel?: string | null;
  emotionIntensity?: number | null;
  charsPerSecond: number;
  chapterContext?: ChapterGateContext;
  voiceProfileId?: string | null;
}

export interface DeepGateDecision {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q4Score: number;
  q5Score: number;
  reasons: string[];
  repairPlan: string[];
  issueType: QualityIssueType;
}

export interface CombinedQualityDecision {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q1Score: number;
  q2Score: number;
  q3Score: number;
  q4Score: number;
  q5Score: number;
  fastGateScore: number;
  deepGateScore: number;
  charsPerSecond: number;
  reasons: string[];
  repairPlan: string[];
  issueType: QualityIssueType;
}

export const DEFAULT_DEEP_GATE_TEMPLATE: DeepGateThresholdTemplate = {
  q4PassScore: 74,
  q4ManualReviewScore: 58,
  q5PassScore: 74,
  q5ManualReviewScore: 60,
  chapterPassScore: 85,
  chapterRepairScore: 72,
  hardFailScore: 35,
  falsePositiveDelta: 16,
};

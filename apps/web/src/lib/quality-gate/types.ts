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

export type Q4ScoreSource = "heuristic" | "emotion_model";

export type Q5ScoreSource = "heuristic" | "continuity_model";

export interface DeepGateModelRuntime {
  useEmotionModel: boolean;
  useContinuityModel: boolean;
  emotionModelUrl: string | null;
  continuityModelUrl: string | null;
  timeoutMs: number;
}

export interface DeepGateModelRuntimeResolution {
  runtime: DeepGateModelRuntime;
  source: "default" | "book_metadata" | "task_override";
}

export interface DeepGateModelInference {
  q4Score?: number;
  q5Score?: number;
  reasons: string[];
  q4Source: Q4ScoreSource;
  q5Source: Q5ScoreSource;
  diagnostics: Record<string, unknown>;
}

export interface DeepGateDecision {
  verdict: QualityGateVerdict;
  hardFail: boolean;
  score: number;
  q4Score: number;
  q5Score: number;
  q4Source: Q4ScoreSource;
  q5Source: Q5ScoreSource;
  reasons: string[];
  repairPlan: string[];
  issueType: QualityIssueType;
  modelDiagnostics: Record<string, unknown>;
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
  q4Source: Q4ScoreSource;
  q5Source: Q5ScoreSource;
  fastGateScore: number;
  deepGateScore: number;
  charsPerSecond: number;
  reasons: string[];
  repairPlan: string[];
  issueType: QualityIssueType;
}

export interface DeepGateCalibrationSample {
  verdict: QualityGateVerdict;
  q4Score: number;
  q5Score: number;
}

export interface DeepGateScoreQuantiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface DeepGateCalibrationSnapshot {
  sampleSize: number;
  passLikeCount: number;
  reviewLikeCount: number;
  stable: boolean;
  quantiles: {
    q4: DeepGateScoreQuantiles | null;
    q5: DeepGateScoreQuantiles | null;
  };
  recommendation: {
    q4PassScore: number;
    q4ManualReviewScore: number;
    q5PassScore: number;
    q5ManualReviewScore: number;
  };
  deltas: {
    q4PassDelta: number;
    q4ManualReviewDelta: number;
    q5PassDelta: number;
    q5ManualReviewDelta: number;
  };
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

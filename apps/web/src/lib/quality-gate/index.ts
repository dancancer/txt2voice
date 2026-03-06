// 一旦我被更新，请更新我的开头注释
// input: 质量门控模块导入
// output: Deep Gate 核心 API 导出
// pos: 质量门控聚合入口

export { resolveDeepGateThresholdTemplate, buildChapterGateContextMap } from "@/lib/quality-gate/thresholds";

export {
  evaluateDeepGate,
  combineQualityGateDecision,
  isFalsePositiveCandidate,
} from "@/lib/quality-gate/evaluator";

export type {
  CombinedQualityDecision,
  DeepGateDecision,
  DeepGateInput,
  DeepGateModelInference,
  DeepGateModelRuntime,
  DeepGateModelRuntimeResolution,
  DeepGateCalibrationSample,
  DeepGateCalibrationSnapshot,
  DeepGateThresholdResolution,
  DeepGateThresholdTemplate,
  FastGateSnapshot,
  ChapterGateContext,
  ChapterGateSample,
  DeepGateScoreQuantiles,
  Q4ScoreSource,
  Q5ScoreSource,
  QualityGateVerdict,
  QualityIssueType,
} from "@/lib/quality-gate/types";

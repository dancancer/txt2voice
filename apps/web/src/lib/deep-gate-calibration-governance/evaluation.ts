// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 样本与阈值模板
// output: 评估摘要、对比增量与样本解析
// pos: 阈值治理评估模块
import { Prisma } from "@/lib/prisma";
import { DeepGateThresholdTemplate, QualityGateVerdict } from "@/lib/quality-gate/types";
import {
  CalibrationSample,
  EvaluationComparison,
  EvaluationSummary,
  RateSummaryBucket,
} from "@/lib/deep-gate-calibration-governance/types";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  clampScore,
  parseVerdict,
  roundRate,
} from "@/lib/deep-gate-calibration-governance/parsers";

const isReviewLikeVerdict = (verdict: QualityGateVerdict): boolean => {
  return verdict === "manual_review" || verdict === "hard_fail";
};

export const classifyVerdict = ({
  template,
  q4Score,
  q5Score,
}: {
  template: DeepGateThresholdTemplate;
  q4Score: number;
  q5Score: number;
}): QualityGateVerdict => {
  if (q4Score <= template.hardFailScore && q5Score <= template.hardFailScore) {
    return "hard_fail";
  }
  if (q4Score < template.q4ManualReviewScore || q5Score < template.q5ManualReviewScore) {
    return "manual_review";
  }
  if (q4Score < template.q4PassScore || q5Score < template.q5PassScore) {
    return "repair";
  }
  return "pass";
};

const createEmptyBucket = (): RateSummaryBucket => {
  return {
    total: 0,
    falsePositiveCount: 0,
    falseNegativeCount: 0,
  };
};

export const buildEvaluationSummary = ({
  template,
  samples,
}: {
  template: DeepGateThresholdTemplate;
  samples: CalibrationSample[];
}): EvaluationSummary => {
  const predictedVerdictCounts: Record<QualityGateVerdict, number> = {
    pass: 0,
    repair: 0,
    manual_review: 0,
    hard_fail: 0,
  };
  const issueTypeBreakdown: Record<string, RateSummaryBucket> = {};
  const sourceBreakdown: Record<string, RateSummaryBucket> = {};

  let passLikeCount = 0;
  let reviewLikeCount = 0;
  let exactMatchCount = 0;
  let falsePositiveCount = 0;
  let falseNegativeCount = 0;
  let fallbackCount = 0;

  for (const sample of samples) {
    const predictedVerdict = classifyVerdict({
      template,
      q4Score: sample.q4Score,
      q5Score: sample.q5Score,
    });
    predictedVerdictCounts[predictedVerdict] += 1;

    const expectedReviewLike = isReviewLikeVerdict(sample.expectedVerdict);
    const predictedReviewLike = isReviewLikeVerdict(predictedVerdict);
    if (expectedReviewLike) {
      reviewLikeCount += 1;
    } else {
      passLikeCount += 1;
    }
    if (sample.fallbackUsed) {
      fallbackCount += 1;
    }

    const exactMatch = predictedVerdict === sample.expectedVerdict;
    const falsePositive = !expectedReviewLike && predictedReviewLike;
    const falseNegative = expectedReviewLike && !predictedReviewLike;

    if (exactMatch) {
      exactMatchCount += 1;
    }
    if (falsePositive) {
      falsePositiveCount += 1;
    }
    if (falseNegative) {
      falseNegativeCount += 1;
    }

    const issueKey = sample.issueType || "UNKNOWN";
    const sourceKey = sample.source || "unknown";
    const issueBucket = issueTypeBreakdown[issueKey] || createEmptyBucket();
    const sourceBucket = sourceBreakdown[sourceKey] || createEmptyBucket();

    issueBucket.total += 1;
    sourceBucket.total += 1;
    if (falsePositive) {
      issueBucket.falsePositiveCount += 1;
      sourceBucket.falsePositiveCount += 1;
    }
    if (falseNegative) {
      issueBucket.falseNegativeCount += 1;
      sourceBucket.falseNegativeCount += 1;
    }

    issueTypeBreakdown[issueKey] = issueBucket;
    sourceBreakdown[sourceKey] = sourceBucket;
  }

  const sampleSize = samples.length;
  return {
    sampleSize,
    passLikeCount,
    reviewLikeCount,
    exactMatchCount,
    exactMatchRate: roundRate(sampleSize > 0 ? exactMatchCount / sampleSize : 0),
    falsePositiveCount,
    falsePositiveRate: roundRate(passLikeCount > 0 ? falsePositiveCount / passLikeCount : 0),
    falseNegativeCount,
    falseNegativeRate: roundRate(reviewLikeCount > 0 ? falseNegativeCount / reviewLikeCount : 0),
    fallbackCount,
    fallbackRate: roundRate(sampleSize > 0 ? fallbackCount / sampleSize : 0),
    predictedVerdictCounts,
    issueTypeBreakdown,
    sourceBreakdown,
  };
};

export const buildEvaluationComparison = ({
  baseline,
  candidate,
}: {
  baseline: EvaluationSummary;
  candidate: EvaluationSummary;
}): EvaluationComparison => {
  return {
    exactMatchRateDelta: roundRate(candidate.exactMatchRate - baseline.exactMatchRate),
    falsePositiveRateDelta: roundRate(
      candidate.falsePositiveRate - baseline.falsePositiveRate
    ),
    falseNegativeRateDelta: roundRate(
      candidate.falseNegativeRate - baseline.falseNegativeRate
    ),
    fallbackRateDelta: roundRate(candidate.fallbackRate - baseline.fallbackRate),
  };
};

export const parseQualityResultSample = (
  qualityResult: {
    verdict: string;
    metrics: Prisma.JsonValue;
    detail: Prisma.JsonValue;
  }
): CalibrationSample | null => {
  const metrics = asRecord(qualityResult.metrics);
  const detail = asRecord(qualityResult.detail);
  const deepGate = asRecord(detail?.deepGate);

  const q4Score = asNumber(metrics?.q4Score);
  const q5Score = asNumber(metrics?.q5Score);
  if (q4Score === undefined || q5Score === undefined) {
    return null;
  }

  const expectedVerdict =
    parseVerdict(asRecord(detail?.calibrationLabel)?.expectedVerdict) ||
    parseVerdict(detail?.expectedVerdict) ||
    parseVerdict(qualityResult.verdict);
  if (!expectedVerdict) {
    return null;
  }

  const diagnostics = asRecord(deepGate?.modelDiagnostics);
  return {
    q4Score: clampScore(q4Score),
    q5Score: clampScore(q5Score),
    expectedVerdict,
    issueType: (asString(detail?.issueType) || "UNKNOWN").toUpperCase(),
    source: (
      asString(detail?.source) ||
      asString(deepGate?.modelRuntimeSource) ||
      "unknown"
    ).toLowerCase(),
    fallbackUsed: asBoolean(diagnostics?.fallbackUsed) || false,
  };
};


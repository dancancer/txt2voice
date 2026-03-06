// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 评分样本与当前阈值
// output: 阈值重标定快照
// pos: Deep Gate 阈值校准模块

import type {
  DeepGateCalibrationSample,
  DeepGateCalibrationSnapshot,
  DeepGateScoreQuantiles,
  DeepGateThresholdTemplate,
} from "@/lib/quality-gate/types";

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const clampDelta = (value: number): number => {
  return Number(value.toFixed(2));
};

const sortNumbers = (values: number[]): number[] => {
  return [...values].sort((left, right) => left - right);
};

const percentile = (values: number[], ratio: number): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = sortNumbers(values);
  const boundedRatio = Math.max(0, Math.min(1, ratio));
  const index = (sorted.length - 1) * boundedRatio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return clampScore(sorted[lower]);
  }

  const weight = index - lower;
  return clampScore(sorted[lower] * (1 - weight) + sorted[upper] * weight);
};

const buildQuantiles = (values: number[]): DeepGateScoreQuantiles | null => {
  if (values.length === 0) {
    return null;
  }

  return {
    p10: percentile(values, 0.1) || 0,
    p25: percentile(values, 0.25) || 0,
    p50: percentile(values, 0.5) || 0,
    p75: percentile(values, 0.75) || 0,
    p90: percentile(values, 0.9) || 0,
  };
};

const recommendThresholdPair = ({
  passLikeScores,
  reviewLikeScores,
  currentPassScore,
  currentManualReviewScore,
}: {
  passLikeScores: number[];
  reviewLikeScores: number[];
  currentPassScore: number;
  currentManualReviewScore: number;
}): { passScore: number; manualReviewScore: number } => {
  if (passLikeScores.length < 6 || reviewLikeScores.length < 6) {
    return {
      passScore: currentPassScore,
      manualReviewScore: currentManualReviewScore,
    };
  }

  const passP35 = percentile(passLikeScores, 0.35) || currentPassScore;
  const passP55 = percentile(passLikeScores, 0.55) || currentPassScore;
  const reviewP75 = percentile(reviewLikeScores, 0.75) || currentManualReviewScore;

  let manualReviewScore = clampScore((passP35 + reviewP75) / 2);
  let passScore = clampScore(Math.max(manualReviewScore + 8, passP55));

  if (passScore <= manualReviewScore) {
    passScore = clampScore(manualReviewScore + 4);
  }
  if (manualReviewScore >= passScore) {
    manualReviewScore = clampScore(passScore - 4);
  }

  return {
    passScore,
    manualReviewScore,
  };
};

const isPassLikeVerdict = (verdict: DeepGateCalibrationSample["verdict"]): boolean => {
  return verdict === "pass" || verdict === "repair";
};

export const buildDeepGateCalibrationSnapshot = ({
  samples,
  template,
}: {
  samples: DeepGateCalibrationSample[];
  template: DeepGateThresholdTemplate;
}): DeepGateCalibrationSnapshot => {
  const q4Scores = samples.map((sample) => sample.q4Score);
  const q5Scores = samples.map((sample) => sample.q5Score);

  const passLikeQ4 = samples
    .filter((sample) => isPassLikeVerdict(sample.verdict))
    .map((sample) => sample.q4Score);
  const reviewLikeQ4 = samples
    .filter((sample) => !isPassLikeVerdict(sample.verdict))
    .map((sample) => sample.q4Score);

  const passLikeQ5 = samples
    .filter((sample) => isPassLikeVerdict(sample.verdict))
    .map((sample) => sample.q5Score);
  const reviewLikeQ5 = samples
    .filter((sample) => !isPassLikeVerdict(sample.verdict))
    .map((sample) => sample.q5Score);

  const q4Recommendation = recommendThresholdPair({
    passLikeScores: passLikeQ4,
    reviewLikeScores: reviewLikeQ4,
    currentPassScore: template.q4PassScore,
    currentManualReviewScore: template.q4ManualReviewScore,
  });
  const q5Recommendation = recommendThresholdPair({
    passLikeScores: passLikeQ5,
    reviewLikeScores: reviewLikeQ5,
    currentPassScore: template.q5PassScore,
    currentManualReviewScore: template.q5ManualReviewScore,
  });

  const stable =
    samples.length >= 24 &&
    passLikeQ4.length >= 6 &&
    reviewLikeQ4.length >= 6 &&
    passLikeQ5.length >= 6 &&
    reviewLikeQ5.length >= 6;

  const recommendation = stable
    ? {
        q4PassScore: q4Recommendation.passScore,
        q4ManualReviewScore: q4Recommendation.manualReviewScore,
        q5PassScore: q5Recommendation.passScore,
        q5ManualReviewScore: q5Recommendation.manualReviewScore,
      }
    : {
        q4PassScore: template.q4PassScore,
        q4ManualReviewScore: template.q4ManualReviewScore,
        q5PassScore: template.q5PassScore,
        q5ManualReviewScore: template.q5ManualReviewScore,
      };

  return {
    sampleSize: samples.length,
    passLikeCount: passLikeQ4.length,
    reviewLikeCount: reviewLikeQ4.length,
    stable,
    quantiles: {
      q4: buildQuantiles(q4Scores),
      q5: buildQuantiles(q5Scores),
    },
    recommendation,
    deltas: {
      q4PassDelta: clampDelta(recommendation.q4PassScore - template.q4PassScore),
      q4ManualReviewDelta: clampDelta(
        recommendation.q4ManualReviewScore - template.q4ManualReviewScore
      ),
      q5PassDelta: clampDelta(recommendation.q5PassScore - template.q5PassScore),
      q5ManualReviewDelta: clampDelta(
        recommendation.q5ManualReviewScore - template.q5ManualReviewScore
      ),
    },
  };
};

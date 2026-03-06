// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 阈值校准模块
// output: 阈值建议与样本稳定性断言
// pos: Deep Gate 校准测试
import { buildDeepGateCalibrationSnapshot } from "@/lib/quality-check/deep-gate-calibration";
import { DEFAULT_DEEP_GATE_TEMPLATE } from "@/lib/quality-gate/types";

describe("buildDeepGateCalibrationSnapshot", () => {
  it("should keep original thresholds when sample size is insufficient", () => {
    const snapshot = buildDeepGateCalibrationSnapshot({
      samples: [
        {
          verdict: "pass",
          q4Score: 88,
          q5Score: 86,
        },
        {
          verdict: "manual_review",
          q4Score: 55,
          q5Score: 57,
        },
      ],
      template: DEFAULT_DEEP_GATE_TEMPLATE,
    });

    expect(snapshot.stable).toBe(false);
    expect(snapshot.recommendation).toEqual({
      q4PassScore: DEFAULT_DEEP_GATE_TEMPLATE.q4PassScore,
      q4ManualReviewScore: DEFAULT_DEEP_GATE_TEMPLATE.q4ManualReviewScore,
      q5PassScore: DEFAULT_DEEP_GATE_TEMPLATE.q5PassScore,
      q5ManualReviewScore: DEFAULT_DEEP_GATE_TEMPLATE.q5ManualReviewScore,
    });
  });

  it("should produce recalibrated thresholds with enough samples", () => {
    const passSamples = Array.from({ length: 16 }, (_, index) => ({
      verdict: "pass" as const,
      q4Score: 82 + (index % 6),
      q5Score: 80 + (index % 5),
    }));
    const repairSamples = Array.from({ length: 8 }, (_, index) => ({
      verdict: "repair" as const,
      q4Score: 74 + (index % 4),
      q5Score: 72 + (index % 4),
    }));
    const reviewSamples = Array.from({ length: 10 }, (_, index) => ({
      verdict: "manual_review" as const,
      q4Score: 48 + (index % 8),
      q5Score: 46 + (index % 7),
    }));

    const snapshot = buildDeepGateCalibrationSnapshot({
      samples: [...passSamples, ...repairSamples, ...reviewSamples],
      template: DEFAULT_DEEP_GATE_TEMPLATE,
    });

    expect(snapshot.stable).toBe(true);
    expect(snapshot.sampleSize).toBe(34);
    expect(snapshot.recommendation.q4PassScore).toBeGreaterThan(
      snapshot.recommendation.q4ManualReviewScore
    );
    expect(snapshot.recommendation.q5PassScore).toBeGreaterThan(
      snapshot.recommendation.q5ManualReviewScore
    );
    expect(snapshot.quantiles.q4?.p90).toBeGreaterThan(snapshot.quantiles.q4?.p10 || 0);
    expect(snapshot.quantiles.q5?.p90).toBeGreaterThan(snapshot.quantiles.q5?.p10 || 0);
  });
});

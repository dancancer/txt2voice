// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 工具函数
// output: 阈值解析与判定结果断言
// pos: 质量门控测试
import {
  buildChapterGateContextMap,
  combineQualityGateDecision,
  evaluateDeepGate,
  isFalsePositiveCandidate,
  resolveDeepGateThresholdTemplate,
} from "@/lib/quality-gate";

describe("quality-gate thresholds", () => {
  it("should merge book template and task override", () => {
    const resolution = resolveDeepGateThresholdTemplate({
      bookMetadata: {
        qualityCheck: {
          deepGateThresholdTemplate: {
            q4PassScore: 80,
            q4ManualReviewScore: 63,
          },
        },
      },
      taskMetadata: {
        deepGateThresholdTemplate: {
          q5PassScore: 82,
          q5ManualReviewScore: 70,
          falsePositiveDelta: 11,
        },
      },
    });

    expect(resolution.source).toBe("task_override");
    expect(resolution.template).toMatchObject({
      q4PassScore: 80,
      q4ManualReviewScore: 63,
      q5PassScore: 82,
      q5ManualReviewScore: 70,
      falsePositiveDelta: 11,
    });
  });
});

describe("quality-gate chapter context", () => {
  it("should build chapter-level pace context", () => {
    const contextMap = buildChapterGateContextMap([
      {
        chapterId: "chapter-1",
        roleType: "dialogue",
        voiceProfileId: "voice-a",
        charsPerSecond: 3,
      },
      {
        chapterId: "chapter-1",
        roleType: "dialogue",
        voiceProfileId: "voice-a",
        charsPerSecond: 5,
      },
      {
        chapterId: "chapter-1",
        roleType: "narration",
        voiceProfileId: "",
        charsPerSecond: 4,
      },
    ]);

    const chapterContext = contextMap.get("chapter-1");
    expect(chapterContext).toMatchObject({
      sampleCount: 3,
      averageCharsPerSecond: 4,
      roleTypeAverages: {
        dialogue: 4,
      },
      voiceProfileAverages: {
        "voice-a": 4,
      },
    });
  });
});

describe("quality-gate decisions", () => {
  const thresholds = resolveDeepGateThresholdTemplate({
    bookMetadata: {},
    taskMetadata: {},
  }).template;

  it("should mark deep gate mismatch when calm text is too aggressive", () => {
    const deep = evaluateDeepGate({
      input: {
        text: "你给我现在立刻站住！！！",
        roleType: "dialogue",
        emotionLabel: "calm",
        emotionIntensity: 0.3,
        charsPerSecond: 9.4,
        chapterContext: {
          chapterId: "chapter-1",
          sampleCount: 6,
          averageCharsPerSecond: 3.2,
          roleTypeAverages: {
            dialogue: 3,
          },
          voiceProfileAverages: {
            "voice-a": 3,
          },
        },
        voiceProfileId: "voice-a",
      },
      thresholds,
    });

    expect(deep.verdict).toBe("hard_fail");
    expect(deep.issueType).toBe("CONTINUITY");
    expect(deep.reasons).toContain("emotion_overexpressed");
  });

  it("should promote deep issue type when fast gate passes", () => {
    const deep = evaluateDeepGate({
      input: {
        text: "我知道了。",
        roleType: "dialogue",
        emotionLabel: "joy",
        emotionIntensity: 0.9,
        charsPerSecond: 1.3,
        chapterContext: {
          chapterId: "chapter-1",
          sampleCount: 5,
          averageCharsPerSecond: 2.8,
          roleTypeAverages: {
            dialogue: 2.8,
          },
          voiceProfileAverages: {
            "voice-a": 2.8,
          },
        },
        voiceProfileId: "voice-a",
      },
      thresholds,
    });

    const combined = combineQualityGateDecision({
      fast: {
        verdict: "pass",
        hardFail: false,
        score: 91,
        q1Score: 92,
        q2Score: 90,
        q3Score: 90,
        charsPerSecond: 1.3,
        reasons: [],
        repairPlan: ["retry_with_same_engine"],
      },
      deep,
    });

    expect(combined.verdict).toBe("manual_review");
    expect(combined.issueType).toBe("EMOTION");
    expect(
      isFalsePositiveCandidate({
        fast: {
          verdict: "pass",
          hardFail: false,
          score: 91,
          q1Score: 92,
          q2Score: 90,
          q3Score: 90,
          charsPerSecond: 1.3,
          reasons: [],
          repairPlan: ["retry_with_same_engine"],
        },
        deep,
        combined,
        thresholds: {
          ...thresholds,
          q4ManualReviewScore: 72,
          q5ManualReviewScore: 72,
          falsePositiveDelta: 16,
        },
      })
    ).toBe(false);
  });

  it("should flag false positive candidate near manual-review boundary", () => {
    expect(
      isFalsePositiveCandidate({
        fast: {
          verdict: "pass",
          hardFail: false,
          score: 89,
          q1Score: 90,
          q2Score: 90,
          q3Score: 88,
          charsPerSecond: 2.3,
          reasons: [],
          repairPlan: [],
        },
        deep: {
          verdict: "manual_review",
          hardFail: false,
          score: 69,
          q4Score: 66,
          q5Score: 70,
          reasons: ["emotion_mismatch"],
          repairPlan: ["increase_emotion_intensity_0.10"],
          issueType: "EMOTION",
        },
        combined: {
          verdict: "manual_review",
          hardFail: false,
          score: 75,
          q1Score: 90,
          q2Score: 90,
          q3Score: 88,
          q4Score: 66,
          q5Score: 70,
          fastGateScore: 89,
          deepGateScore: 69,
          charsPerSecond: 2.3,
          reasons: ["emotion_mismatch"],
          repairPlan: ["increase_emotion_intensity_0.10"],
          issueType: "EMOTION",
        },
        thresholds: {
          ...thresholds,
          q4ManualReviewScore: 70,
          q5ManualReviewScore: 70,
          falsePositiveDelta: 2,
        },
      })
    ).toBe(true);
  });
});

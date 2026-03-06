// 一旦我被更新，请更新我的开头注释
// input: Q0-Q3 运行时样本
// output: 信号解析与快检断言
// pos: 指标化质量门控测试
import {
  evaluateQ0Q3Signals,
  extractQ0Q3RawSignals,
  resolveQ0Q3SignalSources,
  resolveQ0Q3ThresholdTemplate,
} from "@/lib/quality-check/q0q3-runtime";

describe("q0q3-runtime signal resolution", () => {
  it("should resolve signal sources with task override", () => {
    const resolution = resolveQ0Q3SignalSources({
      bookMetadata: {
        qualityCheck: {
          signalSources: {
            q2: ["heuristic"],
          },
        },
      },
      taskMetadata: {
        signalSources: {
          q2: ["attempt_metrics", "heuristic"],
          q3: ["task_payload"],
        },
      },
    });

    expect(resolution.source).toBe("task_override");
    expect(resolution.config.q2).toEqual(["attempt_metrics", "heuristic"]);
    expect(resolution.config.q3).toEqual(["task_payload"]);
  });

  it("should resolve thresholds with metadata merge", () => {
    const resolution = resolveQ0Q3ThresholdTemplate({
      bookMetadata: {
        qualityCheck: {
          q0q3Thresholds: {
            q2CerDialoguePass: 0.07,
            q3SpeakerLeadPass: 0.84,
          },
        },
      },
      taskMetadata: {
        q0q3Thresholds: {
          q2CerDialoguePass: 0.06,
        },
      },
    });

    expect(resolution.source).toBe("task_override");
    expect(resolution.template.q2CerDialoguePass).toBe(0.06);
    expect(resolution.template.q3SpeakerLeadPass).toBe(0.84);
  });
});

describe("q0q3-runtime extraction", () => {
  it("should merge attempt metrics and task payload override", () => {
    const signals = extractQ0Q3RawSignals({
      attemptMetrics: {
        cer: 0.11,
        speakerSimilarity: 0.77,
      },
      taskMetadata: {
        signalPayloadByAudioFileId: {
          "audio-1": {
            cer: 0.09,
            clipping: true,
          },
        },
      },
      audioFileId: "audio-1",
      sentenceId: "sentence-1",
    });

    expect(signals).toMatchObject({
      cer: 0.09,
      speakerSimilarity: 0.77,
      clipping: true,
    });
  });
});

describe("q0q3-runtime evaluate", () => {
  it("should route high CER to manual review with CER issue type", () => {
    const result = evaluateQ0Q3Signals({
      text: "这是一个测试句子",
      roleType: "dialogue",
      priority: "high",
      emotionIntensity: 0.8,
      durationSeconds: 4,
      hasVoiceProfile: true,
      rawSignals: {
        cer: 0.15,
        speakerSimilarity: 0.9,
        clipping: false,
        leadingSilenceMs: 40,
        trailingSilenceMs: 60,
        lufs: -19,
      },
      signalSources: {
        q0: ["heuristic"],
        q1: ["attempt_metrics", "heuristic"],
        q2: ["attempt_metrics"],
        q3: ["attempt_metrics"],
      },
      thresholds: resolveQ0Q3ThresholdTemplate({
        taskMetadata: null,
        bookMetadata: null,
      }).template,
    });

    expect(result.verdict).toBe("hard_fail");
    expect(result.issueType).toBe("CER");
    expect(result.reasons).toContain("cer_hard_fail");
    expect(result.signalValues.q2Cer).toBe(0.15);
  });

  it("should force manual review for dialogue without voice profile", () => {
    const result = evaluateQ0Q3Signals({
      text: "你是谁？",
      roleType: "dialogue",
      priority: "normal",
      emotionIntensity: 0.5,
      durationSeconds: 5,
      hasVoiceProfile: false,
      rawSignals: {
        cer: null,
        speakerSimilarity: null,
        clipping: null,
        leadingSilenceMs: null,
        trailingSilenceMs: null,
        lufs: null,
      },
      signalSources: resolveQ0Q3SignalSources({
        taskMetadata: null,
        bookMetadata: null,
      }).config,
      thresholds: resolveQ0Q3ThresholdTemplate({
        taskMetadata: null,
        bookMetadata: null,
      }).template,
    });

    expect(result.verdict).toBe("manual_review");
    expect(result.issueType).toBe("SPEAKER");
    expect(result.reasons).toContain("voice_profile_missing_for_dialogue");
  });
});

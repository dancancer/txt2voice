// 一旦我被更新，请更新我的开头注释
// input: 路由候选/上下文/引擎健康快照
// output: 路由命中与降级行为断言
// pos: 音频路由模块测试
import {
  AudioRouteCandidate,
  AudioRouteContext,
  AudioRouteEngineHealth,
  selectAudioRouteCandidate,
} from "@/lib/audio-engine-router";

const buildContext = (overrides: Partial<AudioRouteContext> = {}): AudioRouteContext => ({
  roleType: "dialogue",
  emotionLabel: "angry",
  priority: "high",
  engineHint: "voxcpm",
  preferredProvider: null,
  policyVersion: "engine-router-v1",
  debugEnabled: false,
  ...overrides,
});

const buildHealth = (
  overrides: Partial<Record<string, AudioRouteEngineHealth>> = {}
): Record<string, AudioRouteEngineHealth> => ({
  voxcpm: {
    provider: "voxcpm",
    sampleSize: 20,
    failureRate: 0.05,
    timeoutRate: 0.01,
    healthy: true,
    updatedAt: "2026-03-06T00:00:00.000Z",
  },
  indextts: {
    provider: "indextts",
    sampleSize: 20,
    failureRate: 0.1,
    timeoutRate: 0.02,
    healthy: true,
    updatedAt: "2026-03-06T00:00:00.000Z",
  },
  ...overrides,
});

const buildCandidates = (): AudioRouteCandidate[] => [
  {
    candidateId: "variant-1",
    source: "speaker_engine_variant",
    provider: "voxcpm",
    voiceId: "voice-a",
    voiceProfile: {
      provider: "voxcpm",
      voiceId: "voice-a",
    },
    isDefault: true,
    routingWeight: 1.8,
    capability: {
      dialogue: true,
      lowLatency: true,
    },
    emotionPresets: [
      {
        emotionLabel: "angry",
        aliases: ["furious"],
      },
    ],
    speakerProfileId: 11,
    speakerEngineVariantId: "sev-1",
  },
  {
    candidateId: "binding-1",
    source: "character_voice_binding",
    provider: "indextts",
    voiceId: "voice-b",
    voiceProfile: {
      id: "vp-1",
      provider: "indextts",
      voiceId: "voice-b",
    },
    isDefault: false,
  },
];

describe("audio-engine-router", () => {
  it("should prefer speaker variant candidate when emotion and capability match", () => {
    const selection = selectAudioRouteCandidate({
      candidates: buildCandidates(),
      context: buildContext(),
      engineHealth: buildHealth(),
    });

    expect(selection.selectedCandidate?.candidateId).toBe("variant-1");
    expect(selection.decision.selectedSource).toBe("speaker_engine_variant");
    expect(selection.decision.selectedEngine).toBe("voxcpm");
    expect(selection.decision.isFallback).toBe(false);
  });

  it("should downgrade to next healthy candidate when top engine health is poor", () => {
    const selection = selectAudioRouteCandidate({
      candidates: buildCandidates(),
      context: buildContext(),
      engineHealth: buildHealth({
        voxcpm: {
          provider: "voxcpm",
          sampleSize: 40,
          failureRate: 0.92,
          timeoutRate: 0.45,
          healthy: false,
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      }),
    });

    expect(selection.selectedCandidate?.candidateId).toBe("binding-1");
    expect(selection.decision.selectedEngine).toBe("indextts");
    expect(selection.decision.fallbackDepth).toBe(0);
    expect(selection.rankedCandidates[1]?.candidateId).toBe("variant-1");
  });

  it("should always prioritize manual voice profile candidate", () => {
    const selection = selectAudioRouteCandidate({
      candidates: [
        {
          candidateId: "manual-1",
          source: "manual_voice_profile",
          provider: "indextts",
          voiceId: "voice-manual",
          voiceProfile: {
            id: "vp-manual",
            provider: "indextts",
            voiceId: "voice-manual",
          },
          isDefault: true,
        },
        ...buildCandidates(),
      ],
      context: buildContext(),
      engineHealth: buildHealth(),
    });

    expect(selection.selectedCandidate?.candidateId).toBe("manual-1");
    expect(selection.decision.selectedSource).toBe("manual_voice_profile");
  });

  it("should skip ineligible candidates without voice id", () => {
    const selection = selectAudioRouteCandidate({
      candidates: [
        {
          candidateId: "variant-no-voice",
          source: "speaker_engine_variant",
          provider: "voxcpm",
          voiceId: null,
          voiceProfile: null,
          isDefault: true,
          routingWeight: 2,
        },
        ...buildCandidates(),
      ],
      context: buildContext(),
      engineHealth: buildHealth(),
    });

    expect(selection.selectedCandidate?.candidateId).toBe("variant-1");
    expect(selection.rankedCandidates[0].candidateId).toBe("variant-1");
    expect(selection.rankedCandidates.find((item) => item.candidateId === "variant-no-voice")?.eligible).toBe(false);
  });
});

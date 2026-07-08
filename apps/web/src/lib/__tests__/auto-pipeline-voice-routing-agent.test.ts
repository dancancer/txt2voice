// 一旦我被更新，请更新我的开头注释
// input: 台词路由上下文/Prisma mock
// output: 零人工声音路由优先级断言
// pos: 自动编排声音路由 Agent 测试
import { runVoiceRoutingAgent } from "@/lib/auto-pipeline/voice-routing-agent";

const buildPrismaClient = () =>
  ({
    tTSVoiceProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    characterVoiceBinding: {
      findFirst: jest.fn(),
    },
    characterProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    speakerProfile: {
      create: jest.fn(),
    },
    speakerEngineVariant: {
      create: jest.fn(),
    },
    characterSpeakerBinding: {
      create: jest.fn(),
    },
    scriptSentence: {
      update: jest.fn(),
    },
    synthesisAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }) as any;

const buildSentence = (overrides: Record<string, unknown> = {}) => ({
  id: "sentence-1",
  bookId: "book-1",
  roleType: "dialogue",
  emotionLabel: "calm",
  tone: "calm",
  priority: "normal",
  character: {
    voiceBindings: [],
    speakerBindings: [],
  },
  book: {
    metadata: {},
  },
  ...overrides,
});

describe("auto-pipeline voice routing agent", () => {
  it("keeps explicit voice profile above preferred VoxCPM fallback", async () => {
    const prismaClient = buildPrismaClient();
    prismaClient.tTSVoiceProfile.findUnique.mockResolvedValue({
      id: "voice-explicit",
      provider: "voxcpm",
      voiceId: "manual-voice-1",
      defaultParameters: {},
    });

    const decision = await runVoiceRoutingAgent({
      scriptSentence: buildSentence(),
      request: {
        scriptSentenceId: "sentence-1",
        voiceProfileId: "voice-explicit",
      },
      options: {
        preferredProvider: "voxcpm",
      },
      prismaClient,
    });

    expect(decision.manualReviewRequired).toBe(false);
    expect(decision.routeResolution?.selectedCandidate).toMatchObject({
      source: "manual_voice_profile",
      provider: "voxcpm",
      voiceId: "manual-voice-1",
    });
  });

  it("uses VoxCPM default only when no explicit route exists", async () => {
    const prismaClient = buildPrismaClient();
    prismaClient.characterVoiceBinding.findFirst.mockResolvedValue(null);
    prismaClient.tTSVoiceProfile.findFirst.mockResolvedValue(null);

    const decision = await runVoiceRoutingAgent({
      scriptSentence: buildSentence(),
      request: {
        scriptSentenceId: "sentence-1",
      },
      options: {
        preferredProvider: "voxcpm",
      },
      prismaClient,
    });

    expect(decision.manualReviewRequired).toBe(false);
    expect(decision.routeResolution?.selectedCandidate).toMatchObject({
      source: "narration_fallback",
      provider: "voxcpm",
      voiceId: "__voxcpm_default__",
    });
  });

  it("creates a stable VoxCPM speaker route for unbound characters", async () => {
    const prismaClient = buildPrismaClient();
    prismaClient.speakerProfile.create.mockResolvedValue({
      id: 11,
      name: "门后的人",
      isActive: true,
      referenceAudio: null,
      engineVariants: [],
    });
    prismaClient.speakerEngineVariant.create.mockResolvedValue({
      id: "variant-11",
      engine: "voxcpm",
      providerVoiceId: "__voxcpm_default__",
      referenceAudio: null,
      capability: {},
      emotionPresets: [],
      isActive: true,
      isDefault: true,
      routingWeight: 1,
    });
    prismaClient.characterSpeakerBinding.create.mockResolvedValue({
      id: "binding-11",
      isDefault: true,
    });
    prismaClient.characterVoiceBinding.findFirst.mockResolvedValue(null);
    prismaClient.tTSVoiceProfile.findFirst.mockResolvedValue(null);

    const decision = await runVoiceRoutingAgent({
      scriptSentence: buildSentence({
        character: {
          id: "char-local",
          canonicalName: "门后的人",
          genderHint: "unknown",
          voiceBindings: [],
          speakerBindings: [],
        },
      }),
      request: {
        scriptSentenceId: "sentence-1",
      },
      options: {
        preferredProvider: "voxcpm",
      },
      prismaClient,
    });

    expect(decision.manualReviewRequired).toBe(false);
    expect(decision.routeResolution?.selectedCandidate).toMatchObject({
      source: "speaker_engine_variant",
      provider: "voxcpm",
      speakerProfileId: 11,
      speakerEngineVariantId: "variant-11",
    });
  });
});

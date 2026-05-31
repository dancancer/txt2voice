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
      provider: "qwen3voice",
      voiceId: "qwen-voice-1",
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
      provider: "qwen3voice",
      voiceId: "qwen-voice-1",
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
});

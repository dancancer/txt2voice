// 一旦我被更新，请更新我的开头注释
// input: 路由指标查询参数/合成尝试数据 mock
// output: 聚合指标与过滤行为断言
// pos: 音频路由观测服务测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    synthesisAttempt: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getAudioRouterMetrics,
  parseAudioRouterMetricsQuery,
} from "@/lib/audio-router-metrics-service";

const mockFindMany = (prisma as any).synthesisAttempt.findMany as jest.Mock;

describe("audio-router-metrics-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should aggregate router metrics with fallback and rule counts", async () => {
    mockFindMany.mockResolvedValue([
      {
        status: "completed",
        engine: "voxcpm",
        requestPayload: {
          routerDecision: {
            selectedSource: "speaker_engine_variant",
            selectedEngine: "voxcpm",
            selectedRule: "speaker_engine_variant+emotion_exact",
            policyVersion: "router-v1",
            isFallback: false,
          },
        },
      },
      {
        status: "failed",
        engine: "indextts",
        requestPayload: {
          routerDecision: {
            selectedSource: "character_voice_binding",
            selectedEngine: "indextts",
            selectedRule: "character_voice_binding+preferred_provider",
            policyVersion: "router-v1",
            isFallback: true,
          },
        },
      },
      {
        status: "completed",
        engine: "indextts",
        requestPayload: {
          some: "legacy_payload_without_router",
        },
      },
    ]);

    const result = await getAudioRouterMetrics({
      bookId: "book-1",
      query: {
        windowDays: 7,
      },
    });

    expect(result.totals.total).toBe(3);
    expect(result.totals.success).toBe(2);
    expect(result.totals.failed).toBe(1);
    expect(result.totals.fallbackCount).toBe(1);
    expect(result.totals.decisionCount).toBe(2);
    expect(result.totals.decisionCoverageRate).toBeCloseTo(0.6667, 4);
    expect(result.byEngine[0].engine).toBe("indextts");
    expect(result.bySource.map((item) => item.source)).toContain("unknown");
    expect(result.topRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "speaker_engine_variant+emotion_exact", count: 1 }),
        expect.objectContaining({ rule: "character_voice_binding+preferred_provider", count: 1 }),
      ])
    );
  });

  it("should support source filter", async () => {
    mockFindMany.mockResolvedValue([
      {
        status: "completed",
        engine: "voxcpm",
        requestPayload: {
          routerDecision: {
            selectedSource: "speaker_engine_variant",
            selectedEngine: "voxcpm",
            selectedRule: "speaker_engine_variant",
            policyVersion: "router-v1",
            isFallback: false,
          },
        },
      },
      {
        status: "completed",
        engine: "indextts",
        requestPayload: {
          routerDecision: {
            selectedSource: "character_voice_binding",
            selectedEngine: "indextts",
            selectedRule: "character_voice_binding",
            policyVersion: "router-v1",
            isFallback: true,
          },
        },
      },
    ]);

    const result = await getAudioRouterMetrics({
      bookId: "book-1",
      query: {
        windowDays: 7,
        source: "speaker_engine_variant",
      },
    });

    expect(result.totals.total).toBe(1);
    expect(result.bySource).toEqual([
      expect.objectContaining({ source: "speaker_engine_variant", total: 1 }),
    ]);
  });

  it("should parse query params with defaults", () => {
    const query = parseAudioRouterMetricsQuery(new URLSearchParams("source=Speaker_Engine_Variant&days=14"));

    expect(query.windowDays).toBe(14);
    expect(query.source).toBe("speaker_engine_variant");
    expect(query.engine).toBeUndefined();
    expect(query.policyVersion).toBeUndefined();
  });
});

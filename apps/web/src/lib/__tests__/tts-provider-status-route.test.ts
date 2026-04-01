// 一旦我被更新，请更新我的开头注释
// input: provider 状态路由请求/health 与 probe mock
// output: 轻量 health 与真实 synth probe 路由断言
// pos: API 集成测试
var mockIndexHealth = jest.fn();
var mockCosyHealth = jest.fn();
var mockVoxHealth = jest.fn();
jest.mock("next/server", () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Headers;

    constructor(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers);
    }

    static json(data: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
      return new MockNextResponse(data, init);
    }

    async json() {
      return this.body;
    }
  }

  return {
    NextRequest: class MockNextRequest {},
    NextResponse: MockNextResponse,
  };
});

jest.mock("@/lib/indextts-service", () => ({
  IndexTTSService: jest.fn().mockImplementation(() => ({
    healthCheck: mockIndexHealth,
  })),
}));

jest.mock("@/lib/cosyvoice-service", () => ({
  CosyVoiceService: jest.fn().mockImplementation(() => ({
    healthCheck: mockCosyHealth,
  })),
}));

jest.mock("@/lib/voxcpm-service", () => ({
  VoxCPMService: jest.fn().mockImplementation(() => ({
    healthCheck: mockVoxHealth,
  })),
}));

jest.mock("@/lib/tts-runtime-probe", () => ({
  __esModule: true,
  probeTtsProviderRuntime: jest.fn(),
}));

import { GET } from "@/app/api/tts/providers/status/route";
import { probeTtsProviderRuntime } from "@/lib/tts-runtime-probe";

const mockProbeTtsProviderRuntime =
  probeTtsProviderRuntime as jest.MockedFunction<typeof probeTtsProviderRuntime>;

describe("GET /api/tts/providers/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexHealth.mockResolvedValue({ status: "ok" });
    mockCosyHealth.mockResolvedValue({ status: "ok" });
    mockVoxHealth.mockResolvedValue({ status: "ok" });
  });

  it("should only run lightweight health checks by default", async () => {
    const response: any = await GET({
      url: "http://localhost/api/tts/providers/status",
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.providers).toHaveLength(3);
    expect(mockProbeTtsProviderRuntime).not.toHaveBeenCalled();
  });

  it("should append synth probe result when probe=true", async () => {
    mockProbeTtsProviderRuntime
      .mockResolvedValueOnce({
        provider: "indextts",
        healthy: true,
        message: "真实合成可用",
        latencyMs: 12,
        checkedAt: "2026-03-17T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        provider: "cosyvoice",
        healthy: false,
        message: "参考音频缺失",
        latencyMs: 4,
        checkedAt: "2026-03-17T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        provider: "voxcpm",
        healthy: true,
        message: "真实合成可用",
        latencyMs: 8,
        checkedAt: "2026-03-17T00:00:00.000Z",
      });

    const response: any = await GET({
      url: "http://localhost/api/tts/providers/status?probe=true",
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "cosyvoice",
          healthy: true,
          probeHealthy: false,
          probeMessage: "参考音频缺失",
        }),
      ])
    );
    expect(mockProbeTtsProviderRuntime).toHaveBeenCalledTimes(3);
  });
});

// 一旦我被更新，请更新我的开头注释
// input: voices route 请求/provider 与 Prisma mock
// output: VoxCPM-only 声音列表过滤断言
// pos: API 集成测试
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

jest.mock("@/lib/tts-service", () => ({
  ttsServiceManager: {
    ready: jest.fn().mockResolvedValue(undefined),
    getAvailableProviders: jest.fn(() => [
      {
        name: "VoxCPM2",
        type: "voxcpm",
        supportedVoices: [
          {
            id: "__voxcpm_default__",
            name: "voxcpm2-default",
            displayName: "VoxCPM2 默认音色",
            language: "zh-CN",
            gender: "neutral",
            age: "adult",
            style: ["narration"],
            isNeural: true,
          },
        ],
      },
    ]),
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    tTSVoiceProfile: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/tts/voices/route";

const mockFindMany = (prisma as any).tTSVoiceProfile.findMany as jest.Mock;

describe("GET /api/tts/voices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("filters custom voices to active VoxCPM providers", async () => {
    await GET({
      url: "http://localhost/api/tts/voices?includeCustom=true",
    } as any);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: { in: ["voxcpm"] },
        }),
      })
    );
  });

  it("does not return custom voices for unsupported provider queries", async () => {
    const response: any = await GET({
      url: "http://localhost/api/tts/voices?includeCustom=true&provider=legacy-provider",
    } as any);
    const payload = await response.json();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: "__unsupported__",
        }),
      })
    );
    expect(payload.data.voices).toEqual([]);
  });
});

export {};

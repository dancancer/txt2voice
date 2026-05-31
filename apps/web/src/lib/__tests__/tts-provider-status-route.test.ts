// 一旦我被更新，请更新我的开头注释
// input: provider 状态路由请求/health fetch mock
// output: Qwen3Voice 与 VoxCPM2 轻量 health 路由断言
// pos: API 集成测试
const fetchMock = jest.fn();

global.fetch = fetchMock as unknown as typeof fetch;

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

import { GET } from "@/app/api/tts/providers/status/route";

describe("GET /api/tts/providers/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
  });

  it("returns lightweight health for configured providers", async () => {
    const response: any = await GET({
      url: "http://localhost/api/tts/providers/status",
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.providers).toEqual([
      expect.objectContaining({
        provider: "qwen3voice",
        endpoint: "http://192.168.88.9:18080",
        healthy: true,
      }),
      expect.objectContaining({
        provider: "voxcpm",
        endpoint: "http://192.168.88.9:18083",
        healthy: true,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps one failed provider from hiding the other provider", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });

    const response: any = await GET({
      url: "http://localhost/api/tts/providers/status",
    } as any);
    const payload = await response.json();

    expect(payload.data.providers).toEqual([
      expect.objectContaining({
        provider: "qwen3voice",
        healthy: false,
        message: "503 Service Unavailable",
      }),
      expect.objectContaining({
        provider: "voxcpm",
        healthy: true,
      }),
    ]);
  });
});

export {};


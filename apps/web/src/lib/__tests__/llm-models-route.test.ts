// 一旦我被更新，请更新我的开头注释
// input: LLM 模型列表路由请求/环境变量
// output: 列表结构与脱敏断言
// pos: API 路由测试
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

const listSelectableLLMModels = jest.fn();

jest.mock("@/lib/llm-model-config-service", () => ({
  listSelectableLLMModels: (...args: unknown[]) =>
    listSelectableLLMModels(...args),
}));

import { GET } from "@/app/api/llm/models/route";

describe("GET /api/llm/models", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listSelectableLLMModels.mockResolvedValue({
      defaultModelId: "qwen-local",
      source: "database",
      models: [
        {
          id: "deepseek-cloud",
          label: "DeepSeek Cloud",
          provider: "custom",
          baseURL: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
        },
        {
          id: "qwen-local",
          label: "Qwen Local",
          provider: "custom",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
        },
      ],
    });
  });

  it("should return the registry list without exposing api keys", async () => {
    const response: any = await GET({
      url: "http://localhost/api/llm/models",
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.defaultModelId).toBe("qwen-local");
    expect(payload.data.models).toEqual([
      expect.objectContaining({
        id: "deepseek-cloud",
        label: "DeepSeek Cloud",
        provider: "custom",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      }),
      expect.objectContaining({
        id: "qwen-local",
        label: "Qwen Local",
        provider: "custom",
        baseURL: "http://192.168.88.9:8028/v1",
        model: "Qwen3.5-9B-GGUF-Q4_K_M",
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("cloud-key");
    expect(JSON.stringify(payload)).not.toContain("local-key");
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 设置路由请求/配置中心服务 mock
// output: LLM 设置 CRUD 路由断言
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

const listPersistedLLMModelConfigs = jest.fn();
const createLLMModelConfig = jest.fn();
const updateLLMModelConfig = jest.fn();
const deleteLLMModelConfig = jest.fn();
const ensureDefaultLLMModelConfig = jest.fn();

jest.mock("@/lib/llm-model-config-service", () => {
  const { z } = require("zod") as typeof import("zod");

  return {
    listPersistedLLMModelConfigs: (...args: unknown[]) =>
      listPersistedLLMModelConfigs(...args),
    createLLMModelConfig: (...args: unknown[]) => createLLMModelConfig(...args),
    updateLLMModelConfig: (...args: unknown[]) => updateLLMModelConfig(...args),
    deleteLLMModelConfig: (...args: unknown[]) => deleteLLMModelConfig(...args),
    ensureDefaultLLMModelConfig: (...args: unknown[]) =>
      ensureDefaultLLMModelConfig(...args),
    llmModelConfigSchema: z.object({
      name: z.string().trim().min(1),
      provider: z.string().trim().min(1).default("custom"),
      baseURL: z.string().trim().url(),
      model: z.string().trim().min(1),
      apiKey: z.string().optional().nullable(),
      isDefault: z.boolean().optional().default(false),
      isActive: z.boolean().optional().default(true),
      sortOrder: z.number().int().optional().default(0),
    }),
    llmModelConfigUpdateSchema: z.object({
      name: z.string().trim().min(1).optional(),
      provider: z.string().trim().min(1).optional(),
      baseURL: z.string().trim().url().optional(),
      model: z.string().trim().min(1).optional(),
      apiKey: z.string().optional().nullable(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }),
  };
});

import {
  GET as GETSettings,
  POST as POSTSettings,
} from "@/app/api/settings/llm/models/route";
import {
  DELETE as DELETEModel,
  POST as POSTModelAction,
  PUT as PUTModel,
} from "@/app/api/settings/llm/models/[id]/route";

describe("LLM settings routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list persisted llm model configs", async () => {
    listPersistedLLMModelConfigs.mockResolvedValue([
      {
        id: "model-1",
        name: "Qwen Local",
        provider: "custom",
        baseURL: "http://192.168.88.9:8028/v1",
        model: "Qwen3.5-9B-GGUF-Q4_K_M",
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        hasApiKey: false,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
    ]);

    const response: any = await GETSettings({} as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.models).toHaveLength(1);
  });

  it("should create a persisted llm model config with nullable apiKey", async () => {
    createLLMModelConfig.mockResolvedValue({
      id: "model-1",
      name: "Qwen Local",
      provider: "custom",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      hasApiKey: false,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    const response: any = await POSTSettings({
      async json() {
        return {
          name: "Qwen Local",
          provider: "custom",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
          apiKey: "",
        };
      },
    } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createLLMModelConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "",
      })
    );
    expect(payload.data.id).toBe("model-1");
  });

  it("should update, delete, and set default on persisted configs", async () => {
    updateLLMModelConfig.mockResolvedValue({ id: "model-1" });
    ensureDefaultLLMModelConfig.mockResolvedValue({ id: "model-1" });

    const putResponse: any = await PUTModel(
      {
        async json() {
          return {
            name: "Qwen Local v2",
          };
        },
      } as any,
      { params: Promise.resolve({ id: "model-1" }) } as any
    );
    const putPayload = await putResponse.json();

    expect(putPayload.data.id).toBe("model-1");
    expect(updateLLMModelConfig).toHaveBeenCalledWith(
      "model-1",
      expect.objectContaining({
        name: "Qwen Local v2",
      })
    );

    await POSTModelAction(
      {
        async json() {
          return { action: "set-default" };
        },
      } as any,
      { params: Promise.resolve({ id: "model-1" }) } as any
    );
    expect(ensureDefaultLLMModelConfig).toHaveBeenCalledWith("model-1");

    await DELETEModel(
      {} as any,
      { params: Promise.resolve({ id: "model-1" }) } as any
    );
    expect(deleteLLMModelConfig).toHaveBeenCalledWith("model-1");
  });
});

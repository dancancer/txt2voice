// 一旦我被更新，请更新我的开头注释
// input: Prisma mock/环境变量
// output: LLM 配置中心服务断言
// pos: 服务测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    llmModelConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  createLLMModelConfig,
  listSelectableLLMModels,
  resolveConfiguredLLMProvider,
  updateLLMModelConfig,
} from "@/lib/llm-model-config-service";

const prismaMock = prisma as unknown as {
  llmModelConfig: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("llm-model-config-service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback(prismaMock)
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return database-backed selectable models when persisted configs exist", async () => {
    prismaMock.llmModelConfig.findMany.mockResolvedValue([
      {
        id: "db-model-1",
        name: "Qwen Local",
        provider: "custom",
        baseURL: "http://192.168.88.9:8028/v1",
        model: "Qwen3.5-9B-GGUF-Q4_K_M",
        apiKey: null,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);

    const result = await listSelectableLLMModels();

    expect(result).toEqual({
      defaultModelId: "db-model-1",
      source: "database",
      models: [
        {
          id: "db-model-1",
          label: "Qwen Local",
          provider: "custom",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
        },
      ],
    });
  });

  it("should resolve provider from persisted database config before env fallback", async () => {
    prismaMock.llmModelConfig.findMany.mockResolvedValue([
      {
        id: "db-model-1",
        name: "Qwen Local",
        provider: "custom",
        baseURL: "http://192.168.88.9:8028/v1",
        model: "Qwen3.5-9B-GGUF-Q4_K_M",
        apiKey: null,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);
    process.env.LLM_DEFAULT_MODEL_ID = "env-default";
    process.env.LLM_MODELS_JSON = JSON.stringify([
      {
        id: "env-default",
        label: "Env Model",
        provider: "custom",
        apiKey: "env-key",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      },
    ]);

    const provider = await resolveConfiguredLLMProvider();

    expect(provider).toEqual({
      name: "custom",
      apiKey: "",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
    });
  });

  it("should make the first created config the default even if caller leaves isDefault false", async () => {
    prismaMock.llmModelConfig.findFirst.mockResolvedValue(null);
    prismaMock.llmModelConfig.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.llmModelConfig.create.mockResolvedValue({
      id: "db-model-1",
      name: "Qwen Local",
      provider: "custom",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
      apiKey: null,
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
    });

    const created = await createLLMModelConfig({
      name: "Qwen Local",
      provider: "custom",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
      apiKey: "",
      isDefault: false,
      isActive: true,
      sortOrder: 0,
    });

    expect(prismaMock.llmModelConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKey: null,
        isDefault: true,
      }),
    });
    expect(created).toMatchObject({
      id: "db-model-1",
      hasApiKey: false,
      isDefault: true,
    });
  });

  it("should reject remote persisted configs without apiKey", async () => {
    prismaMock.llmModelConfig.findMany.mockResolvedValue([
      {
        id: "db-model-remote-1",
        name: "DeepSeek Cloud",
        provider: "custom",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: null,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);

    await expect(resolveConfiguredLLMProvider()).rejects.toThrow(
      new ValidationError("当前模型缺少 API Key，且不是本地免鉴权模型")
    );
  });

  it("should reject creating remote configs without apiKey", async () => {
    prismaMock.llmModelConfig.findFirst.mockResolvedValue(null);

    await expect(
      createLLMModelConfig({
        name: "DeepSeek Cloud",
        provider: "custom",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: "",
        isDefault: false,
        isActive: true,
        sortOrder: 0,
      })
    ).rejects.toThrow("当前模型缺少 API Key，且不是本地免鉴权模型");

    expect(prismaMock.llmModelConfig.create).not.toHaveBeenCalled();
  });

  it("should reject clearing apiKey for remote configs", async () => {
    prismaMock.llmModelConfig.findUnique.mockResolvedValue({
      id: "db-model-remote-1",
      name: "DeepSeek Cloud",
      provider: "custom",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "existing-key",
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
    });

    await expect(
      updateLLMModelConfig("db-model-remote-1", {
        apiKey: "",
      })
    ).rejects.toThrow("当前模型缺少 API Key，且不是本地免鉴权模型");

    expect(prismaMock.llmModelConfig.update).not.toHaveBeenCalled();
  });
});

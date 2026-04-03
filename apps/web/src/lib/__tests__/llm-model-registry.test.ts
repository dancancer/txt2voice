import {
  getDefaultLLMModel,
  getLLMModelById,
  getLLMModelRegistrySnapshot,
} from "@/lib/llm-model-registry";

describe("llm-model-registry", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("parses multiple registry entries and resolves the default model", () => {
    const registry = getLLMModelRegistrySnapshot({
      LLM_MODELS_JSON: JSON.stringify([
        {
          id: "deepseek-cloud",
          label: "DeepSeek Cloud",
          provider: "custom",
          apiKey: "key-a",
          baseURL: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
        },
        {
          id: "qwen-local",
          label: "Qwen Local",
          provider: "custom",
          apiKey: "local-key",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
        },
      ]),
      LLM_DEFAULT_MODEL_ID: "qwen-local",
    } as NodeJS.ProcessEnv);

    expect(registry.source).toBe("registry");
    expect(registry.defaultModelId).toBe("qwen-local");
    expect(registry.models.map((item) => item.id)).toEqual([
      "deepseek-cloud",
      "qwen-local",
    ]);
    expect(getDefaultLLMModel({
      LLM_MODELS_JSON: JSON.stringify([
        {
          id: "deepseek-cloud",
          label: "DeepSeek Cloud",
          provider: "custom",
          apiKey: "key-a",
          baseURL: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
        },
        {
          id: "qwen-local",
          label: "Qwen Local",
          provider: "custom",
          apiKey: "local-key",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
        },
      ]),
      LLM_DEFAULT_MODEL_ID: "qwen-local",
    } as NodeJS.ProcessEnv)).toMatchObject({
      id: "qwen-local",
      label: "Qwen Local",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
    });
    expect(getLLMModelById("deepseek-cloud", {
      LLM_MODELS_JSON: JSON.stringify([
        {
          id: "deepseek-cloud",
          label: "DeepSeek Cloud",
          provider: "custom",
          apiKey: "key-a",
          baseURL: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
        },
        {
          id: "qwen-local",
          label: "Qwen Local",
          provider: "custom",
          apiKey: "local-key",
          baseURL: "http://192.168.88.9:8028/v1",
          model: "Qwen3.5-9B-GGUF-Q4_K_M",
        },
      ]),
      LLM_DEFAULT_MODEL_ID: "qwen-local",
    } as NodeJS.ProcessEnv)).toMatchObject({
      id: "deepseek-cloud",
      label: "DeepSeek Cloud",
    });
  });

  it("falls back to a legacy single model entry when registry json is missing", () => {
    const registry = getLLMModelRegistrySnapshot({
      LLM_PROVIDER: "custom",
      LLM_API_KEY: "legacy-key",
      LLM_BASE_URL: "https://api.deepseek.com/v1",
      LLM_MODEL: "deepseek-chat",
    } as NodeJS.ProcessEnv);

    expect(registry.source).toBe("legacy");
    expect(registry.defaultModelId).toBe("legacy-default");
    expect(registry.models).toEqual([
      {
        id: "legacy-default",
        label: "Legacy Default",
        provider: "custom",
        apiKey: "legacy-key",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      },
    ]);
  });

  it("throws when registry ids are duplicated", () => {
    expect(() =>
      getLLMModelRegistrySnapshot({
        LLM_MODELS_JSON: JSON.stringify([
          {
            id: "duplicate",
            label: "One",
            provider: "custom",
            apiKey: "key-a",
            baseURL: "https://a.example/v1",
            model: "model-a",
          },
          {
            id: "duplicate",
            label: "Two",
            provider: "custom",
            apiKey: "key-b",
            baseURL: "https://b.example/v1",
            model: "model-b",
          },
        ]),
        LLM_DEFAULT_MODEL_ID: "duplicate",
      } as NodeJS.ProcessEnv)
    ).toThrow(/重复|duplicate/i);
  });

  it("throws when the default model id does not exist", () => {
    expect(() =>
      getLLMModelRegistrySnapshot({
        LLM_MODELS_JSON: JSON.stringify([
          {
            id: "deepseek-cloud",
            label: "DeepSeek Cloud",
            provider: "custom",
            apiKey: "key-a",
            baseURL: "https://api.deepseek.com/v1",
            model: "deepseek-chat",
          },
        ]),
        LLM_DEFAULT_MODEL_ID: "missing-model",
      } as NodeJS.ProcessEnv)
    ).toThrow(/default|默认|missing/i);
  });

  it("throws a normalized config error when registry json is malformed", () => {
    expect(() =>
      getLLMModelRegistrySnapshot({
        LLM_MODELS_JSON: "{not-json",
        LLM_DEFAULT_MODEL_ID: "qwen-local",
      } as NodeJS.ProcessEnv)
    ).toThrow(/LLM_MODELS_JSON|配置无效|JSON配置错误/i);
  });
});

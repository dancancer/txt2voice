export {};

const runLLMRequest = jest.fn();
const resolveConfiguredLLMProvider = jest.fn();

jest.mock("@/lib/llm-runtime", () => ({
  runLLMRequest: (...args: unknown[]) => runLLMRequest(...args),
}));

jest.mock("@/lib/llm-service", () => ({
  resolveConfiguredLLMProvider: (...args: unknown[]) =>
    resolveConfiguredLLMProvider(...args),
}));

describe("agent runtime llm adapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses configured provider by default and returns normalized response", async () => {
    resolveConfiguredLLMProvider.mockResolvedValueOnce({
      name: "openai",
      apiKey: "key",
      model: "gpt-4.1-mini",
      baseURL: "https://api.openai.com/v1",
    });
    runLLMRequest.mockResolvedValueOnce({
      content: "hello runtime",
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 42,
      attempt: 1,
      waitMs: 11,
      usage: {
        prompt_tokens: 5,
        completion_tokens: 9,
        total_tokens: 14,
      },
    });

    const { createDefaultLLMAdapter } = await import(
      "../adapters/llm-adapter"
    );
    const adapter = createDefaultLLMAdapter();
    const result = await adapter.call({
      prompt: "你好",
      systemPrompt: "你是助手",
      metadata: { source: "agent_runtime" },
    });

    expect(resolveConfiguredLLMProvider).toHaveBeenCalledTimes(1);
    expect(runLLMRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: expect.objectContaining({
          name: "openai",
          model: "gpt-4.1-mini",
        }),
        prompt: "你好",
        systemPrompt: "你是助手",
        metadata: { source: "agent_runtime" },
      })
    );
    expect(result).toEqual({
      content: "hello runtime",
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 42,
      attempt: 1,
      waitMs: 11,
      retriesUsed: 0,
      totalElapsedMs: 42,
      usage: {
        prompt_tokens: 5,
        completion_tokens: 9,
        total_tokens: 14,
      },
    });
  });

  it("allows overriding provider and normalizes missing usage to null", async () => {
    const provider = {
      name: "custom",
      apiKey: "key-2",
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com/v1",
    };
    runLLMRequest.mockResolvedValueOnce({
      content: "override",
      provider: "custom",
      model: "deepseek-chat",
      latencyMs: 7,
      attempt: 1,
      queueJobId: "job-1",
      usage: undefined,
    } as any);

    const { createDefaultLLMAdapter } = await import(
      "../adapters/llm-adapter"
    );
    const adapter = createDefaultLLMAdapter();
    const result = await adapter.call({
      prompt: "test",
      provider,
      requestOptions: { temperature: 0.2, maxTokens: 256 },
    });

    expect(resolveConfiguredLLMProvider).not.toHaveBeenCalled();
    expect(runLLMRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider,
        requestOptions: { temperature: 0.2, maxTokens: 256 },
      })
    );
    expect(result).toEqual({
      content: "override",
      provider: "custom",
      model: "deepseek-chat",
      latencyMs: 7,
      attempt: 1,
      waitMs: 0,
      retriesUsed: 0,
      totalElapsedMs: 7,
      usage: null,
    });
  });

  it("observed default adapter can use an explicit provider override", async () => {
    const explicitProvider = {
      name: "custom",
      apiKey: "explicit-key",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
      baseURL: "http://192.168.88.9:8028/v1",
    };

    runLLMRequest.mockResolvedValueOnce({
      content: "explicit",
      provider: "custom",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
      latencyMs: 11,
      attempt: 1,
      usage: null,
    });

    const { createObservedDefaultAdapter } = await import(
      "../runtime/script-production/helpers/adapter"
    );
    const adapter = createObservedDefaultAdapter({
      provider: explicitProvider,
    } as any);

    await adapter.call({
      prompt: "test",
      metadata: { source: "agent_runtime" },
    });

    expect(resolveConfiguredLLMProvider).not.toHaveBeenCalled();
    expect(runLLMRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: explicitProvider,
      })
    );
  });

  it("maps modelPolicy to provider lookup and request options", async () => {
    process.env.LLM_DEFAULT_MODEL_ID = "balanced-model";
    process.env.LLM_CHEAP_REPAIR_MODEL_ID = "repair-model";
    process.env.LLM_QUALITY_MODEL_ID = "quality-model";

    const getProvider = jest.fn(async (modelId?: string) => ({
      name: "custom",
      apiKey: "policy-key",
      model: modelId || "fallback-model",
      baseURL: "https://llm.example/v1",
    }));

    runLLMRequest.mockResolvedValue({
      content: "policy",
      provider: "custom",
      model: "policy-model",
      latencyMs: 5,
      attempt: 1,
      usage: null,
    });

    const { createDefaultLLMAdapter } = await import(
      "../adapters/llm-adapter"
    );
    const adapter = createDefaultLLMAdapter({ getProvider });

    await adapter.call({
      prompt: "repair",
      modelPolicy: "cheap-repair",
    });
    await adapter.call({
      prompt: "quality",
      modelPolicy: "quality",
    });
    await adapter.call({
      prompt: "balanced",
      modelPolicy: "balanced",
    });

    expect(getProvider).toHaveBeenNthCalledWith(1, "repair-model");
    expect(getProvider).toHaveBeenNthCalledWith(2, "quality-model");
    expect(getProvider).toHaveBeenNthCalledWith(3, "balanced-model");
    expect(runLLMRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        requestOptions: { temperature: 0, maxTokens: 2000 },
      })
    );
    expect(runLLMRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        requestOptions: { temperature: 0.1, maxTokens: 3000 },
      })
    );
    expect(runLLMRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        requestOptions: { temperature: 0.3, maxTokens: 8000 },
      })
    );
  });

  it("fails fast for missing or unknown modelPolicy", async () => {
    const { resolveLLMExecutionPolicy } = await import(
      "../runtime/model-policy"
    );

    expect(() => resolveLLMExecutionPolicy(undefined)).toThrow(
      "modelPolicy is required"
    );
    expect(() => resolveLLMExecutionPolicy("unknown-policy")).toThrow(
      "Unsupported modelPolicy"
    );
  });
});

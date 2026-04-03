export {};

const runLLMRequest = jest.fn();
const getConfiguredLLMProvider = jest.fn();

jest.mock("@/lib/llm-runtime", () => ({
  runLLMRequest: (...args: unknown[]) => runLLMRequest(...args),
}));

jest.mock("@/lib/llm-service", () => ({
  getConfiguredLLMProvider: (...args: unknown[]) =>
    getConfiguredLLMProvider(...args),
}));

describe("agent runtime llm adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses configured provider by default and returns normalized response", async () => {
    getConfiguredLLMProvider.mockReturnValueOnce({
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

    expect(getConfiguredLLMProvider).toHaveBeenCalledTimes(1);
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

    expect(getConfiguredLLMProvider).not.toHaveBeenCalled();
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

    expect(getConfiguredLLMProvider).not.toHaveBeenCalled();
    expect(runLLMRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: explicitProvider,
      })
    );
  });
});

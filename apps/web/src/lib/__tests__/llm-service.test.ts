export {};

const runLLMRequest = jest.fn();
const createMock = jest.fn();

class MockAPIError extends Error {}
class MockRateLimitError extends MockAPIError {}
class MockAuthenticationError extends MockAPIError {}

jest.mock("@/lib/llm-runtime", () => ({
  runLLMRequest: (...args: unknown[]) => runLLMRequest(...args),
}));

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: Object.assign(
      jest.fn().mockImplementation(() => ({
        baseURL: "https://api.openai.com/v1",
        chat: {
          completions: {
            create: (...args: unknown[]) => createMock(...args),
          },
        },
      })),
      {
        APIError: MockAPIError,
        RateLimitError: MockRateLimitError,
        AuthenticationError: MockAuthenticationError,
      }
    ),
  };
});

describe("llm-service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should route callLLM through runtime instead of direct sdk calls", async () => {
    const { LLMService } = await import("@/lib/llm-service");

    runLLMRequest.mockResolvedValueOnce({
      content: "runtime-result",
      model: "gpt-test",
      provider: "openai",
      latencyMs: 20,
      attempt: 1,
      usage: null,
    });

    const service = new LLMService({
      name: "openai",
      apiKey: "key",
      model: "gpt-test",
    });

    const result = await service.callLLM("hello", "system");

    expect(result).toBe("runtime-result");
    expect(runLLMRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "hello",
        systemPrompt: "system",
        provider: expect.objectContaining({
          name: "openai",
          model: "gpt-test",
        }),
      })
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("should map rate limit errors to retryable service errors", async () => {
    const { executeProviderLLMCall } = await import("@/lib/llm-service");

    createMock.mockRejectedValueOnce(new MockRateLimitError("too many requests"));

    await expect(
      executeProviderLLMCall({
        provider: {
          name: "openai",
          apiKey: "key",
          model: "gpt-test",
        },
        prompt: "hello",
        systemPrompt: "system",
      })
    ).rejects.toMatchObject({
      code: "TTS_SERVICE_DOWN",
      retryable: true,
    });
  });

  it("should resolve configured provider with expected env priority", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm-service");

    process.env.OPENAI_API_KEY = "openai-fallback-key";
    process.env.OPENAI_BASE_URL = "https://fallback.base.url/v1";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_API_KEY = "llm-priority-key";
    process.env.LLM_BASE_URL = "https://llm.base.url/v1";
    process.env.LLM_MODEL = "deepseek-chat";

    expect(getConfiguredLLMProvider()).toEqual({
      name: "custom",
      apiKey: "llm-priority-key",
      baseURL: "https://llm.base.url/v1",
      model: "deepseek-chat",
    });
  });

  it("should resolve a specific registry model by id", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm-service");

    process.env.LLM_MODELS_JSON = JSON.stringify([
      {
        id: "deepseek-cloud",
        label: "DeepSeek Cloud",
        provider: "custom",
        apiKey: "cloud-key",
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
    ]);
    process.env.LLM_DEFAULT_MODEL_ID = "deepseek-cloud";

    expect(getConfiguredLLMProvider("qwen-local")).toEqual({
      name: "custom",
      apiKey: "local-key",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
    });
  });

  it("should resolve the default registry model when no model id is given", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm-service");

    process.env.LLM_MODELS_JSON = JSON.stringify([
      {
        id: "deepseek-cloud",
        label: "DeepSeek Cloud",
        provider: "custom",
        apiKey: "cloud-key",
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
    ]);
    process.env.LLM_DEFAULT_MODEL_ID = "qwen-local";

    expect(getConfiguredLLMProvider()).toEqual({
      name: "custom",
      apiKey: "local-key",
      baseURL: "http://192.168.88.9:8028/v1",
      model: "Qwen3.5-9B-GGUF-Q4_K_M",
    });
  });

  it("should throw TTSError when api key is missing", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm-service");
    const { TTSError } = await import("@/lib/error-handler");

    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      getConfiguredLLMProvider();
      throw new Error("expected getConfiguredLLMProvider to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TTSError);
      expect(error).toMatchObject({
        message: "LLM服务未配置，请设置API密钥",
        code: "TTS_SERVICE_DOWN",
      });
    }
  });
});

export {};

const createMock = jest.fn();

class MockAPIError extends Error {}
class MockRateLimitError extends MockAPIError {}
class MockAuthenticationError extends MockAPIError {}

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

describe("llm provider and client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("maps rate limit errors to retryable service errors", async () => {
    const { executeProviderLLMCall } = await import("@/lib/llm/client");

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

  it("resolves the configured provider from the registry env", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm/provider");

    process.env.LLM_MODELS_JSON = JSON.stringify([
      {
        id: "deepseek-cloud",
        label: "DeepSeek Cloud",
        provider: "custom",
        apiKey: "llm-registry-key",
        baseURL: "https://llm.base.url/v1",
        model: "deepseek-chat",
      },
    ]);
    process.env.LLM_DEFAULT_MODEL_ID = "deepseek-cloud";

    expect(getConfiguredLLMProvider()).toEqual({
      name: "custom",
      apiKey: "llm-registry-key",
      baseURL: "https://llm.base.url/v1",
      model: "deepseek-chat",
    });
  });

  it("resolves a specific registry model by id", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm/provider");

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

  it("resolves the default registry model when no model id is given", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm/provider");

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

  it("throws TTSError when api key is missing", async () => {
    const { getConfiguredLLMProvider } = await import("@/lib/llm/provider");
    const { TTSError } = await import("@/lib/error-handler");

    process.env.LLM_MODELS_JSON = JSON.stringify([
      {
        id: "deepseek-cloud",
        label: "DeepSeek Cloud",
        provider: "custom",
        apiKey: "",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      },
    ]);
    process.env.LLM_DEFAULT_MODEL_ID = "deepseek-cloud";

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

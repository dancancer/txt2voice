jest.mock("@mastra/core", () => ({
  Mastra: jest.fn().mockImplementation((config) => ({
    config,
  })),
}));

import {
  createMastraRuntime,
  MastraRuntimeBootstrapError,
} from "../mastra/runtime";

describe("mastra runtime bootstrap", () => {
  it("builds a Mastra runtime from the configured LLM registry", () => {
    const runtime = createMastraRuntime({
      env: {
        LLM_DEFAULT_MODEL_ID: "qwen-local",
        LLM_MODELS_JSON: JSON.stringify([
          {
            id: "qwen-local",
            label: "Qwen Local",
            provider: "custom",
            apiKey: "",
            baseURL: "http://127.0.0.1:11434/v1",
            model: "qwen3",
          },
        ]),
      },
    });

    expect(runtime.provider).toBe("custom");
    expect((runtime.mastra as unknown as { config: unknown }).config).toEqual({
      agents: {},
      workflows: {},
    });
    expect(runtime.modelProvider).toEqual({
      name: "custom",
      apiKey: "local-placeholder-key",
      baseURL: "http://127.0.0.1:11434/v1",
      model: "qwen3",
    });
  });

  it("throws a structured error when provider config is missing", () => {
    expect(() =>
      createMastraRuntime({
        env: {},
      })
    ).toThrow(MastraRuntimeBootstrapError);

    try {
      createMastraRuntime({
        env: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(MastraRuntimeBootstrapError);
      expect((error as MastraRuntimeBootstrapError).code).toBe(
        "INVALID_LLM_PROVIDER_CONFIG"
      );
    }
  });

  it("does not configure Mastra storage by default", () => {
    const runtime = createMastraRuntime({
      env: {
        LLM_DEFAULT_MODEL_ID: "qwen-local",
        LLM_MODELS_JSON: JSON.stringify([
          {
            id: "qwen-local",
            label: "Qwen Local",
            provider: "custom",
            apiKey: "",
            baseURL: "http://127.0.0.1:11434/v1",
            model: "qwen3",
          },
        ]),
      },
    });

    expect((runtime.mastra as { storage?: unknown }).storage).toBeUndefined();
  });
});

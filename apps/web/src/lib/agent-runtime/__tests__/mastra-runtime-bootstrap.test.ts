jest.mock("@mastra/core", () => ({
  Mastra: jest.fn().mockImplementation((config) => ({
    config,
  })),
}));

jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn().mockImplementation((config) => ({
    kind: "openai-provider",
    config,
  })),
}));

import { createOpenAI } from "@ai-sdk/openai";
import {
  createMastraRuntime,
  MastraRuntimeBootstrapError,
} from "../mastra/runtime";

describe("mastra runtime bootstrap", () => {
  it("builds a Mastra runtime when provider config is present", () => {
    const runtime = createMastraRuntime({
      env: {
        OPENAI_API_KEY: "test-key",
      },
    });

    expect(runtime.provider).toBe("openai");
    expect((runtime.mastra as unknown as { config: unknown }).config).toEqual({
      agents: {},
      workflows: {},
    });
    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
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
        "MISSING_OPENAI_API_KEY"
      );
    }
  });

  it("does not configure Mastra storage by default", () => {
    const runtime = createMastraRuntime({
      env: {
        OPENAI_API_KEY: "test-key",
      },
    });

    expect((runtime.mastra as { storage?: unknown }).storage).toBeUndefined();
  });
});

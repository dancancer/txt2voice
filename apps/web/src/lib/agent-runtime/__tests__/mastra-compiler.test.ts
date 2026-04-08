jest.mock("@mastra/core/agent", () => ({
  Agent: jest.fn().mockImplementation((config) => ({
    name: config.name,
    instructions: config.instructions,
    model: config.model,
  })),
}));

jest.mock("@mastra/core/workflows", () => ({
  createWorkflow: jest.fn().mockImplementation((config) => ({
    id: config.id,
    config,
  })),
}));

jest.mock("@/lib/llm/provider", () => ({
  getConfiguredLLMProvider: jest.fn((modelId?: string) => ({
    name: "openai",
    apiKey: "test-key",
    model: modelId || "gpt-4.1-mini",
    baseURL: "https://api.openai.com/v1",
  })),
}));

import path from "path";

import { getConfiguredLLMProvider } from "@/lib/llm/provider";
import { compileAgent } from "../mastra/compiler/compile-agent";
import { loadPromptBundle } from "../mastra/compiler/load-prompt-bundle";
import { compileWorkflow } from "../mastra/compiler/compile-workflow";

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const getConfiguredLLMProviderMock =
  getConfiguredLLMProvider as jest.MockedFunction<typeof getConfiguredLLMProvider>;

describe("mastra compiler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("compiles runtime authoring into a Mastra agent", () => {
    const compiled = compileAgent(workspaceRoot, "script-generation");

    expect(compiled.definition.id).toBe("script-generation-agent");
    expect(compiled.agent.name).toBe("script-generation-agent");
    expect(
      (compiled.agent as unknown as { instructions: string }).instructions
    ).toContain(
      "SegmentScriptDraft"
    );
    expect(
      (compiled.agent as unknown as { model: Record<string, unknown> }).model
    ).toEqual({
      id: "openai/gpt-4.1-mini",
      apiKey: "test-key",
      url: "https://api.openai.com/v1",
    });
  });

  it("builds an OpenAI-compatible Mastra model config for custom providers", () => {
    getConfiguredLLMProviderMock.mockReturnValueOnce({
      name: "custom",
      apiKey: "local-placeholder-key",
      baseURL: "http://127.0.0.1:11434/v1",
      model: "qwen3",
    });

    const compiled = compileAgent(workspaceRoot, "character-discovery");

    expect(
      (compiled.agent as unknown as { model: Record<string, unknown> }).model
    ).toEqual({
      id: "custom/qwen3",
      apiKey: "local-placeholder-key",
      url: "http://127.0.0.1:11434/v1",
    });
  });

  it("loads prompt bundles into system and user instructions", () => {
    const bundle = loadPromptBundle(workspaceRoot, "script-generation");

    expect(bundle.systemPrompt).toContain("SegmentScriptDraft");
    expect(bundle.userPrompt).toContain("{{segment_text}}");
  });

  it("converts workflow authoring into a stage-ordered workflow definition", () => {
    const compiled = compileWorkflow(workspaceRoot, "script-production");

    expect(compiled.definition.id).toBe("script-production");
    expect(compiled.stageOrder).toEqual([
      "prepare",
      "character_discovery",
      "segment_scripting",
      "segment_repair",
      "quality_judgement",
      "persist",
      "manual_review_handoff",
      "complete",
    ]);
    expect(compiled.runtimeSubstages).toEqual({
      segment_scripting: ["validation"],
    });
    expect(compiled.workflow.id).toBe("script-production");
  });
});

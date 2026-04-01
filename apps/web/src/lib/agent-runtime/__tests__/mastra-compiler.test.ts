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

import path from "path";

import { compileAgent } from "../mastra/compiler/compile-agent";
import { loadPromptBundle } from "../mastra/compiler/load-prompt-bundle";
import { compileWorkflow } from "../mastra/compiler/compile-workflow";

const workspaceRoot = path.resolve(__dirname, "../../../../../..");

describe("mastra compiler", () => {
  it("compiles runtime authoring into a Mastra agent", () => {
    const compiled = compileAgent(workspaceRoot, "script-generation");

    expect(compiled.definition.id).toBe("script-generation-agent");
    expect(compiled.agent.name).toBe("script-generation-agent");
    expect(
      (compiled.agent as unknown as { instructions: string }).instructions
    ).toContain(
      "SegmentScriptDraft"
    );
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
    expect(compiled.workflow.id).toBe("script-production");
  });
});

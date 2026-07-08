import type { SkillDefinition } from "../protocol";
import { validateSkillContract } from "../runtime/skill-contract";

const createSkill = (overrides?: Partial<SkillDefinition>): SkillDefinition => ({
  id: "script-generation",
  version: "1",
  kind: "generation",
  compatibleAgents: ["script-generation-agent"],
  inputSchemaRef: "segment-script-input",
  outputSchemaRef: "segment-script-draft",
  contextRequirements: ["segment", "character_memory_summary"],
  toolAllowlist: [],
  promptBundle: ["prompts/system.md", "prompts/user.md"],
  modelPolicy: "balanced",
  repairPolicy: "handoff-to-json-repair",
  successCriteria: ["returns-segment-script-draft"],
  telemetryTags: ["runtime"],
  ...overrides,
});

describe("skill contract", () => {
  it("accepts matching input and output schema contracts", () => {
    expect(() =>
      validateSkillContract({
        skill: createSkill(),
        agentId: "script-generation-agent",
        expectedContextRequirements: ["segment", "character_memory_summary"],
        expectedInputSchemaRef: "segment-script-input",
        expectedOutputSchemaRef: "segment-script-draft",
      })
    ).not.toThrow();
  });

  it("rejects mismatched inputSchemaRef before runtime execution", () => {
    expect(() =>
      validateSkillContract({
        skill: createSkill({
          inputSchemaRef: "segment-script-input-v2",
        }),
        agentId: "script-generation-agent",
        expectedContextRequirements: ["segment", "character_memory_summary"],
        expectedInputSchemaRef: "segment-script-input",
        expectedOutputSchemaRef: "segment-script-draft",
      })
    ).toThrow(
      'Skill script-generation has unsupported inputSchemaRef: expected "segment-script-input"'
    );
  });
});

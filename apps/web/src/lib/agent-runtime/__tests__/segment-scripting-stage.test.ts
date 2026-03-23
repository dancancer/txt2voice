import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const skillDir = path.join(workspaceRoot, "skills/script-generation");

describe("segment scripting stage", () => {
  it("produces SegmentScriptDraft for single segment input", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-1",
      segmentId: "segment-1",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact.kind).toBe("segment-script-draft");
    expect(result.artifact.segmentScriptDraft.segmentId).toBe("segment-1");
    expect(result.artifact.segmentScriptDraft.lines).toHaveLength(1);
  });

  it("keeps required line fields in draft", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“快走！”燕赤霞低喝。",
            text: "快走！",
            speaker: "燕赤霞",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-2",
      segmentId: "segment-2",
      segmentText: "“快走！”燕赤霞低喝。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "“快走！”燕赤霞低喝。",
      text: "快走！",
      speaker: "燕赤霞",
      orderInSegment: 0,
    });
  });

  it("returns draft artifact only and does not expose persistence outputs", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "路人甲点头。",
            text: "路人甲点头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-3",
      segmentId: "segment-3",
      segmentText: "路人甲点头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact).toEqual({
      kind: "segment-script-draft",
      skillId: "script-generation",
      segmentScriptDraft: expect.objectContaining({
        segmentId: "segment-3",
      }),
    });
    expect((result as Record<string, unknown>).scriptSentences).toBeUndefined();
    expect((result as Record<string, unknown>).persisted).toBeUndefined();
  });

  it("uses runtime skill id from skill source instead of fixed literal", async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "segment-scripting-"));
    const fixtureSkillDir = path.join(fixtureRoot, "skills/script-generation-custom");

    fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureSkillDir, "skill.toml"),
      [
        'id = "script-generation-custom"',
        'version = "1"',
        'kind = "generation"',
        'compatibleAgents = ["script-generation-agent"]',
        'inputSchemaRef = "segment-script-input"',
        'outputSchemaRef = "segment-script-draft"',
        'contextRequirements = ["segment"]',
        "toolAllowlist = []",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(fixtureSkillDir, "SKILL.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(
      path.join(fixtureSkillDir, "prompts/system.md"),
      "return json",
      "utf8"
    );
    fs.writeFileSync(
      path.join(fixtureSkillDir, "prompts/user.md"),
      "{{segment_text}}",
      "utf8"
    );

    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-skill-id",
      segmentId: "segment-skill-id",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    expect(result.artifact.skillId).toBe("script-generation-custom");
  });

  it("does not inject character memory summary into prompt for current minimal contract", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    await runSegmentScriptingStage({
      workflowRunId: "wf-segment-no-memory-summary",
      segmentId: "segment-no-memory-summary",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0];
    expect(call.prompt).not.toContain("角色记忆摘要");
    expect(call.prompt).not.toContain("{{character_memory_summary}}");
  });

  it("fails stage when adapter returns non-json payload", async () => {
    const adapter = createMockAdapter("not-json");

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-non-json",
      segmentId: "segment-fail-non-json",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("fails stage when payload is empty object or lines is not array", async () => {
    const adapterWithEmptyObject = createMockAdapter("{}");
    const emptyObjectResult = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-empty-object",
      segmentId: "segment-fail-empty-object",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter: adapterWithEmptyObject,
    });

    const adapterWithInvalidLines = createMockAdapter(
      JSON.stringify({
        lines: {},
      })
    );
    const invalidLinesResult = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-lines-object",
      segmentId: "segment-fail-lines-object",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter: adapterWithInvalidLines,
    });

    expect(emptyObjectResult.status).toBe("failed");
    expect("artifact" in emptyObjectResult).toBe(false);
    expect(invalidLinesResult.status).toBe("failed");
    expect("artifact" in invalidLinesResult).toBe(false);
  });

  it("fails stage when lines is an empty array", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-empty-lines",
      segmentId: "segment-fail-empty-lines",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("fails stage when a line is missing required key or empty value", async () => {
    const adapterWithMissingKey = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );
    const missingKeyResult = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-line-missing-key",
      segmentId: "segment-fail-line-missing-key",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter: adapterWithMissingKey,
    });

    const adapterWithEmptyValue = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );
    const emptyValueResult = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-line-empty-value",
      segmentId: "segment-fail-line-empty-value",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter: adapterWithEmptyValue,
    });

    expect(missingKeyResult.status).toBe("failed");
    expect("artifact" in missingKeyResult).toBe(false);
    expect(emptyValueResult.status).toBe("failed");
    expect("artifact" in emptyValueResult).toBe(false);
  });

  it("fails stage when skill is not compatible and does not call adapter", async () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "segment-scripting-incompatible-")
    );
    const fixtureSkillDir = path.join(fixtureRoot, "skills/script-generation");

    fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureSkillDir, "skill.toml"),
      [
        'id = "script-generation"',
        'version = "1"',
        'kind = "generation"',
        'compatibleAgents = ["other-agent"]',
        'inputSchemaRef = "segment-script-input"',
        'outputSchemaRef = "segment-script-draft"',
        'contextRequirements = ["segment"]',
        "toolAllowlist = []",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(fixtureSkillDir, "SKILL.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(
      path.join(fixtureSkillDir, "prompts/system.md"),
      "return json",
      "utf8"
    );
    fs.writeFileSync(
      path.join(fixtureSkillDir, "prompts/user.md"),
      "{{segment_text}}",
      "utf8"
    );

    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-incompatible-skill",
      segmentId: "segment-incompatible-skill",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });
});

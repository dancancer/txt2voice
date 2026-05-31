import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import {
  runSegmentScriptingStage,
  type RunSegmentScriptingStageResult,
} from "../runtime/stages/run-segment-scripting-stage";

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

const asCompletedResult = (
  result: RunSegmentScriptingStageResult
): Extract<RunSegmentScriptingStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }
  return result;
};

const createScriptGenerationSkillFixture = (params?: {
  skillId?: string;
  compatibleAgents?: string[];
  contextRequirements?: string[];
  toolAllowlist?: string[];
}) => {
  const skillId = params?.skillId ?? "script-generation";
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "segment-scripting-"));
  const fixtureSkillDir = path.join(fixtureRoot, "skills", skillId);

  fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureSkillDir, "skill.toml"),
    [
      `id = "${skillId}"`,
      'version = "1"',
      'kind = "generation"',
      `compatibleAgents = [${(params?.compatibleAgents ?? [
        "script-generation-agent",
      ])
        .map((agentId) => `"${agentId}"`)
        .join(", ")}]`,
      'inputSchemaRef = "segment-script-input"',
      'outputSchemaRef = "segment-script-draft"',
      `contextRequirements = [${(params?.contextRequirements ?? [
        "segment",
        "character_memory_summary",
      ])
        .map((requirement) => `"${requirement}"`)
        .join(", ")}]`,
      `toolAllowlist = [${(params?.toolAllowlist ?? [])
        .map((tool) => `"${tool}"`)
        .join(", ")}]`,
      'promptBundle = ["prompts/system.md", "prompts/user.md"]',
      'modelPolicy = "balanced"',
      'repairPolicy = "handoff-to-json-repair"',
      'successCriteria = ["returns-segment-script-draft"]',
      'telemetryTags = ["runtime", "segment-scripting"]',
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
    "{{segment_text}} {{character_memory_summary}}",
    "utf8"
  );

  return fixtureSkillDir;
};

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
    const completed = asCompletedResult(result);
    expect(completed.artifact.kind).toBe("segment-script-draft");
    expect(completed.artifact.segmentScriptDraft.segmentId).toBe("segment-1");
    expect(completed.artifact.segmentScriptDraft.lines).toHaveLength(1);
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
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-1::dialogue-1",
      sourceText: "“快走！”",
      text: "快走！",
      speaker: "燕赤霞",
      orderInSegment: 0,
    });
  });

  it("realigns pure quoted leaf outputs back to full quoted source text", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText:
              "外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……",
            text: "外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-quoted-leaf",
      segmentId: "segment-quoted-leaf",
      segmentText:
        "“外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……”",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-1",
      sourceText:
        "“外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……”",
      text: "外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……",
      speaker: "未知",
      orderInSegment: 0,
    });
  });

  it("normalizes pure quoted leaf when sourceText already keeps quotes but speaker is narration", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“无事，只想叫叫你。”",
            text: "无事，只想叫叫你。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-quoted-leaf-narration",
      segmentId: "segment-quoted-leaf-narration",
      segmentText: "“无事，只想叫叫你。”",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "“无事，只想叫叫你。”",
      text: "无事，只想叫叫你。",
      speaker: "未知",
      orderInSegment: 0,
    });
  });

  it("returns repairing when speaker is missing", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“胆儿挺大的啊。”",
            text: "胆儿挺大的啊。",
            speaker: "",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-empty-speaker",
      segmentId: "segment-empty-speaker",
      segmentText: "“胆儿挺大的啊。”",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("repairing");
    expect("artifact" in result).toBe(false);
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
    const completed = asCompletedResult(result);
    expect(completed.artifact).toEqual(expect.objectContaining({
      kind: "segment-script-draft",
      skillId: "script-generation",
      segmentScriptDraft: expect.objectContaining({
        segmentId: "segment-3",
      }),
    }));
    expect("scriptSentences" in completed).toBe(false);
    expect("persisted" in completed).toBe(false);
  });

  it("rejects custom skill ids not allowed by the script generation agent", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      skillId: "script-generation-custom",
    });

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

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("injects character memory summary into the Mastra prompt", async () => {
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
    expect(call.prompt).toContain("角色记忆摘要");
    expect(call.prompt).not.toContain("{{character_memory_summary}}");
  });

  it("returns repairing when adapter returns non-json payload", async () => {
    const adapter = createMockAdapter("not-json");

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-fail-non-json",
      segmentId: "segment-fail-non-json",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("repairing");
    expect("artifact" in result).toBe(false);
    expect(
      "failedArtifact" in result ? result.failedArtifact : undefined
    ).toEqual({
      kind: "segment-scripting-failure",
      rawResponse: "not-json",
      provider: "mock-provider",
      model: "mock-model",
      message: "Invalid script generation payload: expected JSON object",
    });
  });

  it("returns repairing when payload is empty object or lines is not array", async () => {
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

    expect(emptyObjectResult.status).toBe("repairing");
    expect("artifact" in emptyObjectResult).toBe(false);
    expect(invalidLinesResult.status).toBe("repairing");
    expect("artifact" in invalidLinesResult).toBe(false);
  });

  it("returns repairing when lines is an empty array", async () => {
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

    expect(result.status).toBe("repairing");
    expect("artifact" in result).toBe(false);
  });

  it("returns repairing when a line is missing required key or empty value", async () => {
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

    expect(missingKeyResult.status).toBe("repairing");
    expect("artifact" in missingKeyResult).toBe(false);
    expect(emptyValueResult.status).toBe("repairing");
    expect("artifact" in emptyValueResult).toBe(false);
  });

  it("normalizes non-contiguous orderInSegment into a completed draft", async () => {
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
          {
            id: "line-2",
            sourceText: "燕赤霞点头。",
            text: "燕赤霞点头。",
            speaker: "旁白",
            orderInSegment: 2,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-normalize-non-contiguous-order",
      segmentId: "segment-normalize-non-contiguous-order",
      segmentText: "宁采臣抬头。燕赤霞点头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines).toEqual([
      {
        id: "line-1",
        sourceText: "宁采臣抬头。",
        text: "宁采臣抬头。",
        speaker: "旁白",
        orderInSegment: 0,
      },
      {
        id: "line-2",
        sourceText: "燕赤霞点头。",
        text: "燕赤霞点头。",
        speaker: "旁白",
        orderInSegment: 1,
      },
    ]);
  });

  it("fails stage when skill is not compatible and does not call adapter", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      compatibleAgents: ["other-agent"],
    });

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

  it("fails stage when required prompt file is missing and does not call adapter", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture();
    fs.unlinkSync(path.join(fixtureSkillDir, "prompts/user.md"));

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
      workflowRunId: "wf-segment-missing-prompt",
      segmentId: "segment-missing-prompt",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it.each([
    {
      title: "contextRequirements is not ['segment']",
      contextRequirements: ["segment", "character_memory"],
      toolAllowlist: [],
    },
    {
      title: "toolAllowlist is not empty",
      contextRequirements: ["segment"],
      toolAllowlist: ["load-book-context"],
    },
  ])("fails stage when %s and does not call adapter", async (fixtureConfig) => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      contextRequirements: fixtureConfig.contextRequirements,
      toolAllowlist: fixtureConfig.toolAllowlist,
    });
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
      workflowRunId: "wf-segment-contract-mismatch",
      segmentId: "segment-contract-mismatch",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("returns repairing when input is over budget and does not call adapter", async () => {
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
      workflowRunId: "wf-segment-over-budget",
      segmentId: "segment-over-budget",
      segmentText: "甲".repeat(5000),
      skillDir,
      adapter,
    });

    expect(result.status).toBe("repairing");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

});

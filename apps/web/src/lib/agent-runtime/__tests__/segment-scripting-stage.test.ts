import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { buildAgentContext } from "../context";
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
  compatibleWorkflowStages?: string[];
  allowedSkills?: string[];
  allowedTools?: string[];
  modelPolicy?: string;
  agentInstructions?: string;
  skillInstructions?: string;
  systemPrompt?: string;
  userPrompt?: string;
}) => {
  const skillId = params?.skillId ?? "script-generation";
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "segment-scripting-"));
  const agentDir = path.join(fixtureRoot, "agents", "script-generation");
  const fixtureSkillDir = path.join(fixtureRoot, "skills", skillId);

  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(agentDir, "agent.toml"),
    [
      'id = "script-generation-agent"',
      'version = "1"',
      'role = "generate_segment_script_draft"',
      `compatibleWorkflowStages = [${(params?.compatibleWorkflowStages ?? [
        "segment_scripting",
      ])
        .map((stageId) => `"${stageId}"`)
        .join(", ")}]`,
      `allowedSkills = [${(params?.allowedSkills ?? [skillId])
        .map((allowedSkillId) => `"${allowedSkillId}"`)
        .join(", ")}]`,
      `allowedTools = [${(params?.allowedTools ?? [])
        .map((toolName) => `"${toolName}"`)
        .join(", ")}]`,
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(agentDir, "AGENT.md"),
    params?.agentInstructions ?? "# Fixture Agent\n",
    "utf8"
  );
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
      `modelPolicy = "${params?.modelPolicy ?? "balanced"}"`,
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixtureSkillDir, "SKILL.md"),
    params?.skillInstructions ?? "# Fixture\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixtureSkillDir, "prompts/system.md"),
    params?.systemPrompt ?? "return json",
    "utf8"
  );
  fs.writeFileSync(
    path.join(fixtureSkillDir, "prompts/user.md"),
    params?.userPrompt ?? "{{segment_text}}",
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
    expect((adapter.call as jest.Mock).mock.calls[0]?.[0]?.modelPolicy).toBe(
      "balanced"
    );
  });

  it("preserves optional tone and prosody metadata from LLM output", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-prosody-1",
            sourceText: "“别出声。”",
            text: "别出声。",
            speaker: "燕赤霞",
            orderInSegment: 0,
            tone: "压低声音",
            prosody: {
              pace: 0.82,
              pitch: -0.18,
              energy: 0.34,
              pauseMsAfter: 900,
            },
            strength: 41,
            pauseAfter: 0.9,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-prosody-1",
      segmentId: "segment-prosody-1",
      segmentText: "“别出声。”",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines[0]).toEqual({
      id: "line-prosody-1",
      sourceText: "“别出声。”",
      text: "别出声。",
      speaker: "燕赤霞",
      orderInSegment: 0,
      tone: "压低声音",
      prosody: {
        pace: 0.82,
        pitch: -0.18,
        energy: 0.34,
        pauseMsAfter: 900,
      },
      strength: 41,
      pauseAfter: 0.9,
    });
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

  it("declares tone and prosody fields in the rendered prompt contract", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "燕赤霞低喝：“退后。”",
            text: "退后。",
            speaker: "燕赤霞",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-prompt-prosody",
      segmentId: "segment-prompt-prosody",
      segmentText: "燕赤霞低喝：“退后。”",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("tone");
    expect(call.prompt).toContain("prosody");
    expect(call.prompt).toContain("strength");
    expect(call.prompt).toContain("pauseAfter");
    expect(call.prompt).toContain("pace");
    expect(call.prompt).toContain("pitch");
    expect(call.prompt).toContain("energy");
    expect(call.prompt).toContain("pauseMsAfter");
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

  it("routes missing speaker into repair instead of silently defaulting to unknown", async () => {
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
    if (result.status === "repairing") {
      expect(result.error).toMatch(/Invalid script line/);
      expect(result.failedArtifact).toEqual(
        expect.objectContaining({
          kind: "segment-scripting-failure",
        })
      );
    }
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
    expect(completed.artifact).toEqual(
      expect.objectContaining({
        kind: "segment-script-draft",
        skillId: "script-generation",
        segmentScriptDraft: expect.objectContaining({
          segmentId: "segment-3",
        }),
        skillMetadata: expect.objectContaining({
          modelPolicy: "balanced",
          telemetryTags: expect.arrayContaining([
            "runtime",
            "segment-scripting",
          ]),
        }),
      })
    );
    expect("scriptSentences" in completed).toBe(false);
    expect("persisted" in completed).toBe(false);
  });

  it("uses runtime skill id from skill source instead of fixed literal", async () => {
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

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.skillId).toBe("script-generation-custom");
  });

  it("injects character memory summary into prompt when known characters exist", async () => {
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
      characterMemory: {
        canonicalIdentities: [
          { id: "char-1", name: "宁采臣" },
          { id: "char-2", name: "燕赤霞" },
        ],
        aliasEvidence: [
          { alias: "宁公子", canonicalId: "char-1", source: "profile:char-1" },
        ],
        assertedFacts: {
          "char-1": { role: "main" },
        },
        inferredHints: {
          "char-2": { style: "冷峻" },
        },
      },
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0];
    expect(call.prompt).toContain("角色记忆摘要");
    expect(call.prompt).toContain("宁采臣");
    expect(call.prompt).toContain("宁公子");
  });

  it("prioritizes segment-relevant characters in prompt summary under budget pressure", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      userPrompt: "{{character_memory_summary}}",
      systemPrompt: "return json",
      agentInstructions: "# Agent",
      skillInstructions: "# Skill",
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "燕赤霞喝道：“退后。”",
            text: "退后。",
            speaker: "燕赤霞",
            orderInSegment: 0,
          },
        ],
      })
    );

    const characterMemory = {
      canonicalIdentities: [
        ...Array.from({ length: 3 }, (_, index) => ({
          id: `char-${index + 1}`,
          name: `前置角色${index + 1}`,
        })),
        { id: "char-relevant", name: "燕赤霞" },
      ],
      aliasEvidence: [
        { alias: "燕大侠", canonicalId: "char-relevant", source: "profile:char-relevant" },
      ],
      assertedFacts: Object.fromEntries(
        Array.from({ length: 3 }, (_, index) => [
          `char-${index + 1}`,
          {
            description: `描述${index + 1}-${"甲".repeat(40)}`,
          },
        ])
      ),
      inferredHints: {
        "char-relevant": {
          dialogueStyle: "冷峻",
        },
      },
    };
    const expectedSummary = buildAgentContext({
      agentId: "script-generation-agent",
      segmentText: "燕赤霞喝道：“退后。”",
      characterMemory,
      budget: {
        maxContextChars: 4000,
        reservedOutputChars: 1200,
      },
    }).referenceMemory.characterMemorySummary;

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-relevant-summary-priority",
      segmentId: "segment-relevant-summary-priority",
      segmentText: "燕赤霞喝道：“退后。”",
      skillDir: fixtureSkillDir,
      characterMemory,
      adapter,
    });

    expect(result.status).toBe("completed");
    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toBe(expectedSummary);
  });

  it("returns raw alias speaker names in stage artifact without pre-finalize canonicalization", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“见过姑娘。”",
            text: "见过姑娘。",
            speaker: "宁公子",
            orderInSegment: 0,
          },
        ],
      })
    );

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-segment-normalize-speaker-alias",
      segmentId: "segment-normalize-speaker-alias",
      segmentText: "“见过姑娘。”",
      skillDir,
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [
          { alias: "宁公子", canonicalId: "char-1", source: "profile:char-1" },
        ],
        assertedFacts: {
          "char-1": { role: "main" },
        },
        inferredHints: {},
      },
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.segmentScriptDraft.lines[0]?.speaker).toBe("宁公子");
    expect(completed.artifact.memoryVersion).toBe(1);
  });

  it("does not mutate literal placeholder text inside segment content during prompt rendering", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      userPrompt: "文本段落：\n{{segment_text}}\n\n角色记忆摘要：\n{{character_memory_summary}}",
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "正文里写着 {{character_memory_summary}} 这串字。",
            text: "正文里写着 {{character_memory_summary}} 这串字。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    await runSegmentScriptingStage({
      workflowRunId: "wf-segment-literal-placeholder",
      segmentId: "segment-literal-placeholder",
      segmentText: "正文里写着 {{character_memory_summary}} 这串字。",
      skillDir: fixtureSkillDir,
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [{ alias: "宁公子", canonicalId: "char-1", source: "seed" }],
        assertedFacts: { "char-1": { dialogueStyle: "文雅" } },
        inferredHints: {},
      },
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("正文里写着 {{character_memory_summary}} 这串字。");
  });

  it("rejects over-budget full prompts before calling adapter", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      agentInstructions: "A".repeat(4500),
      skillInstructions: "B".repeat(4500),
      systemPrompt: "C".repeat(4500),
      userPrompt: "{{segment_text}}",
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
      workflowRunId: "wf-segment-full-prompt-over-budget",
      segmentId: "segment-full-prompt-over-budget",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("repairing");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("refuses to silently trim segment_text to fit the prompt budget", async () => {
    const fixtureSkillDir = createScriptGenerationSkillFixture({
      agentInstructions: "A".repeat(2200),
      skillInstructions: "B".repeat(200),
      systemPrompt: "C".repeat(200),
      userPrompt: "{{segment_text}}",
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
      workflowRunId: "wf-segment-disallow-trimmed-source",
      segmentId: "segment-disallow-trimmed-source",
      segmentText: "甲".repeat(1200),
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("repairing");
    expect(adapter.call).toHaveBeenCalledTimes(0);
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

  it("uses the configured Mastra stage implementation", async () => {
    const adapter = createMockAdapter("{}");
    const runMastraSegmentScriptingStage = jest.fn().mockResolvedValue({
      stageRunId: "mastra-stage-1",
      agentRunId: "mastra-agent-1",
      status: "completed",
      artifact: {
        kind: "segment-script-draft",
        skillId: "script-generation",
        segmentScriptDraft: {
          segmentId: "segment-mastra-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          lines: [
            {
              id: "line-1",
              sourceText: "宁采臣抬头。",
              text: "宁采臣抬头。",
              speaker: "旁白",
              orderInSegment: 0,
            },
          ],
        },
      },
    } satisfies RunSegmentScriptingStageResult);

    const result = await runSegmentScriptingStage({
      workflowRunId: "wf-scripting-mastra",
      segmentId: "segment-mastra-1",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
      runMastraSegmentScriptingStage,
    });

    expect(result.status).toBe("completed");
    expect(runMastraSegmentScriptingStage).toHaveBeenCalledTimes(1);
    expect(adapter.call).toHaveBeenCalledTimes(0);
    expect(asCompletedResult(result).artifact.segmentScriptDraft.segmentId).toBe(
      "segment-mastra-1"
    );
  });

});

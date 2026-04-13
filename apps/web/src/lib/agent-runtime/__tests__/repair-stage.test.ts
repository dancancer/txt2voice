import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import { buildAgentContext } from "../context";
import {
  runSegmentRepairStage,
  type RunSegmentRepairStageResult,
} from "../runtime/stages/run-segment-repair-stage";

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
const skillDir = path.join(workspaceRoot, "skills/json-repair");

const asCompletedResult = (
  result: RunSegmentRepairStageResult
): Extract<RunSegmentRepairStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }
  return result;
};

const createRepairSkillFixture = (params?: {
  skillId?: string;
  compatibleAgents?: string[];
  contextRequirements?: string[];
  toolAllowlist?: string[];
  outputSchemaRef?: string;
  compatibleWorkflowStages?: string[];
  allowedSkills?: string[];
  allowedTools?: string[];
  modelPolicy?: string;
  agentInstructions?: string;
  skillInstructions?: string;
  systemPrompt?: string;
  userPrompt?: string;
}) => {
  const skillId = params?.skillId ?? "json-repair";
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "segment-repair-"));
  const agentDir = path.join(fixtureRoot, "agents", "repair");
  const fixtureSkillDir = path.join(fixtureRoot, "skills", skillId);

  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(agentDir, "agent.toml"),
    [
      'id = "repair-agent"',
      'version = "1"',
      'role = "repair_failed_segment_artifacts"',
      `compatibleWorkflowStages = [${(params?.compatibleWorkflowStages ?? [
        "segment_repair",
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
      'kind = "repair"',
      `compatibleAgents = [${(params?.compatibleAgents ?? ["repair-agent"])
        .map((agentId) => `"${agentId}"`)
        .join(", ")}]`,
      'inputSchemaRef = "failed-segment-artifact"',
      `outputSchemaRef = "${params?.outputSchemaRef ?? "segment-script-draft"}"`,
      `contextRequirements = [${(params?.contextRequirements ?? [
        "segment",
        "failed_artifact",
        "character_memory_summary",
        "character_resolution_hints",
      ])
        .map((requirement) => `"${requirement}"`)
        .join(", ")}]`,
      `toolAllowlist = [${(params?.toolAllowlist ?? [])
        .map((tool) => `"${tool}"`)
        .join(", ")}]`,
      'promptBundle = ["prompts/system.md", "prompts/user.md"]',
      `modelPolicy = "${params?.modelPolicy ?? "cheap-repair"}"`,
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
    params?.userPrompt ??
      "{{segment_text}} {{failed_artifact_json}} {{character_memory_summary}} {{character_resolution_hints}} {{failure_category}}",
    "utf8"
  );

  return fixtureSkillDir;
};

describe("segment repair stage", () => {
  it("routes broken structured output to format_repair and returns repaired draft", async () => {
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-format-1",
      segmentId: "segment-1",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toMatchObject({
      segmentId: "segment-1",
      action: "retry",
      retryable: true,
    });
    expect(completed.artifact?.kind).toBe("segment-script-draft");
    expect(completed.artifact?.segmentScriptDraft.lines).toHaveLength(1);
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("renders format_repair prompt without failure_category placeholder and uses segment plus failedArtifact", async () => {
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-prompt-contract-1",
      segmentId: "segment-prompt-contract-1",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: {
        broken: true,
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("宁采臣抬头。");
    expect(call.prompt).toContain('"broken": true');
    expect(call.prompt).not.toContain("{{failure_category}}");
    expect(call.prompt).not.toContain("failure_category");
  });

  it("injects character memory summary and canonical hints into repair prompt", async () => {
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

    await runSegmentRepairStage({
      workflowRunId: "wf-repair-memory-summary",
      segmentId: "segment-repair-memory-summary",
      segmentText: "“见过姑娘。”",
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [
          { alias: "宁公子", canonicalId: "char-1", source: "profile:char-1" },
        ],
        assertedFacts: {},
        inferredHints: {},
      },
      failureKind: "format_repair",
      failedArtifact: { broken: true },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("宁采臣");
    expect(call.prompt).toContain("宁公子");
  });

  it("uses the same relevance-aware character summary source as buildAgentContext", async () => {
    const fixtureSkillDir = createRepairSkillFixture({
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
            sourceText: "“退后。”",
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
      agentId: "repair-agent",
      segmentText: "燕赤霞喝道：“退后。”",
      failedArtifact: { broken: true },
      characterMemory,
      budget: {
        maxContextChars: 5000,
        reservedOutputChars: 1200,
      },
    }).referenceMemory.characterMemorySummary;

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-summary-source",
      segmentId: "segment-repair-summary-source",
      segmentText: "燕赤霞喝道：“退后。”",
      characterMemory,
      failureKind: "format_repair",
      failedArtifact: { broken: true },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toBe(expectedSummary);
  });

  it("does not mutate literal placeholder text inside segment content during repair prompt rendering", async () => {
    const fixtureSkillDir = createRepairSkillFixture({
      userPrompt: "原文：\n{{segment_text}}\n\n失败产物：\n{{failed_artifact_json}}",
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "原文里出现 {{failed_artifact_json}} 这个字样。",
            text: "原文里出现 {{failed_artifact_json}} 这个字样。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      })
    );

    await runSegmentRepairStage({
      workflowRunId: "wf-repair-literal-placeholder",
      segmentId: "segment-repair-literal-placeholder",
      segmentText: "原文里出现 {{failed_artifact_json}} 这个字样。",
      failureKind: "format_repair",
      failedArtifact: { broken: true },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: fixtureSkillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("原文里出现 {{failed_artifact_json}} 这个字样。");
  });

  it("repairs semantic validation failures into a retriable draft", async () => {
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
            orderInSegment: 1,
          },
        ],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-semantic-1",
      segmentId: "segment-2",
      segmentText: "宁采臣抬头。燕赤霞点头。",
      failureKind: "semantic_retry",
      failedArtifact: {
        segmentId: "segment-2",
      },
      validationReport: {
        segmentId: "segment-2",
        valid: false,
        coverageRatio: 0.62,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below threshold",
          },
        ],
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-2",
      action: "retry",
      reason: "semantic_retry",
      retryable: true,
    });
    expect(completed.artifact?.segmentScriptDraft.lines).toHaveLength(2);
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("normalizes alias speaker names back to canonical names before returning repaired draft", async () => {
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-normalize-speaker-alias",
      segmentId: "segment-repair-normalize-speaker-alias",
      segmentText: "“见过姑娘。”",
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [
          { alias: "宁公子", canonicalId: "char-1", source: "profile:char-1" },
        ],
        assertedFacts: {},
        inferredHints: {},
      },
      failureKind: "format_repair",
      failedArtifact: { broken: true },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact?.segmentScriptDraft.lines[0]?.speaker).toBe("宁采臣");
    expect(completed.artifact?.memoryVersion).toBe(1);
  });

  it("routes over-budget failures to input_refinement without calling adapter", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        lines: [],
      })
    );

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-refine-1",
      segmentId: "segment-3",
      segmentText: "甲".repeat(8000),
      failureKind: "input_refinement",
      failedArtifact: {
        segmentId: "segment-3",
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-3",
      action: "refine",
      reason: "input_refinement",
      retryable: true,
    });
    expect(completed.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("returns manual_review when repair depth exceeds threshold", async () => {
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-depth-1",
      segmentId: "segment-4",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 2,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-4",
      action: "manual_review",
      reason: "repair_depth_exceeded",
      retryable: false,
    });
    expect(completed.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("keeps nested validation evidence when semantic retry artifact is summarized", async () => {
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

    await runSegmentRepairStage({
      workflowRunId: "wf-repair-semantic-summary-evidence",
      segmentId: "segment-semantic-summary-evidence",
      segmentText: "宁采臣抬头。",
      failureKind: "semantic_retry",
      failedArtifact: {
        kind: "validation-failure",
        segmentId: "segment-semantic-summary-evidence",
        validationReport: {
          segmentId: "segment-semantic-summary-evidence",
          valid: false,
          coverageRatio: 0.61,
          issues: [
            {
              code: "LOW_COVERAGE",
              message: "coverage below threshold",
            },
          ],
        },
        rawResponse: "X".repeat(1600),
        structuredResult: {
          segmentId: "segment-semantic-summary-evidence",
          lines: Array.from({ length: 3 }, (_, index) => ({
            id: `line-${index + 1}`,
            sourceText: `第${index + 1}句${"甲".repeat(120)}`,
            text: `第${index + 1}句${"甲".repeat(120)}`,
            speaker: "旁白",
            orderInSegment: index,
          })),
        },
      },
      validationReport: {
        segmentId: "segment-semantic-summary-evidence",
        valid: false,
        coverageRatio: 0.61,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below threshold",
          },
        ],
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };

    expect(adapter.call).toHaveBeenCalledTimes(1);
    expect(call.prompt).toContain('"validationReport"');
    expect(call.prompt).toContain('"coverageRatio": 0.61');
    expect(call.prompt).toContain('"LOW_COVERAGE"');
  });

  it.each([
    {
      title: "adapter returns non-json payload",
      content: "not-json",
    },
    {
      title: "adapter returns empty lines",
      content: JSON.stringify({ lines: [] }),
    },
    {
      title: "adapter returns line with missing required field",
      content: JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "宁采臣抬头。",
            orderInSegment: 0,
          },
        ],
      }),
    },
    {
      title: "adapter returns non-contiguous orderInSegment",
      content: JSON.stringify({
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
      }),
    },
  ])("fails format_repair when %s", async ({ content }) => {
    const adapter = createMockAdapter(content);

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-format-invalid",
      segmentId: "segment-format-invalid",
      segmentText: "宁采臣抬头。燕赤霞点头。",
      failureKind: "format_repair",
      failedArtifact: {
        segmentId: "segment-format-invalid",
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(1);
  });

  it("fails stage when skill output schema is incompatible and does not call adapter", async () => {
    const fixtureSkillDir = createRepairSkillFixture({
      outputSchemaRef: "repair-decision",
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-skill-contract",
      segmentId: "segment-skill-contract",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("preserves raw response and parsed payload in failedArtifact for invalid repair lines", async () => {
    const responseContent = JSON.stringify({
      lines: [
        {
          id: "line-1",
          sourceText: "宁采臣抬头。",
          text: "",
          speaker: "旁白",
          orderInSegment: 0,
        },
      ],
    });
    const adapter = createMockAdapter(responseContent);

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-invalid-fields-artifact",
      segmentId: "segment-invalid-fields-artifact",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: {
        kind: "segment-scripting-failure",
        rawResponse: "not-json",
      },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("failedArtifact" in result ? result.failedArtifact : undefined).toEqual({
      kind: "segment-repair-failure",
      rawResponse: responseContent,
      structuredResult: {
        lines: [
          {
            id: "line-1",
            sourceText: "宁采臣抬头。",
            text: "",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
      provider: "mock-provider",
      model: "mock-model",
      message: "Invalid repair payload line: required fields are invalid",
    });
  });

  it("degrades format_repair to input_refinement when input is over budget", async () => {
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-over-budget-format",
      segmentId: "segment-over-budget-format",
      segmentText: "甲".repeat(9000),
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-over-budget-format",
      action: "refine",
      reason: "input_refinement",
      retryable: true,
    });
    expect(completed.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("degrades full-prompt over-budget repair requests to input_refinement", async () => {
    const fixtureSkillDir = createRepairSkillFixture({
      agentInstructions: "A".repeat(4500),
      skillInstructions: "B".repeat(4500),
      systemPrompt: "C".repeat(4500),
      userPrompt: "{{segment_text}} {{failed_artifact_json}}",
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

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-full-prompt-over-budget",
      segmentId: "segment-repair-full-prompt-over-budget",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: { broken: true },
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-repair-full-prompt-over-budget",
      action: "refine",
      reason: "input_refinement",
      retryable: true,
    });
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("escalates to manual_review when failed artifact evidence must be trimmed to fit prompt budget", async () => {
    const fixtureSkillDir = createRepairSkillFixture({
      agentInstructions: "A".repeat(800),
      skillInstructions: "B".repeat(800),
      systemPrompt: "C".repeat(800),
      userPrompt: "{{segment_text}} {{failed_artifact_json}}",
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
    const failedArtifact = {
      kind: "validation-failure",
      rawResponse: "X".repeat(2400),
      structuredResult: {
        lines: Array.from({ length: 3 }, (_, index) => ({
          id: `line-${index + 1}`,
          sourceText: `第${index + 1}句原文${"甲".repeat(160)}`,
          text: `第${index + 1}句输出${"乙".repeat(160)}`,
          speaker: "旁白",
          orderInSegment: index,
        })),
      },
    };

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-trimmed-failed-artifact",
      segmentId: "segment-repair-trimmed-failed-artifact",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact,
      repairDepth: 0,
      maxRepairDepth: 2,
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.decision).toEqual({
      segmentId: "segment-repair-trimmed-failed-artifact",
      action: "manual_review",
      reason: "repair_failed_artifact_trimmed",
      retryable: false,
    });
    expect(completed.artifact).toBeUndefined();
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("uses the configured Mastra repair implementation", async () => {
    const adapter = createMockAdapter("{}");
    const runMastraSegmentRepairStage = jest.fn().mockResolvedValue({
      stageRunId: "mastra-repair-stage-1",
      agentRunId: "mastra-repair-agent-1",
      status: "completed",
      decision: {
        segmentId: "segment-mastra-repair",
        action: "retry",
        reason: "format_repair",
        retryable: true,
      },
      artifact: {
        kind: "segment-script-draft",
        skillId: "json-repair",
        segmentScriptDraft: {
          segmentId: "segment-mastra-repair",
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
    } satisfies RunSegmentRepairStageResult);

    const result = await runSegmentRepairStage({
      workflowRunId: "wf-repair-mastra",
      segmentId: "segment-mastra-repair",
      segmentText: "宁采臣抬头。",
      failureKind: "format_repair",
      failedArtifact: "not-json",
      repairDepth: 0,
      skillDir,
      adapter,
      runMastraSegmentRepairStage,
    });

    expect(result.status).toBe("completed");
    expect(runMastraSegmentRepairStage).toHaveBeenCalledTimes(1);
    expect(adapter.call).toHaveBeenCalledTimes(0);
    expect(asCompletedResult(result).decision.action).toBe("retry");
  });

});

import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import type { CharacterMemory } from "../context";
import {
  runCharacterDiscoveryStage,
  type RunCharacterDiscoveryStageResult,
} from "../runtime/stages/run-character-discovery-stage";

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 8,
    usage: null,
  }),
});

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const skillDir = path.join(workspaceRoot, "skills/character-extraction");

const asCompletedResult = (
  result: RunCharacterDiscoveryStageResult
): Extract<RunCharacterDiscoveryStageResult, { status: "completed" }> => {
  if (result.status !== "completed") {
    throw new Error(`Expected completed status, received ${result.status}`);
  }
  return result;
};

const createCharacterDiscoveryContractFixture = (params?: {
  compatibleWorkflowStages?: string[];
  allowedSkills?: string[];
  allowedTools?: string[];
  skillId?: string;
  compatibleAgents?: string[];
  contextRequirements?: string[];
  toolAllowlist?: string[];
  modelPolicy?: string;
  agentInstructions?: string;
  skillInstructions?: string;
  systemPrompt?: string;
  userPrompt?: string;
}) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "character-discovery-contract-")
  );
  const agentDir = path.join(fixtureRoot, "agents", "character-discovery");
  const skillId = params?.skillId ?? "character-extraction";
  const skillDir = path.join(fixtureRoot, "skills", skillId);

  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(skillDir, "prompts"), { recursive: true });
  fs.writeFileSync(
    path.join(agentDir, "agent.toml"),
    [
      'id = "character-discovery-agent"',
      'version = "1"',
      'role = "discover_character_identities"',
      `compatibleWorkflowStages = [${(params?.compatibleWorkflowStages ?? [
        "character_discovery",
      ])
        .map((stageId) => `"${stageId}"`)
        .join(", ")}]`,
      `allowedSkills = [${(params?.allowedSkills ?? [skillId])
        .map((allowedSkillId) => `"${allowedSkillId}"`)
        .join(", ")}]`,
      `allowedTools = [${(params?.allowedTools ?? ["load-book-context"])
        .map((toolName) => `"${toolName}"`)
        .join(", ")}]`,
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(agentDir, "AGENT.md"),
    params?.agentInstructions ?? "# Character Discovery\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(skillDir, "skill.toml"),
    [
      `id = "${skillId}"`,
      'version = "1"',
      'kind = "analysis"',
      `compatibleAgents = [${(params?.compatibleAgents ?? [
        "character-discovery-agent",
      ])
        .map((agentId) => `"${agentId}"`)
        .join(", ")}]`,
      'inputSchemaRef = "character-input"',
      'outputSchemaRef = "character-output"',
      `contextRequirements = [${(params?.contextRequirements ?? [
        "segment",
        "character_memory_summary",
      ])
        .map((requirement) => `"${requirement}"`)
        .join(", ")}]`,
      `toolAllowlist = [${(params?.toolAllowlist ?? ["load-book-context"])
        .map((toolName) => `"${toolName}"`)
        .join(", ")}]`,
      'promptBundle = ["prompts/system.md", "prompts/user.md"]',
      `modelPolicy = "${params?.modelPolicy ?? "balanced"}"`,
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    params?.skillInstructions ?? "# Fixture\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(skillDir, "prompts/system.md"),
    params?.systemPrompt ?? "return json",
    "utf8"
  );
  fs.writeFileSync(
    path.join(skillDir, "prompts/user.md"),
    params?.userPrompt ?? "{{segment_text}}",
    "utf8"
  );

  return {
    fixtureRoot,
    skillDir,
  };
};

describe("character discovery stage", () => {
  it("loads skill prompts and calls adapter via stage runtime", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-ning",
            name: "宁采臣",
          },
        ],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    await runCharacterDiscoveryStage({
      workflowRunId: "wf-1",
      segmentText: "宁采臣看见燕赤霞，连忙行礼。",
      skillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0];
    expect(adapter.call).toHaveBeenCalledTimes(1);
    expect(call.systemPrompt).toContain("canonicalIdentities");
    expect(call.prompt).toContain("宁采臣看见燕赤霞");
  });

  it("injects character_memory_summary from built context into user prompt", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );
    const characterMemory: CharacterMemory = {
      canonicalIdentities: [
        { id: "char-1", name: "宁采臣" },
        { id: "char-2", name: "燕赤霞" },
      ],
      aliasEvidence: [{ alias: "燕大侠", canonicalId: "char-2", source: "segment-1" }],
      assertedFacts: {
        "char-1": { role: "main" },
      },
      inferredHints: {
        "char-2": { style: "冷峻" },
      },
    };

    await runCharacterDiscoveryStage({
      workflowRunId: "wf-summary",
      segmentText: "宁采臣与燕赤霞同行。",
      skillDir,
      characterMemory,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0];
    expect(call.prompt).toContain('"name":"宁采臣"');
    expect(call.prompt).toContain('"aliases":[]');
    expect(call.prompt).toContain('"role":"main"');
    expect(call.prompt).toContain('"style":"冷峻"');
  });

  it("does not mutate literal placeholder text inside sampled text during prompt rendering", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      userPrompt: "文本：\n{{segment_text}}\n\n记忆：\n{{character_memory_summary}}",
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    await runCharacterDiscoveryStage({
      workflowRunId: "wf-character-literal-placeholder",
      segmentText: "正文里出现 {{character_memory_summary}} 这个字样。",
      skillDir: fixture.skillDir,
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [],
        assertedFacts: { "char-1": { role: "main" } },
        inferredHints: {},
      },
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0] as {
      prompt: string;
    };
    expect(call.prompt).toContain("正文里出现 {{character_memory_summary}} 这个字样。");
  });

  it("trims oversized segment input before sending character discovery prompt", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );
    const longSegment = `开头-${"甲".repeat(5000)}-尾标记`;

    await runCharacterDiscoveryStage({
      workflowRunId: "wf-character-over-budget",
      segmentText: longSegment,
      skillDir,
      adapter,
    });

    const call = (adapter.call as jest.Mock).mock.calls[0]?.[0];
    expect(call.prompt.length).toBeLessThan(3200);
    expect(call.prompt).toContain("开头-");
    expect(call.prompt).not.toContain("尾标记");
  });

  it("fails fast when the full runtime prompt exceeds budget", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      agentInstructions: "A".repeat(4500),
      skillInstructions: "B".repeat(4500),
      systemPrompt: "C".repeat(4500),
      userPrompt: "{{segment_text}}",
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-character-full-prompt-over-budget",
      segmentText: "宁采臣抬头。",
      skillDir: fixture.skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("uses skill definition from the same skillDir source", async () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "character-discovery-stage-")
    );
    const fixtureAgentDir = path.join(fixtureRoot, "agents/character-discovery");
    const fixtureSkillDir = path.join(fixtureRoot, "skills/character-extraction");

    fs.mkdirSync(fixtureAgentDir, { recursive: true });
    fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
    fs.writeFileSync(
      path.join(fixtureAgentDir, "agent.toml"),
      [
        'id = "character-discovery-agent"',
        'version = "1"',
        'role = "discover_character_identities"',
        'compatibleWorkflowStages = ["character_discovery"]',
        'allowedSkills = ["character-extraction"]',
        'allowedTools = ["load-book-context"]',
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(fixtureAgentDir, "AGENT.md"), "# Fixture Agent\n", "utf8");
    fs.writeFileSync(
      path.join(fixtureSkillDir, "skill.toml"),
      [
        'id = "character-extraction"',
        'version = "1"',
        'kind = "analysis"',
        'compatibleAgents = ["other-agent"]',
        'inputSchemaRef = "character-input"',
        'outputSchemaRef = "character-output"',
        'contextRequirements = ["segment"]',
        'toolAllowlist = ["load-book-context"]',
        'promptBundle = ["prompts/system.md", "prompts/user.md"]',
        'modelPolicy = "balanced"',
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
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-skill-source",
      segmentText: "宁采臣抬头。",
      skillDir: fixtureSkillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("fails fast when agent definition does not allow character_discovery stage", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      compatibleWorkflowStages: ["segment_scripting"],
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-agent-stage-mismatch",
      segmentText: "宁采臣抬头。",
      skillDir: fixture.skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("fails fast when skill is not in agent allowedSkills", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      allowedSkills: ["other-skill"],
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-agent-skill-mismatch",
      segmentText: "宁采臣抬头。",
      skillDir: fixture.skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("fails fast when skill contextRequirements drift from stage contract", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      contextRequirements: ["segment"],
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-agent-context-mismatch",
      segmentText: "宁采臣抬头。",
      skillDir: fixture.skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("fails fast when agent and skill tool policies do not intersect", async () => {
    const fixture = createCharacterDiscoveryContractFixture({
      allowedTools: ["update-task-progress"],
      toolAllowlist: ["load-book-context"],
    });
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-agent-tool-mismatch",
      segmentText: "宁采臣抬头。",
      skillDir: fixture.skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect(adapter.call).toHaveBeenCalledTimes(0);
  });

  it("returns minimal character memory draft with separated evidence buckets", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-yan",
            name: "燕赤霞",
          },
        ],
        aliasEvidence: [
          {
            alias: "燕大侠",
            canonicalId: "char-yan",
            source: "segment-1",
          },
        ],
        assertedFacts: {
          "char-yan": {
            importance: "main",
          },
        },
        inferredHints: {
          "char-yan": {
            style: "刚烈",
          },
        },
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-2",
      segmentText: "燕赤霞（燕大侠）拔剑怒喝。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact).toBeDefined();
    expect(completed.artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [
        {
          id: "char-yan",
          name: "燕赤霞",
        },
      ],
      aliasEvidence: [
        {
          alias: "燕大侠",
          canonicalId: "char-yan",
          source: "segment-1",
        },
      ],
      assertedFacts: {
        "char-yan": {
          importance: "main",
        },
      },
      inferredHints: {
        "char-yan": {
          style: "刚烈",
        },
      },
    });
  });

  it("drops dangling facts and collapses duplicate canonical names", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-ning",
            name: "宁采臣",
          },
          {
            id: "char-ning-dup",
            name: "宁采臣",
          },
        ],
        aliasEvidence: [],
        assertedFacts: {
          "char-ning-dup": {
            role: "main",
          },
          宁采臣: {
            trait: "kind",
          },
          路人甲: {
            role: "minor",
          },
        },
        inferredHints: {
          "char-ning": {
            tone: "书生气",
          },
          宁采臣: {
            mood: "谨慎",
          },
          "char-ghost": {
            tone: "unknown",
          },
        },
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-4",
      segmentText: "宁采臣缓缓开口。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.characterMemoryDraft.canonicalIdentities).toEqual([
      {
        id: "char-ning",
        name: "宁采臣",
      },
    ]);
    expect(completed.artifact.characterMemoryDraft.assertedFacts).toEqual({
      "char-ning": {
        role: "main",
        trait: "kind",
      },
    });
    expect(completed.artifact.characterMemoryDraft.inferredHints).toEqual({
      "char-ning": {
        tone: "书生气",
        mood: "谨慎",
      },
    });
  });

  it("reuses existing canonical id from memory when names match", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-ning",
            name: "宁采臣",
          },
        ],
        aliasEvidence: [
          {
            alias: "宁生",
            canonicalId: "char-ning",
            source: "segment-2",
          },
        ],
        assertedFacts: {
          "char-ning": {
            role: "main",
          },
        },
        inferredHints: {
          宁采臣: {
            tone: "温和",
          },
        },
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-reuse-id",
      segmentText: "宁采臣轻声答话。",
      skillDir,
      adapter,
      characterMemory: {
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      },
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
      aliasEvidence: [
        {
          alias: "宁生",
          canonicalId: "char-1",
          source: "segment-2",
        },
      ],
      assertedFacts: {
        "char-1": {
          role: "main",
        },
      },
      inferredHints: {
        "char-1": {
          tone: "温和",
        },
      },
    });
  });

  it("reuses existing canonical id when draft canonical name matches known alias", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-new",
            name: "燕大侠",
          },
        ],
        aliasEvidence: [],
        assertedFacts: {
          "char-new": {
            role: "mentor",
          },
        },
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-reuse-alias-id",
      segmentText: "燕大侠缓缓收剑。",
      skillDir,
      adapter,
      characterMemory: {
        canonicalIdentities: [{ id: "char-2", name: "燕赤霞" }],
        aliasEvidence: [
          { alias: "燕大侠", canonicalId: "char-2", source: "segment-1" },
        ],
        assertedFacts: {},
        inferredHints: {},
      },
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [{ id: "char-2", name: "燕赤霞" }],
      aliasEvidence: [],
      assertedFacts: {
        "char-2": {
          role: "mentor",
        },
      },
      inferredHints: {},
    });
  });

  it("reuses existing canonical id when draft alias evidence hits known alias", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [
          {
            id: "char-new",
            name: "黑衣剑客",
          },
        ],
        aliasEvidence: [
          {
            alias: "燕大侠",
            canonicalId: "char-new",
            source: "segment-3",
          },
        ],
        assertedFacts: {
          "char-new": {
            style: "冷峻",
          },
        },
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-reuse-alias-evidence-id",
      segmentText: "黑衣剑客一跃而下。",
      skillDir,
      adapter,
      characterMemory: {
        canonicalIdentities: [{ id: "char-2", name: "燕赤霞" }],
        aliasEvidence: [
          { alias: "燕大侠", canonicalId: "char-2", source: "segment-1" },
        ],
        assertedFacts: {},
        inferredHints: {},
      },
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [{ id: "char-2", name: "燕赤霞" }],
      aliasEvidence: [
        {
          alias: "燕大侠",
          canonicalId: "char-2",
          source: "segment-3",
        },
      ],
      assertedFacts: {
        "char-2": {
          style: "冷峻",
        },
      },
      inferredHints: {},
    });
  });

  it("does not require any db dependency and only returns runtime artifact", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-3",
      segmentText: "路人甲点头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("completed");
    const completed = asCompletedResult(result);
    expect(completed.artifact.kind).toBe("character-memory-draft");
    expect(completed.artifact.characterMemoryDraft.canonicalIdentities).toEqual([]);
  });

  it("does not return fake success artifact when adapter call fails", async () => {
    const adapter: LLMAdapter = {
      call: jest.fn().mockRejectedValue(new Error("llm timeout")),
    };

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-5",
      segmentText: "宁采臣沉默。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("fails stage when llm returns non-json payload", async () => {
    const adapter = createMockAdapter("not-json");

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-6",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("fails stage when llm returns malformed empty object payload", async () => {
    const adapter = createMockAdapter("{}");

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-7",
      segmentText: "宁采臣抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("fails stage when llm returns malformed canonical identity entry", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [{}],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-8",
      segmentText: "燕赤霞抬头。",
      skillDir,
      adapter,
    });

    expect(result.status).toBe("failed");
    expect("artifact" in result).toBe(false);
  });

  it("uses the configured Mastra stage implementation", async () => {
    const adapter = createMockAdapter("{}");
    const runMastraCharacterDiscoveryStage = jest.fn().mockResolvedValue({
      stageRunId: "mastra-stage-1",
      status: "completed",
      artifact: {
        kind: "character-memory-draft",
        skillId: "character-extraction",
        characterMemoryDraft: {
          canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
          aliasEvidence: [],
          assertedFacts: {},
          inferredHints: {},
        },
      },
    } satisfies RunCharacterDiscoveryStageResult);

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-mastra-executor",
      segmentText: "宁采臣缓缓抬头。",
      skillDir,
      adapter,
      runMastraCharacterDiscoveryStage,
    });

    expect(result.status).toBe("completed");
    expect(runMastraCharacterDiscoveryStage).toHaveBeenCalledTimes(1);
    expect(adapter.call).toHaveBeenCalledTimes(0);
    expect(asCompletedResult(result).artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
      aliasEvidence: [],
      assertedFacts: {},
      inferredHints: {},
    });
  });

});

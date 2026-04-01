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
    expect(call.prompt).toContain("names:宁采臣, 燕赤霞");
    expect(call.prompt).toContain("aliasCount:1");
    expect(call.prompt).toContain("assertedCount:1");
    expect(call.prompt).toContain("inferredCount:1");
  });

  it("uses skill definition from the same skillDir source", async () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "character-discovery-stage-")
    );
    const fixtureSkillDir = path.join(fixtureRoot, "skills/character-extraction");

    fs.mkdirSync(path.join(fixtureSkillDir, "prompts"), { recursive: true });
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

  it("uses mastra executor path when stage executor is mastra", async () => {
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
      executor: "mastra",
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

  it("keeps native result as primary output when shadow mode is enabled", async () => {
    const adapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [{ id: "char-native", name: "宁采臣" }],
        aliasEvidence: [],
        assertedFacts: {},
        inferredHints: {},
      })
    );
    const runMastraCharacterDiscoveryStage = jest.fn().mockResolvedValue({
      stageRunId: "mastra-shadow-1",
      status: "completed",
      artifact: {
        kind: "character-memory-draft",
        skillId: "character-extraction",
        characterMemoryDraft: {
          canonicalIdentities: [{ id: "char-shadow", name: "燕赤霞" }],
          aliasEvidence: [],
          assertedFacts: {},
          inferredHints: {},
        },
      },
    } satisfies RunCharacterDiscoveryStageResult);

    const result = await runCharacterDiscoveryStage({
      workflowRunId: "wf-shadow-executor",
      segmentText: "宁采臣缓缓抬头。",
      skillDir,
      adapter,
      shadowMode: true,
      runMastraCharacterDiscoveryStage,
    });

    expect(result.status).toBe("completed");
    expect(runMastraCharacterDiscoveryStage).toHaveBeenCalledTimes(1);
    expect(adapter.call).toHaveBeenCalledTimes(1);
    expect(asCompletedResult(result).artifact.characterMemoryDraft).toEqual({
      canonicalIdentities: [{ id: "char-native", name: "宁采臣" }],
      aliasEvidence: [],
      assertedFacts: {},
      inferredHints: {},
    });
  });
});

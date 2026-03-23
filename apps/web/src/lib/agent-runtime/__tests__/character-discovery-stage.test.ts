import fs from "fs";
import os from "os";
import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import type { CharacterMemory } from "../context";
import { runCharacterDiscoveryStage } from "../runtime/stages/run-character-discovery-stage";

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

    await expect(
      runCharacterDiscoveryStage({
        workflowRunId: "wf-skill-source",
        segmentText: "宁采臣抬头。",
        skillDir: fixtureSkillDir,
        adapter,
      })
    ).rejects.toThrow("is not compatible with character-discovery-agent");
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
    expect(result.artifact).toBeDefined();
    expect(result.artifact.characterMemoryDraft).toEqual({
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
          路人甲: {
            role: "minor",
          },
        },
        inferredHints: {
          宁采臣: {
            tone: "书生气",
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
    expect(result.artifact.characterMemoryDraft.canonicalIdentities).toEqual([
      {
        id: "char-ning",
        name: "宁采臣",
      },
    ]);
    expect(result.artifact.characterMemoryDraft.assertedFacts).toEqual({
      "char-ning": {
        role: "main",
      },
    });
    expect(result.artifact.characterMemoryDraft.inferredHints).toEqual({
      "char-ning": {
        tone: "书生气",
      },
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
    expect(result.artifact.kind).toBe("character-memory-draft");
    expect(result.artifact.characterMemoryDraft.canonicalIdentities).toEqual([]);
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
});

import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
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

    expect(result.artifact.kind).toBe("character-memory-draft");
    expect(result.artifact.characterMemoryDraft.canonicalIdentities).toEqual([]);
  });
});

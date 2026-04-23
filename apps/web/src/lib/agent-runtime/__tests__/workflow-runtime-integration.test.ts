import path from "path";

import type { LLMAdapter } from "../adapters/llm-adapter";
import type { CharacterMemory } from "../context";
import { runCharacterDiscoveryStage } from "../runtime/stages/run-character-discovery-stage";
import { runSegmentScriptingStage } from "../runtime/stages/run-segment-scripting-stage";
import { runQualityStage } from "../runtime/stages/run-quality-stage";
import { canonicalizeSegmentScriptDraftSpeakers } from "../runtime/character-memory/canonicalize";
import { createBootstrapCharacterMemorySnapshot } from "../runtime/character-memory/store";

const workspaceRoot = path.resolve(__dirname, "../../../../../..");
const characterSkillDir = path.join(workspaceRoot, "skills/character-extraction");
const scriptSkillDir = path.join(workspaceRoot, "skills/script-generation");
const qualitySkillDir = path.join(workspaceRoot, "skills/quality-judgement");

const createMockAdapter = (content: string): LLMAdapter => ({
  call: jest.fn().mockResolvedValue({
    content,
    provider: "mock-provider",
    model: "mock-model",
    latencyMs: 5,
    usage: null,
  }),
});

describe("workflow runtime integration", () => {
  it("runs real discovery, scripting, and quality bundles with explicit alias evidence", async () => {
    const discoveryAdapter = createMockAdapter(
      JSON.stringify({
        canonicalIdentities: [{ id: "char-ning", name: "宁采臣" }],
        aliasEvidence: [
          {
            alias: "宁公子",
            canonicalId: "char-ning",
            source: "llm",
          },
        ],
        assertedFacts: {
          "char-ning": {
            importance: "main",
          },
        },
        inferredHints: {},
      })
    );
    const discoveryResult = await runCharacterDiscoveryStage({
      workflowRunId: "wf-runtime-integration",
      segmentText: "宁公子轻声道：“走吧。”",
      workspaceRoot,
      skillDir: characterSkillDir,
      adapter: discoveryAdapter,
    });

    expect(discoveryResult.status).toBe("completed");
    if (discoveryResult.status !== "completed") {
      throw new Error("expected completed discovery result");
    }
    expect(discoveryResult.artifact.skillId).toBe("character-extraction");

    const characterMemory: CharacterMemory = {
      canonicalIdentities:
        discoveryResult.artifact.characterMemoryDraft.canonicalIdentities ?? [],
      aliasEvidence: discoveryResult.artifact.characterMemoryDraft.aliasEvidence ?? [],
      assertedFacts: discoveryResult.artifact.characterMemoryDraft.assertedFacts ?? {},
      inferredHints: discoveryResult.artifact.characterMemoryDraft.inferredHints ?? {},
    };

    const scriptingAdapter = createMockAdapter(
      JSON.stringify({
        lines: [
          {
            id: "line-1",
            sourceText: "“走吧。”",
            text: "走吧。",
            speaker: "宁公子",
            orderInSegment: 0,
          },
        ],
      })
    );
    const scriptingResult = await runSegmentScriptingStage({
      workflowRunId: "wf-runtime-integration",
      segmentId: "segment-1",
      segmentText: "“走吧。”",
      workspaceRoot,
      skillDir: scriptSkillDir,
      characterMemory,
      adapter: scriptingAdapter,
    });

    expect(scriptingResult.status).toBe("completed");
    if (scriptingResult.status !== "completed") {
      throw new Error("expected completed scripting result");
    }

    const canonicalized = canonicalizeSegmentScriptDraftSpeakers({
      draft: scriptingResult.artifact.segmentScriptDraft,
      snapshot: createBootstrapCharacterMemorySnapshot([
        {
          id: "char-ning",
          canonicalName: "宁采臣",
          aliases: [{ alias: "宁公子" }],
        },
      ]),
    });

    expect(canonicalized.draft.lines[0]?.speaker).toBe("宁采臣");

    const qualityAdapter = createMockAdapter(
      JSON.stringify({
        score: 0.93,
        confidence: 0.94,
        reasons: ["角色归属稳定", "未发现语义冲突"],
        summary: "语义质量稳定，可自动通过",
      })
    );
    const qualityResult = await runQualityStage({
      workflowRunId: "wf-runtime-integration",
      segmentId: "segment-1",
      segmentScriptDraft: canonicalized.draft,
      validationReport: {
        segmentId: "segment-1",
        valid: true,
        coverageRatio: 1,
        issues: [],
      },
      workspaceRoot,
      skillDir: qualitySkillDir,
      characterMemory,
      characterResolutionEvidence: canonicalized.evidence,
      adapter: qualityAdapter,
    });

    expect(qualityResult.status).toBe("completed");
    if (qualityResult.status !== "completed") {
      throw new Error("expected completed quality result");
    }
    expect(qualityResult.decision).toBe("auto_pass");
    expect(qualityAdapter.call).toHaveBeenCalledTimes(1);
  });
});

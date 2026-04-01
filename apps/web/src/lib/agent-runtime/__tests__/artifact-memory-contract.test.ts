import {
  type CharacterMemory,
  type MemoryPatch,
  mergeCharacterMemory,
  type QualityVerdict,
  type RepairDecision,
  type SegmentScriptDraft,
  type ValidationReport,
} from "../context";

describe("artifact and memory contracts", () => {
  it("keeps assertedFacts and inferredHints as separate buckets", () => {
    const memory: CharacterMemory = {
      canonicalIdentities: [
        {
          id: "char-1",
          name: "Lin",
        },
      ],
      aliasEvidence: [
        {
          alias: "Linus",
          canonicalId: "char-1",
          source: "segment-1",
        },
      ],
      assertedFacts: {
        "char-1": {
          gender: "male",
        },
      },
      inferredHints: {
        "char-1": {
          tone: "calm",
        },
      },
    };

    expect(memory.assertedFacts).toEqual({
      "char-1": {
        gender: "male",
      },
    });
    expect(memory.inferredHints).toEqual({
      "char-1": {
        tone: "calm",
      },
    });
  });

  it("defines minimal fields for runtime artifacts", () => {
    const draft: SegmentScriptDraft = {
      segmentId: "segment-1",
      lines: [
        {
          id: "line-1",
          sourceText: "你好。",
          text: "你好。",
          speaker: "旁白",
          orderInSegment: 0,
        },
      ],
      createdAt: "2026-03-23T00:00:00.000Z",
    };

    const report: ValidationReport = {
      segmentId: "segment-1",
      valid: true,
      coverageRatio: 1,
      issues: [],
    };

    const decision: RepairDecision = {
      segmentId: "segment-1",
      action: "retry",
      reason: "json_parse_failed",
      retryable: true,
    };

    const verdict: QualityVerdict = {
      segmentId: "segment-1",
      verdict: "pass",
      score: 0.99,
      reasons: [],
    };

    expect(draft.lines[0]?.speaker).toBe("旁白");
    expect(report.coverageRatio).toBe(1);
    expect(decision.action).toBe("retry");
    expect(verdict.verdict).toBe("pass");
  });

  it("applies MemoryPatch without losing existing canonical identities", () => {
    const baseMemory: CharacterMemory = {
      canonicalIdentities: [
        { id: "char-1", name: "Lin" },
        { id: "char-2", name: "Ada" },
      ],
      aliasEvidence: [],
      assertedFacts: {},
      inferredHints: {},
    };

    const patch: MemoryPatch = {
      canonicalIdentities: [
        { id: "char-1", name: "Linus" },
        { id: "char-3", name: "Grace" },
      ],
      inferredHints: {
        "char-3": {
          style: "concise",
        },
      },
    };

    const merged = mergeCharacterMemory(baseMemory, patch);

    expect(merged.canonicalIdentities.map((item) => item.id)).toEqual([
      "char-1",
      "char-2",
      "char-3",
    ]);
    expect(merged.canonicalIdentities.find((item) => item.id === "char-1")?.name).toBe(
      "Linus"
    );
    expect(merged.inferredHints).toMatchObject({
      "char-3": {
        style: "concise",
      },
    });
  });

  it("merges per-canonical assertedFacts without dropping existing sub-fields", () => {
    const baseMemory: CharacterMemory = {
      canonicalIdentities: [{ id: "char-1", name: "Lin" }],
      aliasEvidence: [],
      assertedFacts: {
        "char-1": {
          gender: "male",
          age: 40,
        },
      },
      inferredHints: {},
    };

    const patch: MemoryPatch = {
      assertedFacts: {
        "char-1": {
          role: "main",
        },
      },
    };

    const merged = mergeCharacterMemory(baseMemory, patch);

    expect(merged.assertedFacts).toMatchObject({
      "char-1": {
        gender: "male",
        age: 40,
        role: "main",
      },
    });
  });
});

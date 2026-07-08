import {
  type CharacterMemory,
  type MemoryPatch,
  mergeCharacterMemory,
  type QualityVerdict,
  type RepairDecision,
  type SegmentScriptDraft,
  type ValidationReport,
} from "../context";
import {
  ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
  ARTIFACT_KIND_CHARACTER_RESOLUTION_EVIDENCE,
  createArtifactEnvelope,
} from "../protocol/artifacts";
import {
  EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
  EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED,
  EVENT_KIND_SPEAKER_CANONICALIZED,
  isExecutionEvent,
} from "../protocol/events";
import {
  createBootstrapCharacterMemorySnapshot,
} from "../runtime/character-memory/store";
import {
  canonicalizeSegmentScriptDraftSpeakers,
} from "../runtime/character-memory/canonicalize";

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

  it("defines first-class artifact kinds for character memory snapshot and resolution evidence", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-1",
        canonicalName: "宁采臣",
        aliases: [{ alias: "宁公子" }],
      },
    ]);
    const evidence = canonicalizeSegmentScriptDraftSpeakers({
      draft: {
        segmentId: "segment-1",
        createdAt: "2026-04-09T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "“见过姑娘。”",
            text: "见过姑娘。",
            speaker: "宁公子",
            orderInSegment: 0,
          },
        ],
      },
      snapshot,
    }).evidence;

    const snapshotArtifact = createArtifactEnvelope({
      id: "artifact-1",
      kind: ARTIFACT_KIND_CHARACTER_MEMORY_SNAPSHOT,
      version: "v1",
      createdAt: "2026-04-09T00:00:00.000Z",
      payload: snapshot,
    });
    const evidenceArtifact = createArtifactEnvelope({
      id: "artifact-2",
      kind: ARTIFACT_KIND_CHARACTER_RESOLUTION_EVIDENCE,
      version: "v1",
      createdAt: "2026-04-09T00:00:00.000Z",
      payload: evidence,
    });

    expect(snapshotArtifact.kind).toBe("character-memory-snapshot");
    expect(evidenceArtifact.kind).toBe("character-resolution-evidence");
    expect(snapshotArtifact.payload).toEqual(
      expect.objectContaining({
        version: 1,
        canonicalIdentities: [{ id: "char-1", name: "宁采臣" }],
      })
    );
    expect(evidenceArtifact.payload).toEqual(
      expect.objectContaining({
        memoryVersion: 1,
        resolvedSpeakers: [
          {
            raw: "宁公子",
            canonical: "宁采臣",
            reason: "alias_match",
          },
        ],
      })
    );
  });

  it("defines first-class event kinds for character memory lifecycle and speaker normalization", () => {
    expect(
      isExecutionEvent({
        id: "event-1",
        kind: EVENT_KIND_CHARACTER_MEMORY_BOOTSTRAPPED,
        createdAt: "2026-04-09T00:00:00.000Z",
        workflowRunId: "wf-1",
        status: "completed",
        payload: {
          memoryVersion: 1,
        },
      })
    ).toBe(true);
    expect(
      isExecutionEvent({
        id: "event-2",
        kind: EVENT_KIND_SPEAKER_CANONICALIZED,
        createdAt: "2026-04-09T00:00:00.000Z",
        workflowRunId: "wf-1",
        status: "completed",
        payload: {
          raw: "宁公子",
          canonical: "宁采臣",
        },
      })
    ).toBe(true);
    expect(EVENT_KIND_CHARACTER_MEMORY_REFRESH_FAILED).toBe(
      "character_memory_refresh_failed"
    );
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

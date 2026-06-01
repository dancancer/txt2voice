import type { SegmentScriptDraft } from "../context";
import { canonicalizeSegmentScriptDraftSpeakers } from "../runtime/character-memory/canonicalize";
import { createBootstrapCharacterMemorySnapshot } from "../runtime/character-memory/store";

describe("character memory canonicalize", () => {
  it("keeps canonical speakers unchanged and rewrites aliases to canonical names", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-ning",
        canonicalName: "宁尘",
        aliases: [{ alias: "宁公子" }],
      },
      {
        id: "char-long",
        canonicalName: "龙雅歌",
        aliases: [{ alias: "宫主" }],
      },
    ]);
    const draft: SegmentScriptDraft = {
      segmentId: "segment-1",
      createdAt: "2026-04-09T00:00:00.000Z",
      lines: [
        {
          id: "line-1",
          sourceText: "宁尘抬头。",
          text: "宁尘抬头。",
          speaker: "宁尘",
          orderInSegment: 0,
        },
        {
          id: "line-2",
          sourceText: "“跟上。”",
          text: "跟上。",
          speaker: "宫主",
          orderInSegment: 1,
        },
        {
          id: "line-3",
          sourceText: "“是。”",
          text: "是。",
          speaker: "陌生人",
          orderInSegment: 2,
        },
      ],
    };

    const result = canonicalizeSegmentScriptDraftSpeakers({
      draft,
      snapshot,
    });

    expect(result.draft.lines.map((line) => line.speaker)).toEqual([
      "宁尘",
      "龙雅歌",
      "陌生人",
    ]);
    expect(result.evidence.memoryVersion).toBe(1);
    expect(result.evidence.unresolvedSpeakers).toEqual(["陌生人"]);
    expect(result.evidence.resolvedSpeakers).toEqual([
      { raw: "宁尘", canonical: "宁尘", reason: "direct_match" },
      { raw: "宫主", canonical: "龙雅歌", reason: "alias_match" },
      { raw: "陌生人", canonical: "陌生人", reason: "unknown" },
    ]);
  });

  it("treats narration speaker as resolved without requiring character memory", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([]);
    const draft: SegmentScriptDraft = {
      segmentId: "segment-narration",
      createdAt: "2026-04-09T00:00:00.000Z",
      lines: [
        {
          id: "line-narration",
          sourceText: "山风吹过。",
          text: "山风吹过。",
          speaker: "旁白",
          orderInSegment: 0,
        },
      ],
    };

    const result = canonicalizeSegmentScriptDraftSpeakers({
      draft,
      snapshot,
    });

    expect(result.evidence.unresolvedSpeakers).toEqual([]);
    expect(result.evidence.resolvedSpeakers).toEqual([
      { raw: "旁白", canonical: "旁白", reason: "direct_match" },
    ]);
  });

  it("preserves ambiguous aliases and records conflict evidence", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-ning",
        canonicalName: "宁尘",
        aliases: [{ alias: "少主" }],
      },
      {
        id: "char-long",
        canonicalName: "龙雅歌",
        aliases: [{ alias: "少主" }],
      },
    ]);
    const draft: SegmentScriptDraft = {
      segmentId: "segment-2",
      createdAt: "2026-04-09T00:00:00.000Z",
      lines: [
        {
          id: "line-1",
          sourceText: "“停下。”",
          text: "停下。",
          speaker: "少主",
          orderInSegment: 0,
        },
      ],
    };

    const result = canonicalizeSegmentScriptDraftSpeakers({
      draft,
      snapshot,
    });

    expect(result.draft.lines[0]?.speaker).toBe("少主");
    expect(result.evidence.unresolvedSpeakers).toEqual(["少主"]);
    expect(result.evidence.aliasConflicts).toEqual([
      {
        speaker: "少主",
        candidateCanonicals: ["宁尘", "龙雅歌"],
      },
    ]);
    expect(result.evidence.resolvedSpeakers).toEqual([
      { raw: "少主", canonical: "少主", reason: "unknown" },
    ]);
  });

  it("does not canonicalize heuristic short-name variations without explicit alias evidence", () => {
    const snapshot = createBootstrapCharacterMemorySnapshot([
      {
        id: "char-ning",
        canonicalName: "宁采臣",
        aliases: [],
      },
    ]);
    const draft: SegmentScriptDraft = {
      segmentId: "segment-3",
      createdAt: "2026-04-09T00:00:00.000Z",
      lines: [
        {
          id: "line-1",
          sourceText: "“我知道了。”",
          text: "我知道了。",
          speaker: "采臣",
          orderInSegment: 0,
        },
      ],
    };

    const result = canonicalizeSegmentScriptDraftSpeakers({
      draft,
      snapshot,
    });

    expect(result.draft.lines[0]?.speaker).toBe("采臣");
    expect(result.evidence.unresolvedSpeakers).toEqual(["采臣"]);
    expect(result.evidence.resolvedSpeakers).toEqual([
      { raw: "采臣", canonical: "采臣", reason: "unknown" },
    ]);
  });
});

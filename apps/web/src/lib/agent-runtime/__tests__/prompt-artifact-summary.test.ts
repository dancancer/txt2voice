import { summarizePromptArtifact } from "../runtime/prompt-artifact-summary";

describe("prompt artifact summary", () => {
  it("summarizes segment script drafts into usable structured evidence", () => {
    const summary = summarizePromptArtifact({
      segmentId: "segment-1",
      createdAt: "2026-04-09T00:00:00.000Z",
      provider: "mock-provider",
      model: "mock-model",
      rawResponse: `${"X".repeat(1200)}TAIL_MARKER`,
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
    });

    expect(summary).toEqual({
      segmentId: "segment-1",
      provider: "mock-provider",
      model: "mock-model",
      rawResponseExcerpt: "X".repeat(600),
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
    });
  });

  it("retains nested validation report evidence inside validation-failure artifacts", () => {
    const summary = summarizePromptArtifact({
      kind: "validation-failure",
      segmentId: "segment-2",
      validationReport: {
        segmentId: "segment-2",
        valid: false,
        coverageRatio: 0.61,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below threshold",
          },
        ],
      },
      structuredResult: {
        segmentId: "segment-2",
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
    });

    expect(summary).toEqual({
      kind: "validation-failure",
      segmentId: "segment-2",
      validationReport: {
        segmentId: "segment-2",
        valid: false,
        coverageRatio: 0.61,
        issues: [
          {
            code: "LOW_COVERAGE",
            message: "coverage below threshold",
          },
        ],
      },
      structuredResult: {
        segmentId: "segment-2",
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
    });
  });
});

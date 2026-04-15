import {
  refineFailedSegment,
  shouldRefineSegmentFailure,
} from "../runtime/script-production/helpers/failed-segment-refinement";

describe("failed segment refinement", () => {
  it("only refines targeted validation failures", () => {
    expect(
      shouldRefineSegmentFailure({
        errorCode: "OTHER_ERROR",
        issueCodes: ["TEXT_SOURCE_MISMATCH"],
      })
    ).toBe(false);

    expect(
      shouldRefineSegmentFailure({
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["NON_WHITESPACE_GAP"],
        coverageRatio: 0.995,
      })
    ).toBe(false);

    expect(
      shouldRefineSegmentFailure({
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH"],
        coverageRatio: 0.995,
      })
    ).toBe(true);
  });

  it("splits attributed quote runs into deterministic slices", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-1",
        chapterId: "chapter-1",
        orderIndex: 7,
        content: "“你好。”他说。“再见。”",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH"],
      },
    });

    expect(refined).toHaveLength(3);
    expect(refined.map((slice) => slice.content)).toEqual([
      "“你好。”",
      "他说。",
      "“再见。”",
    ]);
    expect(refined.map((slice) => [slice.offsetStart, slice.offsetEnd])).toEqual([
      [0, 5],
      [5, 8],
      [8, 13],
    ]);
    expect(refined.every((slice) => slice.parentSegmentId === "seg-1")).toBe(true);
  });
});

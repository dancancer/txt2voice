// 一旦我被更新，请更新我的开头注释
// input: 失败段样本/失败详情
// output: 失败段细分策略断言
// pos: Phase 1 失败段细分测试
import {
  refineFailedSegment,
  shouldRefineSegmentFailure,
} from "../script-generator/pipeline/refinement/failed-segment-refinement";

describe("failed-segment-refinement", () => {
  it("should split mixed attributed dialogue content into smaller retryable slices", () => {
    const content = '张三说：“你好。”闵弘芳皱起眉头：“属下近日听得风响。”';

    const refined = refineFailedSegment({
      segment: {
        id: "seg-1",
        chapterId: "chapter-1",
        orderIndex: 0,
        content,
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      '张三说：“你好。”',
      "闵弘芳皱起眉头：",
      '“属下近日听得风响。”',
    ]);
    expect(refined[0]).toMatchObject({
      parentSegmentId: "seg-1",
      offsetStart: 0,
    });
    expect(refined[1].offsetStart).toBeGreaterThanOrEqual(refined[0].offsetEnd);
  });

  it("should only refine validator failures that look like boundary or coverage problems", () => {
    expect(
      shouldRefineSegmentFailure({
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH"],
      })
    ).toBe(true);

    expect(
      shouldRefineSegmentFailure({
        errorCode: "DIALOGUE_TOO_LONG",
        issueCodes: ["DIALOGUE_TOO_LONG"],
      })
    ).toBe(false);
  });
});

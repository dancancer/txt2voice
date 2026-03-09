// 一旦我被更新，请更新我的开头注释
// input: 对白密集章节样本/分段参数
// output: 风险感知切段断言
// pos: 单元测试
import { createChapterSegmentRecords } from "../text-processor";
import { resolveTextSegmentationRiskProfile } from "../text-segmentation-profile";

describe("text processor script correctness safeguards", () => {
  it("should shrink target segment length for dialogue-dense content", () => {
    const content = Array.from({ length: 12 }, (_, index) => {
      return `“第${index + 1}句对白。”张三说。`;
    }).join("\n");

    const profile = resolveTextSegmentationRiskProfile(content, {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
    });

    expect(profile.reasons).toContain('dialogue_dense');
    expect(profile.preferredMaxSegmentLength).toBeLessThan(1200);
    expect(profile.preferredMinSegmentLength).toBeLessThan(400);
  });

  it("should ignore english apostrophes when profiling dialogue density", () => {
    const content = [
      "I'm sure it's fine, don't worry.",
      "We'll see whether John's ready.",
      "They've said it's already done.",
      "I can't believe we're still waiting.",
    ].join(" ");

    const profile = resolveTextSegmentationRiskProfile(content, {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
    });

    expect(profile.quoteCount).toBe(0);
    expect(profile.dialogueLineCount).toBe(0);
    expect(profile.reasons).toEqual(["default"]);
    expect(profile.preferredMaxSegmentLength).toBe(1200);
    expect(profile.preferredMinSegmentLength).toBe(400);
  });

  it("should ignore non-dialogue apostrophe patterns like decades and rock 'n' roll", () => {
    const content = [
      "The boys' bikes from the '90s are still here.",
      "Rock 'n' roll isn't dead, and that's fine.",
    ].join(" ");

    const profile = resolveTextSegmentationRiskProfile(content, {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
    });

    expect(profile.quoteCount).toBe(0);
    expect(profile.dialogueLineCount).toBe(0);
    expect(profile.reasons).toEqual(["default"]);
  });

  it("should write segmentation risk metadata into chapter and segment records", () => {
    const content = `第一章 开始\n\n${Array.from({ length: 18 }, (_, index) => {
      return `“第${index + 1}句对白。”张三说。李四回答：“收到。”`;
    }).join("\n")}`;

    const result = createChapterSegmentRecords('book-1', content, {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
      preserveFormatting: true,
    });

    expect(result.chapterRecords).toHaveLength(1);
    const chapterMetadata = result.chapterRecords[0].metadata as Record<string, unknown>;
    expect(chapterMetadata.segmentationRiskReasons).toEqual(
      expect.arrayContaining(['dialogue_dense'])
    );
    expect(chapterMetadata.segmentationTargetMaxLength).toBeLessThan(1200);

    const firstSegmentMetadata = result.segmentRecords[0].metadata as Record<string, unknown>;
    expect(firstSegmentMetadata.segmentationRiskReasons).toEqual(
      expect.arrayContaining(['dialogue_dense'])
    );
    expect(firstSegmentMetadata.segmentationTargetMaxLength).toBeLessThan(1200);
    expect(result.segmentRecords.length).toBeGreaterThan(1);
  });
});

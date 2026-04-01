import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeColonAttribution,
  looksLikeGenericDaoAttribution,
  PUNCTUATION_ONLY_PATTERN,
} from "../script-generator/pipeline/dialogue-attribution-heuristics";

describe("dialogue attribution heuristics", () => {
  it("shares the common attribution and display cues across validator and refinement", () => {
    expect(hasSpeechAttributionCue("张三笑道：")).toBe(true);
    expect(hasReportReadingCue("闵弘芳从储物戒中取出宗门呈报，一字一句念起来。")).toBe(
      true
    );
    expect(looksLikeGenericDaoAttribution("李四道：")).toBe(true);
    expect(looksLikeColonAttribution("龙宗主：")).toBe(true);
    expect(isDisplayTextCue("牌子上写着")).toBe(true);
    expect(PUNCTUATION_ONLY_PATTERN.test("，……")).toBe(true);
  });
});

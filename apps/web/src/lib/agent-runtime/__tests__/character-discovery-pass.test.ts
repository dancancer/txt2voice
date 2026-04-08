import {
  buildCharacterDiscoverySampleText,
  CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT,
} from "../runtime/script-production/run-character-discovery-pass";

describe("character discovery pass sampling", () => {
  it("samples across the whole book instead of only the earliest segments", () => {
    expect(CHARACTER_DISCOVERY_SAMPLE_SEGMENT_LIMIT).toBe(3);

    const sampleText = buildCharacterDiscoverySampleText([
      { id: "seg-1", content: "第一段角色铺垫。" },
      { id: "seg-2", content: "第二段环境描写。" },
      { id: "seg-3", content: "第三段路人对白。" },
      { id: "seg-4", content: "第四段重要角色登场。" },
      { id: "seg-5", content: "第五段反派揭面。" },
    ]);

    expect(sampleText).toContain("第一段角色铺垫。");
    expect(sampleText).toContain("第三段路人对白。");
    expect(sampleText).toContain("第五段反派揭面。");
    expect(sampleText).not.toContain("第二段环境描写。");
    expect(sampleText).not.toContain("第四段重要角色登场。");
  });
});

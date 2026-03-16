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
      "张三说：",
      '“你好。”',
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

  it("should keep punctuated quoted speech intact when splitting by sentence boundaries", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-quoted",
        chapterId: "chapter-1",
        orderIndex: 0,
        content:
          '“宁大哥，宁大爷！行行好，您嗦的那皮儿能扔碗里不？”宁尘眼也不睁，脸上挂起笑：“瞧您说的！您耿老大都发话了，我能下这面子吗。”',
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      '“宁大哥，宁大爷！行行好，您嗦的那皮儿能扔碗里不？”',
      "宁尘眼也不睁，脸上挂起笑：",
      "“瞧您说的！您耿老大都发话了，我能下这面子吗。”",
    ]);
  });

  it("should split narration plus attributed dialogue into semantic retry slices", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-scene",
        chapterId: "chapter-1",
        orderIndex: 1,
        content:
          "她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”闵弘芳又一拍手，侍女们便快步消失在了侧门之外。女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      "她往殿中黄金大榻一靠，抬手轻挥：",
      "“人多心乱，都撤了吧。”",
      "闵弘芳又一拍手，侍女们便快步消失在了侧门之外。女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。",
    ]);
  });

  it("should split long multi-sentence quoted spans into smaller retry slices", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-long-quote",
        chapterId: "chapter-1",
        orderIndex: 2,
        content:
          "“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      "“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。",
      "本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”",
    ]);
  });

  it("should merge attribution narration with following quoted report spans", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-report",
        chapterId: "chapter-1",
        orderIndex: 3,
        content:
          "闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”“丹药堂新产丹药四百枚……”这边厢游响停云。",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      "闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”“丹药堂新产丹药四百枚……”",
      "这边厢游响停云。",
    ]);
  });

  it("should split leading acknowledgement before merging attribution with report quotes", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-report-intro",
        chapterId: "chapter-1",
        orderIndex: 4,
        content:
          "“是。”闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”“丹药堂新产丹药四百枚……”这边厢游响停云。",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      "“是。”",
      "闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”“丹药堂新产丹药四百枚……”",
      "这边厢游响停云。",
    ]);
  });
});

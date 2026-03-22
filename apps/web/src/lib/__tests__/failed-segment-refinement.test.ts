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

    expect(
      shouldRefineSegmentFailure({
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["QUOTED_NARRATION"],
      })
    ).toBe(true);
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

  it("should keep ongoing report quotes merged inside the real failure segment", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-report-continuation",
        chapterId: "chapter-1",
        orderIndex: 6,
        content:
          "“宗主何事忧烦？”\n　　“昨晚喝多了……”\n　　闵弘芳忍了半天才没让嘴撇起来：“凭宗主浩然气机，几樽仙酿下去怕也是醉不倒的。”\n　　龙雅歌纤手扶额，视线落在空阔的大殿尽头：“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”\n　　“宗主切莫自扰，我宗所据陵允二州，地广人稀，难免有个疏漏。前代宗主传下的诏言总不会有错，时机一到便会拨云见日……”\n　　“天天就这么一套说辞，烦不烦，烦不烦。”龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”\n　　“是。”闵弘芳从储物戒中取出宗门呈报，一字一句念起来。\n　　“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”\n　　“丹药堂新产丹药四百枚……”\n　　这边厢游响停云，那边厢心不在焉，闵弘芳念了小半个时辰，龙雅歌一桌子菜都扫净了。\n　　“外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……”\n　　“另有药圃走水两次，经查是外门弟子中有人故意所为。巡查堂报，尚未擒获疑凶，还需时日……”",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP", "LOW_COVERAGE"],
      },
    });

    const contents = refined.map((item) => item.content);
    const mergedReportSlice = contents.find(
      (item) =>
        item.includes("一字一句念起来") &&
        item.includes("外门弟子斗殴两起") &&
        item.includes("另有药圃走水两次")
    );

    expect(mergedReportSlice).toBeDefined();
    expect(contents).not.toContain("“丹药堂新产丹药四百枚……”");
    expect(contents).not.toContain(
      "“外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……”"
    );
  });

  it("should preserve original whitespace when merging adjacent narration slices", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-whitespace",
        chapterId: "chapter-1",
        orderIndex: 5,
        content: "前文。\n\n后文。“你好。”",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual(["前文。\n\n后文。", "“你好。”"]);
    expect(refined[0]).toMatchObject({
      offsetStart: 0,
      offsetEnd: 8,
    });
  });

  it("should split long narration from trailing quotes with explicit speaker labels", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-tail-quote",
        chapterId: "chapter-1",
        orderIndex: 5,
        content:
          "宁尘那嘴就跟抹着迷魂药一样，也不知和人家说些啥，总能大事化小小事化了。真要打也敢打，打完了巡查堂一来，保准让他编个天花乱坠，对头们讨不得半分好处。赶上他又会来事儿，三五回下来跟巡查堂几个内门弟子混得那叫一个热乎。念着他的好，灵宝堂的外门弟子也没法儿说三道四。不就是搓两件衣服么！搓！搓还不行吗！宁尘嗑完最后一颗瓜子儿，打么打么手，起来伸了个懒腰。“耿老大，搓完衣服记得抻平整儿了再晾，昂！”耿魄：“你他娘……”",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["QUOTED_NARRATION", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined.map((item) => item.content)).toEqual([
      "宁尘那嘴就跟抹着迷魂药一样，也不知和人家说些啥，总能大事化小小事化了。真要打也敢打，打完了巡查堂一来，保准让他编个天花乱坠，对头们讨不得半分好处。赶上他又会来事儿，三五回下来跟巡查堂几个内门弟子混得那叫一个热乎。念着他的好，灵宝堂的外门弟子也没法儿说三道四。不就是搓两件衣服么！搓！搓还不行吗！宁尘嗑完最后一颗瓜子儿，打么打么手，起来伸了个懒腰。",
      "“耿老大，搓完衣服记得抻平整儿了再晾，昂！”",
      "耿魄：",
      "“你他娘……”",
    ]);
  });

  it("should not treat ASCII apostrophes inside English words as quote boundaries", () => {
    const refined = refineFailedSegment({
      segment: {
        id: "seg-english",
        chapterId: "chapter-1",
        orderIndex: 6,
        content: "I'm here. It's done. We'll leave when John's ready.",
      },
      failure: {
        errorCode: "SCRIPT_VALIDATION_FAILED",
        issueCodes: ["TEXT_SOURCE_MISMATCH", "NON_WHITESPACE_GAP"],
      },
    });

    expect(refined).toEqual([]);
  });
});

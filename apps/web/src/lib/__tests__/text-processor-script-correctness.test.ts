// 一旦我被更新，请更新我的开头注释
// input: 对白密集章节样本/分段参数
// output: 风险感知切段断言
// pos: 单元测试
import { createChapterSegmentRecords } from "../text-processor";
import { createChapterSegmentRecords as createChapterSegmentRecordsFromModule } from "../text-processing/chapters/chapter-segmentation";
import { resolveTextSegmentationRiskProfile } from "../text-segmentation-profile";

const normalizeChapterSegmentationResult = (
  result: ReturnType<typeof createChapterSegmentRecords>
) => {
  const chapterIdMap = new Map(
    result.chapterRecords.map((chapter, index) => [chapter.id, `chapter-${index}`])
  );

  return {
    ...result,
    chapterRecords: result.chapterRecords.map((chapter, index) => ({
      ...chapter,
      id: `chapter-${index}`,
    })),
    segmentRecords: result.segmentRecords.map((segment) => ({
      ...segment,
      chapterId:
        typeof segment.chapterId === "string"
          ? chapterIdMap.get(segment.chapterId) || segment.chapterId
          : segment.chapterId,
    })),
  };
};

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

  it("should avoid producing orphaned quoted tails in segmented records", () => {
    const dialogueBlock = [
      '“宁大哥，宁大爷！行行好，您嗦的那皮儿能扔碗里不？”',
      '宁尘眼也不睁，脸上挂起笑：“瞧您说的！您耿老大都发话了，我能下这面子吗。”',
      '耿魄也就比宁尘大个三两岁，一句耿老大给他叫迷糊了。',
    ].join("");

    const content = `第一章 开始\n\n${dialogueBlock.repeat(6)}`;

    const result = createChapterSegmentRecords("book-quote-safe", content, {
      maxSegmentLength: 120,
      minSegmentLength: 40,
      preserveFormatting: true,
    });

    const hasOrphanedTail = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasOrphanedTail).toBe(false);
  });

  it("should keep forced-split segments quote-balanced for long attributed dialogue scenes", () => {
    const content = `第一章 开始\n\n${[
      '前文铺垫让段落迅速逼近上限。',
      '“本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
      '“宗主切莫自扰，我宗所据陵允二州，地广人稀，难免有个疏漏。前代宗主传下的诏言总不会有错，时机一到便会拨云见日……”',
      '“天天就这么一套说辞，烦不烦，烦不烦。”龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”',
      '后文继续推进，让整段长度足以进入 forced split 分支。',
    ].join('')}`;

    const result = createChapterSegmentRecords("book-quote-safe-long", content, {
      maxSegmentLength: 120,
      minSegmentLength: 40,
      preserveFormatting: true,
    });

    const hasUnbalancedQuoteSegment = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasUnbalancedQuoteSegment).toBe(false);
  });

  it("should keep long quoted tails intact when only forward safe break exists", () => {
    const content = `第一章 开始\n\n${`前文铺垫${'甲'.repeat(30)}“${'乙'.repeat(125)}。”后文收束。`}`;

    const result = createChapterSegmentRecords("book-quote-safe-forward", content, {
      maxSegmentLength: 120,
      minSegmentLength: 40,
      preserveFormatting: true,
    });

    const hasUnbalancedQuoteSegment = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasUnbalancedQuoteSegment).toBe(false);
  });

  it("should keep multi-sentence quoted dialogue balanced across segment boundaries", () => {
    const content = `第一章 开始\n\n${[
      '前文铺垫。',
      '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
      '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
      '后文收束。',
    ].join('')}`;

    const result = createChapterSegmentRecords("book-quote-safe-multi-sentence", content, {
      maxSegmentLength: 120,
      minSegmentLength: 40,
      preserveFormatting: true,
    });

    const hasUnbalancedQuoteSegment = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasUnbalancedQuoteSegment).toBe(false);
  });

  it("should not split the sampled chapter dialogue scene into orphaned quote segments", () => {
    const sampledScene = [
      "那鱼已蒸得酥烂，抿入唇中遍化作一蓬鲜美汁水，满口生香。可女子还是哀声叹了一口气。“头痛啊，头痛……”",
      "殿中除了闵弘芳，便只有后殿屏风边站着的一名黑衣束装女子。那女子是近侍，日不多言夜不多语，回话的活儿自然要落到正掌殿闵弘芳一人身上。“宗主何事忧烦？”",
      "“昨晚喝多了……”",
      "闵弘芳忍了半天才没让嘴撇起来：“凭宗主浩然气机，几樽仙酿下去怕也是醉不倒的。”",
      "龙雅歌纤手扶额，视线落在空阔的大殿尽头：“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。",
      "本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”",
      "“宗主切莫自扰，我宗所据陵允二州，地广人稀，难免有个疏漏。前代宗主传下的诏言总不会有错，时机一到便会拨云见日……”",
      "“天天就这么一套说辞，烦不烦，烦不烦。”龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”",
      "“是。”闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”",
      "“丹药堂新产丹药四百枚……”",
    ].join("");

    const content = `第一章 开始\n\n${sampledScene}`;

    const result = createChapterSegmentRecords("book-sampled-scene", content, {
      maxSegmentLength: 360,
      minSegmentLength: 200,
      preserveFormatting: true,
    });

    const hasUnbalancedQuoteSegment = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasUnbalancedQuoteSegment).toBe(false);
  });

  it("should keep the sampled chapter opening scene quote-balanced under real risk-profile limits", () => {
    const sampledOpeningScene =
      "作者：殁藏龙门\n　　\n　　第一章：此地无银三百两\n　　一双素手在空中一拍，十几名侍女从两侧小门鱼贯而入。姑娘们走得又轻又快，窸窸窣窣如小溪淌水，眨眼功夫，偌大一张仙桐大桌便布上了琳琅满目几十样佳肴。闵弘芳穿着青白色金边大袍端立桌旁，注视着来往侍女的一举一动。她像往常一样傲着张脸，众侍女垂头俯首，不敢多看她一眼。几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。“请宗主用膳——”片刻，后殿荡来一丝清香，紧接着一身如火红裳飘然而现。红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”\n　　闵弘芳又一拍手，侍女们便快步消失在了侧门之外。女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。那鱼已蒸得酥烂，抿入唇中遍化作一蓬鲜美汁水，满口生香。可女子还是哀声叹了一口气。“头痛啊，头痛……”\n　　殿中除了闵弘芳，便只有后殿屏风边站着的一名黑衣束装女子。那女子是近侍，日不多言夜不多语，回话的活儿自然要落到正掌殿闵弘芳一人身上。“宗主何事忧烦？”\n　　“昨晚喝多了……”\n　　闵弘芳忍了半天才没让嘴撇起来：“凭宗主浩然气机，几樽仙酿下去怕也是醉不倒的。”\n　　龙雅歌纤手扶额，视线落在空阔的大殿尽头：“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”\n　　“宗主切莫自扰，我宗所据陵允二州，地广人稀，难免有个疏漏。前代宗主传下的诏言总不会有错，时机一到便会拨云见日……”\n　　“天天就这么一套说辞，烦不烦，烦不烦。”龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”\n　　“是。”闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”\n　　“丹药堂新产丹药四百枚……”这边厢游响停云，那边厢心不在焉，闵弘芳念了小半个时辰，龙雅歌一桌子菜都扫净了。“外门弟子斗殴两起，内门弟子偷盗一起，均由巡查堂长老按宗门律施以惩戒……”\n　　“另有药圃走水两次，经查是外门弟子中有人故意所为。巡查堂报，尚未擒获疑凶，还需时日……”\n　　“胆儿挺大的啊。”龙雅歌举起杯子，向斜后方黑衣女子偏了偏头，女子上前一步绰起酒壶，将她手中玉杯填满。“巡查堂昨日已遣派真传弟子过外门掌问，两三日便有结果。但不知道拿到了祸首该如何处置，还望宗主示下。”\n　　“宗门律怎么写的便怎么处置，何必问本宫。”龙雅歌一口将杯中酒饮下，任由脸颊红起来。闵弘芳皱起眉头：“属下近日听得风响，金州盛山宗、壁州万泉宗颇有些蠢蠢欲动。现在有人在药圃纵火这样巧，难免有猫腻……”\n　　“那就等抓到了人，废掉气海，隐蛇窟里扔上两天，不怕不交代。”\n　　龙雅歌随口扔下一句，将及地红裙一甩，转入后殿去了。数日前。赶上每月十五没有功课，宗门里的工活儿也停了。";

    const result = createChapterSegmentRecords("book-sampled-opening-scene", sampledOpeningScene, {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
      preserveFormatting: true,
    });

    const hasUnbalancedQuoteSegment = result.segmentRecords.some((segment) => {
      const trimmed = segment.content.trim();
      const openCount = (trimmed.match(/[“「『]/g) || []).length;
      const closeCount = (trimmed.match(/[”」』]/g) || []).length;
      return openCount !== closeCount;
    });

    expect(hasUnbalancedQuoteSegment).toBe(false);
  });

  it("should keep facade chapter segmentation identical to the extracted module", () => {
    const content = `第一章 开始\n\n“宁采臣抬头。”张三说。\n\n第二章 继续\n\n李四回答：“收到。”`;
    const options = {
      maxSegmentLength: 1200,
      minSegmentLength: 400,
      preserveFormatting: true,
    };

    const facadeResult = createChapterSegmentRecords("book-compare", content, options);
    const moduleResult = createChapterSegmentRecordsFromModule(
      "book-compare",
      content,
      options
    );

    expect(normalizeChapterSegmentationResult(moduleResult)).toEqual(
      normalizeChapterSegmentationResult(facadeResult)
    );
  });
});

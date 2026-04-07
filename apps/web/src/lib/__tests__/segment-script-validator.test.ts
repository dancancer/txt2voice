// 一旦我被更新，请更新我的开头注释
// input: 原文片段/LLM 台本样本
// output: 保真校验断言
// pos: 单元测试
import {
  resolveScriptLineText,
  validateSegmentScript,
} from "../script-generator/pipeline/segment-script-validator";

describe("segment script validator", () => {
  it("should accept exact source coverage and strip dialogue quotes only at boundary", () => {
    const result = validateSegmentScript({
      segmentContent: '“你好。” 张三点点头。',
      scriptSentences: [
        {
          sourceText: '“你好。”',
          text: '你好。',
          speaker: '张三',
        },
        {
          sourceText: '张三点点头。',
          text: '张三点点头。',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(resolveScriptLineText({ sourceText: '“你好。”', speaker: '张三' })).toBe(
      '你好。'
    );
    expect(
      resolveScriptLineText({ sourceText: '张三点点头。', speaker: '旁白' })
    ).toBe('张三点点头。');
  });

  it("should accept attributed dialogue spans as long as the spoken text matches", () => {
    const result = validateSegmentScript({
      segmentContent: '张三说：“你好。”',
      scriptSentences: [
        {
          sourceText: '张三说：“你好。”',
          text: '你好。',
          speaker: '张三',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '张三说：“你好。”',
      resolvedText: '你好。',
    });
  });

  it("should accept action-led quoted dialogue without explicit speech verbs", () => {
    const result = validateSegmentScript({
      segmentContent: '龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”',
      scriptSentences: [
        {
          sourceText: '龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”',
          text: '把这个月呈报念完，你也赶紧用饭去吧。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '龙宗主捂着脑袋嗔起来，“把这个月呈报念完，你也赶紧用饭去吧。”',
      resolvedText: '把这个月呈报念完，你也赶紧用饭去吧。',
    });
  });

  it("should accept report-reading lead-in before quoted content", () => {
    const result = validateSegmentScript({
      segmentContent:
        '闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”',
      scriptSentences: [
        {
          sourceText:
            '闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”',
          text: '陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……',
          speaker: '闵弘芳',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText:
        '闵弘芳从储物戒中取出宗门呈报，一字一句念起来。“陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……”',
      resolvedText: '陵州纳灵石二十万枚，允州纳灵石十三万枚，宗门灵矿……',
    });
  });

  it("should reject compressing long scenic lead-in into only the trailing spoken quote", () => {
    const result = validateSegmentScript({
      segmentContent:
        '红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”',
      scriptSentences: [
        {
          sourceText:
            '红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”',
          text: '人多心乱，都撤了吧。',
          speaker: '红衣女子',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('TEXT_SOURCE_MISMATCH');
  });

  it("should accept interrupted attributed dialogue spans as one spoken line", () => {
    const result = validateSegmentScript({
      segmentContent: '"你好，"他说，"我是测试角色。"',
      scriptSentences: [
        {
          sourceText: '"你好，"他说，"我是测试角色。"',
          text: '你好，我是测试角色。',
          speaker: '张三',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '"你好，"他说，"我是测试角色。"',
      resolvedText: '你好，我是测试角色。',
    });
  });

  it("should accept refined leading quote fragments as dialogue text", () => {
    const result = validateSegmentScript({
      segmentContent: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
      scriptSentences: [
        {
          sourceText: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
          text: '本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(
      resolveScriptLineText({
        sourceText: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
        speaker: '龙雅歌',
      })
    ).toBe('本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。');
  });

  it("should accept refined trailing quote fragments as dialogue text", () => {
    const result = validateSegmentScript({
      segmentContent: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
      scriptSentences: [
        {
          sourceText: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
          text: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(
      resolveScriptLineText({
        sourceText: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
        speaker: '龙雅歌',
      })
    ).toBe('本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。');
  });

  it("should accept pure quoted dialogue with dangling leading punctuation inside quotes", () => {
    const result = validateSegmentScript({
      segmentContent: '“，我想我会喜欢上你的。”',
      scriptSentences: [
        {
          sourceText: '“，我想我会喜欢上你的。”',
          text: '我想我会喜欢上你的。',
          speaker: '宁尘',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '“，我想我会喜欢上你的。”',
      resolvedText: '我想我会喜欢上你的。',
    });
  });

  it("should accept attributed dialogue fragments with unmatched opening quote after attribution", () => {
    const result = validateSegmentScript({
      segmentContent: '龙雅歌疲惫一笑：“只是从分神中期摔到了底。',
      scriptSentences: [
        {
          sourceText: '龙雅歌疲惫一笑：“只是从分神中期摔到了底。',
          text: '只是从分神中期摔到了底。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '龙雅歌疲惫一笑：“只是从分神中期摔到了底。',
      resolvedText: '只是从分神中期摔到了底。',
    });
  });

  it("should accept dialogue fragments with dangling trailing opening quote and comma", () => {
    const result = validateSegmentScript({
      segmentContent: '我要干倒他们，宁尘你来帮我“，',
      scriptSentences: [
        {
          sourceText: '我要干倒他们，宁尘你来帮我“，',
          text: '我要干倒他们，宁尘你来帮我',
          speaker: '程婉',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText: '我要干倒他们，宁尘你来帮我“，',
      resolvedText: '我要干倒他们，宁尘你来帮我',
    });
  });

  it("should accept dialogue fragments when the actual quote starts after a malformed quoted attribution shell", () => {
    const result = validateSegmentScript({
      segmentContent:
        '“她顿了一下，又道：“小尘子，行功还没圆满，你指使神络正需要心念通达，下面那话儿，可别停了。',
      scriptSentences: [
        {
          sourceText:
            '“她顿了一下，又道：“小尘子，行功还没圆满，你指使神络正需要心念通达，下面那话儿，可别停了。',
          text: '小尘子，行功还没圆满，你指使神络正需要心念通达，下面那话儿，可别停了。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.lines[0]).toMatchObject({
      sourceText:
        '“她顿了一下，又道：“小尘子，行功还没圆满，你指使神络正需要心念通达，下面那话儿，可别停了。',
      resolvedText: '小尘子，行功还没圆满，你指使神络正需要心念通达，下面那话儿，可别停了。',
    });
  });

  it("should accept malformed quoted attribution shells that drop the first quote in text", () => {
    const result = validateSegmentScript({
      segmentContent:
        '“正是！”穆天香抬起头还没说话，就瞧见龙雅歌斜身后的宁尘。宁尘这些日子身量高了，修为上了凝心，又换了一副面孔，穆天香哪里识得出他，只道龙雅歌在身边新养了个小白脸。“宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。“穆天香点点头，从乾坤袖中翻出一封请柬：“请宗主阅之。“龙雅歌接过纸来，低头望去，不一会儿便皱起了眉头。',
      scriptSentences: [
        {
          sourceText:
            '“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。',
          text: '穆阁主，这些闲话日后再说，问你的还没答呢。',
          speaker: '龙雅歌',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['NON_WHITESPACE_GAP', 'LOW_COVERAGE'])
    );
    expect(
      resolveScriptLineText({
        sourceText:
          '“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。',
        speaker: '龙雅歌',
      })
    ).toBe('穆阁主，这些闲话日后再说，问你的还没答呢。');
  });

  it("should still reject malformed quoted shells with detached scene narration before the real quote", () => {
    const result = validateSegmentScript({
      segmentContent:
        '“红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。',
      scriptSentences: [
        {
          sourceText:
            '“红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。',
          text: '人多心乱，都撤了吧。',
          speaker: '红衣女子',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('TEXT_SOURCE_MISMATCH');
  });

  it("should allow quote-only gaps between normalized narration prefix and dialogue tail", () => {
    const result = validateSegmentScript({
      segmentContent: '“穆天香点点头，从乾坤袖中翻出一封请柬：“请宗主阅之。',
      scriptSentences: [
        {
          sourceText: '穆天香点点头，从乾坤袖中翻出一封请柬：',
          text: '穆天香点点头，从乾坤袖中翻出一封请柬：',
          speaker: '旁白',
        },
        {
          sourceText: '请宗主阅之。',
          text: '请宗主阅之。',
          speaker: '穆天香',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("should allow malformed boundary quote narration when the body is clearly scene action", () => {
    const result = validateSegmentScript({
      segmentContent: '“龙雅歌接过纸来，低头望去，不一会儿便皱起了眉头。',
      scriptSentences: [
        {
          sourceText: '“龙雅歌接过纸来，低头望去，不一会儿便皱起了眉头。',
          text: '“龙雅歌接过纸来，低头望去，不一会儿便皱起了眉头。',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("should reject narration on refined boundary quote fragments", () => {
    const leadingResult = validateSegmentScript({
      segmentContent: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
      scriptSentences: [
        {
          sourceText: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
          text: '“本宫昨夜闲来无事赏观星象，见那枚异星已入枢机双盘，不免想起师祖遗诏。',
          speaker: '旁白',
        },
      ],
    });

    const trailingResult = validateSegmentScript({
      segmentContent: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
      scriptSentences: [
        {
          sourceText: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
          text: '本宫继位已逾百年，自觉愧对师祖师尊，便多喝了两杯。”',
          speaker: '旁白',
        },
      ],
    });

    expect(leadingResult.valid).toBe(false);
    expect(leadingResult.issues.map((issue) => issue.code)).toContain(
      'QUOTED_NARRATION'
    );
    expect(trailingResult.valid).toBe(false);
    expect(trailingResult.issues.map((issue) => issue.code)).toContain(
      'QUOTED_NARRATION'
    );
  });

  it("should reject display-text spans that only keep the quoted body", () => {
    const result = validateSegmentScript({
      segmentContent: '广告牌上写着“营业中”。',
      scriptSentences: [
        {
          sourceText: '广告牌上写着“营业中”。',
          text: '营业中',
          speaker: '张三',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('TEXT_SOURCE_MISMATCH');
  });

  it("should still reject long scene narration that only keeps a trailing short quote body", () => {
    const result = validateSegmentScript({
      segmentContent:
        '殿中除了闵弘芳，便只有后殿屏风边站着的一名黑衣束装女子。那女子是近侍，日不多言夜不多语，回话的活儿自然要落到正掌殿闵弘芳一人身上。“宗主何事忧烦？”',
      scriptSentences: [
        {
          sourceText:
            '殿中除了闵弘芳，便只有后殿屏风边站着的一名黑衣束装女子。那女子是近侍，日不多言夜不多语，回话的活儿自然要落到正掌殿闵弘芳一人身上。“宗主何事忧烦？”',
          text: '宗主何事忧烦？',
          speaker: '闵弘芳',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('TEXT_SOURCE_MISMATCH');
  });

  it("should keep full source coverage when narration text is reformatted but sourceText is exact", () => {
    const result = validateSegmentScript({
      segmentContent: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
      scriptSentences: [
        {
          sourceText: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
          text: '（几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。）',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("should reject missing original content coverage", () => {
    const result = validateSegmentScript({
      segmentContent: '“你好。”他转身离开。',
      scriptSentences: [
        {
          sourceText: '“你好。”',
          text: '你好。',
          speaker: '张三',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['NON_WHITESPACE_GAP', 'LOW_COVERAGE'])
    );
  });

  it("should allow dropping obvious ad-noise tail gaps from manual edits", () => {
    const result = validateSegmentScript({
      segmentContent:
        "“哦，那辛苦你了。”\n\n“我的甜哥哥，和我客气啥哟？！”\n\n----------老司机必备的约炮平台，全网最大的约炮平台，最快两小时见面 下载（ k183.cc ）集－影视－直播－小说－漫画－同城交友－为一体纯原生ＡＰＰ===【k183点cc】",
      scriptSentences: [
        {
          sourceText: "“哦，那辛苦你了。”",
          text: "哦，那辛苦你了。",
          speaker: "小雄",
        },
        {
          sourceText: "“我的甜哥哥，和我客气啥哟？！”",
          text: "我的甜哥哥，和我客气啥哟？！",
          speaker: "关玮",
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it("should reject duplicated quote extraction", () => {
    const result = validateSegmentScript({
      segmentContent: '“你好。”',
      scriptSentences: [
        {
          sourceText: '“你好。”',
          text: '你好。',
          speaker: '张三',
        },
        {
          sourceText: '“你好。”',
          text: '你好。',
          speaker: '张三',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('SOURCE_NOT_FOUND');
  });

  it("should allow narrator title text wrapped by book-title marks", () => {
    const result = validateSegmentScript({
      segmentContent: '《三体》',
      scriptSentences: [
        {
          sourceText: '《三体》',
          text: '《三体》',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should allow quoted narrator emphasis that is not likely speech", () => {
    const result = validateSegmentScript({
      segmentContent: '“三体”',
      scriptSentences: [
        {
          sourceText: '“三体”',
          text: '“三体”',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should allow punctuated quoted narration when no speaker evidence exists", () => {
    const result = validateSegmentScript({
      segmentContent: '“紧急出口！”',
      scriptSentences: [
        {
          sourceText: '“紧急出口！”',
          text: '“紧急出口！”',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should accept narration text that only wraps sourceText with stage parentheses", () => {
    const result = validateSegmentScript({
      segmentContent: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
      scriptSentences: [
        {
          sourceText: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
          text: '（几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。）',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.coverageRatio).toBe(1);
    expect(result.issues).toHaveLength(0);
    expect(result.lines[0]).toMatchObject({
      sourceText: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
      resolvedText: '几息之后，看着侍女们整整齐齐归到了大殿两侧，闵弘芳这才开口。',
    });
  });

  it("should reject quoted narrator short replies without punctuation", () => {
    const result = validateSegmentScript({
      segmentContent: '“嗯”',
      scriptSentences: [
        {
          sourceText: '“嗯”',
          text: '“嗯”',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('QUOTED_NARRATION');
  });

  it("should reject punctuated quoted narrator short replies", () => {
    const result = validateSegmentScript({
      segmentContent: '“好的。”',
      scriptSentences: [
        {
          sourceText: '“好的。”',
          text: '“好的。”',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('QUOTED_NARRATION');
  });

  it("should reject narration that keeps attributed speech mixed with scene action", () => {
    const result = validateSegmentScript({
      segmentContent: '她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”',
      scriptSentences: [
        {
          sourceText: '她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”',
          text: '她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”',
          speaker: '旁白',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('QUOTED_NARRATION');
  });
});

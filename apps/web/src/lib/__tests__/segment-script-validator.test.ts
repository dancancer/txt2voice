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

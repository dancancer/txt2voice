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
});

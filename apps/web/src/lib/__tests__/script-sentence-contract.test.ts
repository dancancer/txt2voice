// 一旦我被更新，请更新我的开头注释
// input: 请求参数样本/被测契约函数
// output: 契约稳定性断言
// pos: 单元测试
import {
  buildScriptSentenceWhere,
  normalizeScriptUpdatePayload,
  parseScriptSentenceFilters,
} from "../script-sentence-contract";

describe("script sentence contract", () => {
  it("should parse canonical filters", () => {
    const params = new URLSearchParams({
      characterId: "c-1",
      segmentId: "s-1",
      chapterId: "ch-1",
      search: "hello",
      tone: "calm",
    });

    const filters = parseScriptSentenceFilters(params);
    const where = buildScriptSentenceWhere("book-1", filters);

    expect(filters).toEqual({
      characterId: "c-1",
      segmentId: "s-1",
      chapterId: "ch-1",
      search: "hello",
      tone: "calm",
    });

    expect(where).toMatchObject({
      bookId: "book-1",
      characterId: "c-1",
      segmentId: "s-1",
      chapterId: "ch-1",
      tone: "calm",
    });
  });

  it("should parse unassigned chapter filter", () => {
    const params = new URLSearchParams({
      chapterId: "unassigned",
    });

    const filters = parseScriptSentenceFilters(params);

    expect(filters.chapterId).toBeNull();
  });

  it("should normalize canonical update payload", () => {
    const updates = normalizeScriptUpdatePayload({
      scripts: [
        {
          id: "line-1",
          text: "新台词",
          tone: "happy",
          characterId: "char-1",
          strength: 80,
          pauseAfter: 1.2,
          orderInSegment: 3,
        },
      ],
    });

    expect(updates).toEqual([
      {
        id: "line-1",
        text: "新台词",
        tone: "happy",
        characterId: "char-1",
        rawSpeaker: undefined,
        strength: 80,
        pauseAfter: 1.2,
        ttsParameters: undefined,
        orderInSegment: 3,
      },
    ]);
  });

  it("should reject unknown update payload shape", () => {
    expect(() =>
      normalizeScriptUpdatePayload({
        items: [
          {
            id: "line-2",
            text: "无效结构",
          },
        ],
      })
    ).toThrow("请提供要更新的台本句子列表");
  });
});

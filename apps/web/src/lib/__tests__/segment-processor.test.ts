// 一旦我被更新，请更新我的开头注释
// input: 段落样本/LLM mock 返回
// output: 台本守门与映射断言
// pos: 单元测试
import { processSegment } from "../script-generator/pipeline/segment-processor";

const options = {
  includeNarration: true,
  emotionDetection: true,
  contextAnalysis: true,
  minDialogueLength: 5,
  maxDialogueLength: 200,
  preserveOriginalBreaks: true,
};

describe("segment processor", () => {
  it("should persist source-aligned text instead of rewritten llm text", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '“你好。”',
              text: '你好。',
              speaker: '张三',
              tone: '平静',
            },
            {
              id: "line-2",
              sourceText: '张三点点头。',
              text: '张三点点头。',
              speaker: '旁白',
              tone: '中性',
            },
          ],
          characters: [],
        })
      ),
    };

    const result = await processSegment({
      llmService,
      segment: {
        id: 'segment-1',
        chapterId: 'chapter-1',
        content: '“你好。”张三点点头。',
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
    });

    expect(result.dialogueLines).toHaveLength(2);
    expect(result.dialogueLines[0]).toMatchObject({
      text: '你好。',
      rawSpeaker: '张三',
      characterName: '张三',
    });
    expect(result.dialogueLines[0].ttsParameters).toMatchObject({
      sourceText: '“你好。”',
      sourceStart: 0,
      sourceEnd: 5,
    });
    expect(result.dialogueLines[1]).toMatchObject({
      text: '张三点点头。',
      rawSpeaker: '旁白',
      characterName: '旁白',
    });
  });

  it("should accept attributed dialogue spans and keep the full source trace", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '张三说：“你好。”',
              text: '你好。',
              speaker: '张三',
              tone: '平静',
            },
          ],
          characters: [],
        })
      ),
    };

    const result = await processSegment({
      llmService,
      segment: {
        id: 'segment-attr',
        chapterId: 'chapter-1',
        content: '张三说：“你好。”',
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
    });

    expect(result.dialogueLines).toHaveLength(1);
    expect(result.dialogueLines[0]).toMatchObject({
      text: '你好。',
      rawSpeaker: '张三',
      characterName: '张三',
    });
    expect(result.dialogueLines[0].ttsParameters).toMatchObject({
      sourceText: '张三说：“你好。”',
      sourceStart: 0,
      sourceEnd: 9,
    });
  });

  it("should tell the llm to keep only spoken text for attributed dialogue spans", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '张三说：“你好。”',
              text: '你好。',
              speaker: '张三',
              tone: '平静',
            },
          ],
          characters: [],
        })
      ),
    };

    await processSegment({
      llmService,
      segment: {
        id: 'segment-attr-prompt',
        chapterId: 'chapter-1',
        content: '张三说：“你好。”',
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
    });

    expect(llmService.callLLM).toHaveBeenCalledTimes(1);
    expect(llmService.callLLM.mock.calls[0][1]).toContain(
      '当 sourceText 含归属语或动作时，dialogue 的 text 只能保留真正说出口的对白正文'
    );
  });

  it("should accept interrupted attributed dialogue spans as one spoken line", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '"你好，"他说，"我是测试角色。"',
              text: '你好，我是测试角色。',
              speaker: '张三',
              tone: '平静',
            },
          ],
          characters: [],
        })
      ),
    };

    const result = await processSegment({
      llmService,
      segment: {
        id: 'segment-interrupted-dialogue',
        chapterId: 'chapter-1',
        content: '"你好，"他说，"我是测试角色。"',
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
    });

    expect(result.dialogueLines).toHaveLength(1);
    expect(result.dialogueLines[0]).toMatchObject({
      text: '你好，我是测试角色。',
      rawSpeaker: '张三',
      characterName: '张三',
    });
    expect(result.dialogueLines[0].ttsParameters).toMatchObject({
      sourceText: '"你好，"他说，"我是测试角色。"',
    });
  });

  it("should fail fast when llm rewrites the original text", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '“你好。”',
              text: '你好呀。',
              speaker: '张三',
              tone: '平静',
            },
          ],
          characters: [],
        })
      ),
    };

    await expect(
      processSegment({
        llmService,
        segment: {
          id: 'segment-2',
          chapterId: 'chapter-1',
          content: '“你好。”',
        },
        characterMap: new Map<string, string>(),
        characterProfiles: [],
        options,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('段落台本校验失败'),
      provider: 'script-validator',
    });
  });



  it("should reject display-text spans that only keep quoted content", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '广告牌上写着“营业中”。',
              text: '营业中',
              speaker: '张三',
              tone: '中性',
            },
          ],
          characters: [],
        })
      ),
    };

    await expect(
      processSegment({
        llmService,
        segment: {
          id: 'segment-display',
          chapterId: 'chapter-1',
          content: '广告牌上写着“营业中”。',
        },
        characterMap: new Map<string, string>(),
        characterProfiles: [],
        options,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('段落台本校验失败'),
      provider: 'script-validator',
    });
  });

  it("should use staged aliases for speaker canonicalization after a segment passes", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '“你好。”',
              text: '你好。',
              speaker: '阿幻',
              tone: '平静',
            },
          ],
          characters: [
            {
              name: '幻觉角色',
              aliases: ['阿幻'],
              description: '本段新识别角色',
              gender: 'unknown',
              age: null,
              personality: [],
              importance: 'minor',
              dialogueStyle: '自然',
            },
          ],
        })
      ),
    };
    const characterMap = new Map<string, string>();

    const result = await processSegment({
      llmService,
      segment: {
        id: 'segment-staged-character',
        chapterId: 'chapter-1',
        content: '“你好。”',
      },
      characterMap,
      characterProfiles: [],
      options,
    });

    expect(result.dialogueLines).toHaveLength(1);
    expect(result.dialogueLines[0]).toMatchObject({
      rawSpeaker: '阿幻',
      characterName: '幻觉角色',
      text: '你好。',
    });
    expect(characterMap.get('幻觉角色')).toBe('幻觉角色');
    expect(characterMap.get('阿幻')).toBe('幻觉角色');
  });

  it("should not leak staged character aliases when the segment is rejected", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '“你好。”',
              text: '你好呀。',
              speaker: '阿幻',
              tone: '平静',
            },
          ],
          characters: [
            {
              name: '幻觉角色',
              aliases: ['阿幻'],
              description: '失败段落里幻觉出来的角色',
              gender: 'unknown',
              age: null,
              personality: [],
              importance: 'minor',
              dialogueStyle: '自然',
            },
          ],
        })
      ),
    };
    const characterMap = new Map<string, string>();

    await expect(
      processSegment({
        llmService,
        segment: {
          id: 'segment-rejected-character',
          chapterId: 'chapter-1',
          content: '“你好。”',
        },
        characterMap,
        characterProfiles: [],
        options,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('段落台本校验失败'),
      provider: 'script-validator',
    });

    expect(characterMap.has('幻觉角色')).toBe(false);
    expect(characterMap.has('阿幻')).toBe(false);
  });

  it("should preserve caller max dialogue length as a hard cap", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText: '“这是一句明显过长的对白内容。”',
              text: '这是一句明显过长的对白内容。',
              speaker: '张三',
              tone: '平静',
            },
          ],
          characters: [],
        })
      ),
    };

    await expect(
      processSegment({
        llmService,
        segment: {
          id: 'segment-long',
          chapterId: 'chapter-1',
          content: '“这是一句明显过长的对白内容。”',
        },
        characterMap: new Map<string, string>(),
        characterProfiles: [],
        options: {
          ...options,
          maxDialogueLength: 8,
        },
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('存在超长台词'),
      provider: 'script-validator',
    });
  });
});

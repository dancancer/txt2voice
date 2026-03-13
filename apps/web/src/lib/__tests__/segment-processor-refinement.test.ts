// 一旦我被更新，请更新我的开头注释
// input: 段落样本/LLM mock/落库 mock
// output: 失败段细分重跑断言
// pos: Phase 1 processor refinement 测试
jest.mock("@/lib/script-generator/storage/persistence", () => ({
  saveSegmentScriptToDatabase: jest.fn(),
}));

jest.mock("@/lib/script-generator/storage/character-utils", () => {
  const actual = jest.requireActual("@/lib/script-generator/storage/character-utils");
  return {
    ...actual,
    upsertCharacterCandidates: jest.fn(),
  };
});

import { processSegmentAndSave } from "../script-generator/pipeline/segment-processor";
import { saveSegmentScriptToDatabase } from "@/lib/script-generator/storage/persistence";
import { upsertCharacterCandidates } from "@/lib/script-generator/storage/character-utils";

const options = {
  includeNarration: true,
  emotionDetection: true,
  contextAnalysis: true,
  minDialogueLength: 1,
  maxDialogueLength: 200,
  preserveOriginalBreaks: true,
};

describe("segment processor refinement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should retry a failed mixed segment with refined subsegments and persist only once", async () => {
    const parentContent = '张三说：“你好。”闵弘芳皱起眉头：“属下近日听得风响。”';
    const llmService = {
      callLLM: jest
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({
            dialogues: [
              {
                id: "line-parent-1",
                sourceText: "你好。",
                text: "你好。",
                speaker: "张三",
                tone: "平静",
              },
              {
                id: "line-parent-2",
                sourceText: "属下近日听得风响。",
                text: "属下近日听得风响。",
                speaker: "闵弘芳",
                tone: "冷静",
              },
            ],
            characters: [],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            dialogues: [
              {
                id: "line-child-1",
                sourceText: "张三说：",
                text: "张三说：",
                speaker: "旁白",
                tone: "中性",
              },
            ],
            characters: [],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            dialogues: [
              {
                id: "line-child-2",
                sourceText: '“你好。”',
                text: "你好。",
                speaker: "张三",
                tone: "平静",
              },
            ],
            characters: [],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            dialogues: [
              {
                id: "line-child-3",
                sourceText: "闵弘芳皱起眉头：",
                text: "闵弘芳皱起眉头：",
                speaker: "旁白",
                tone: "中性",
              },
            ],
            characters: [],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            dialogues: [
              {
                id: "line-child-4",
                sourceText: '“属下近日听得风响。”',
                text: "属下近日听得风响。",
                speaker: "闵弘芳",
                tone: "冷静",
              },
            ],
            characters: [],
          })
        ),
    };

    const result = await processSegmentAndSave({
      llmService,
      segment: {
        id: "segment-refine-1",
        chapterId: "chapter-1",
        orderIndex: 0,
        content: parentContent,
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
      bookId: "book-1",
    });

    expect(llmService.callLLM).toHaveBeenCalledTimes(5);
    expect(result.dialogueLines).toHaveLength(4);
    expect(result.dialogueLines[0]).toMatchObject({
      segmentId: "segment-refine-1",
      text: "张三说：",
      rawSpeaker: "旁白",
      orderInSegment: 0,
    });
    expect(result.dialogueLines[1]).toMatchObject({
      segmentId: "segment-refine-1",
      text: "你好。",
      rawSpeaker: "张三",
      orderInSegment: 1,
    });
    expect(result.dialogueLines[2]).toMatchObject({
      segmentId: "segment-refine-1",
      text: "闵弘芳皱起眉头：",
      rawSpeaker: "旁白",
      orderInSegment: 2,
    });
    expect(result.dialogueLines[3]).toMatchObject({
      segmentId: "segment-refine-1",
      text: "属下近日听得风响。",
      rawSpeaker: "闵弘芳",
      orderInSegment: 3,
    });
    expect(result.dialogueLines[0].ttsParameters).toMatchObject({
      sourceText: "张三说：",
      sourceStart: 0,
    });
    expect(result.dialogueLines[1].ttsParameters).toMatchObject({
      sourceText: '“你好。”',
      sourceStart: 4,
    });
    expect(
      result.dialogueLines[2].ttsParameters?.sourceStart
    ).toBeGreaterThanOrEqual(result.dialogueLines[1].ttsParameters?.sourceEnd || 0);
    expect(
      result.dialogueLines[3].ttsParameters?.sourceStart
    ).toBeGreaterThanOrEqual(result.dialogueLines[2].ttsParameters?.sourceEnd || 0);

    expect(saveSegmentScriptToDatabase).toHaveBeenCalledTimes(1);
    expect(saveSegmentScriptToDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        segmentId: "segment-refine-1",
        dialogueLines: expect.arrayContaining([
          expect.objectContaining({
            text: "张三说：",
            segmentId: "segment-refine-1",
          }),
          expect.objectContaining({ text: "你好。", segmentId: "segment-refine-1" }),
          expect.objectContaining({
            text: "闵弘芳皱起眉头：",
            segmentId: "segment-refine-1",
          }),
          expect.objectContaining({
            text: "属下近日听得风响。",
            segmentId: "segment-refine-1",
          }),
        ]),
      })
    );
    expect(upsertCharacterCandidates).not.toHaveBeenCalled();
  });
});

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import {
  mapSegmentScriptDraftToDialogueLines,
  saveScriptToDatabase,
} from "@/lib/agent-runtime/runtime/script-production/storage/persistence";

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
};

describe("narration persistence", () => {
  it("should carry tone and prosody metadata from draft lines into dialogue lines", () => {
    const dialogueLines = mapSegmentScriptDraftToDialogueLines({
      segmentScriptDraft: {
        segmentId: "segment-1",
        lines: [
          {
            id: "line-1",
            sourceText: "“别怕。”",
            text: "别怕。",
            speaker: "燕赤霞",
            orderInSegment: 0,
            tone: "沉稳",
            prosody: {
              pace: 0.91,
              pitch: -0.1,
              energy: 0.42,
              pauseMsAfter: 1000,
            },
            strength: 52,
            pauseAfter: 1,
          },
        ],
      },
      chapterId: "chapter-1",
    });

    expect(dialogueLines).toEqual([
      {
        id: "line-1",
        segmentId: "segment-1",
        chapterId: "chapter-1",
        characterName: "燕赤霞",
        rawSpeaker: "燕赤霞",
        text: "别怕。",
        orderInSegment: 0,
        isNarration: false,
        tone: "沉稳",
        prosody: {
          pace: 0.91,
          pitch: -0.1,
          energy: 0.42,
          pauseMsAfter: 1000,
        },
        strength: 52,
        pauseAfter: 1,
      },
    ]);
  });

  it("should persist narration lines with a real narration character id", async () => {
    const tx = {
      scriptSentence: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      characterProfile: {
        upsert: jest.fn().mockResolvedValue({
          id: "narration-1",
          canonicalName: "旁白",
          isSystemRole: true,
          systemRoleType: "narration",
        }),
        findFirst: jest.fn().mockResolvedValueOnce({
          id: "dialogue-1",
          canonicalName: "闵弘芳",
        }),
      },
      book: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx)
    );

    await saveScriptToDatabase("book-1", {
      dialogueLines: [
        {
          id: "line-1",
          characterName: "旁白",
          rawSpeaker: "旁白",
          text: "殿门缓缓打开。",
          tone: "平静",
          orderInSegment: 0,
          segmentId: "segment-1",
          chapterId: "chapter-1",
          isNarration: true,
        },
        {
          id: "line-2",
          characterName: "闵弘芳",
          rawSpeaker: "闵弘芳",
          text: "请宗主用膳。",
          tone: "恭敬",
          orderInSegment: 1,
          segmentId: "segment-1",
          chapterId: "chapter-1",
        },
      ],
      summary: {
        totalLines: 2,
        dialogueCount: 1,
        narrationCount: 1,
        totalSegments: 1,
        processedSegments: 1,
        failedSegments: 0,
        failedSegmentIds: [],
        characterDistribution: {},
        emotionDistribution: {},
      },
      segments: [{ segmentId: "segment-1", lineCount: 2, characters: ["旁白", "闵弘芳"] }],
    });

    expect(tx.characterProfile.upsert).toHaveBeenCalledTimes(1);
    expect(tx.scriptSentence.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: "narration-1",
          rawSpeaker: "旁白",
          roleType: "narration",
        }),
      })
    );
    expect(tx.scriptSentence.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: "dialogue-1",
          rawSpeaker: "闵弘芳",
          roleType: "dialogue",
        }),
      })
    );
  });
});

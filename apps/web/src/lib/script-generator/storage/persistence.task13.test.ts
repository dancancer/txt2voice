jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { saveSegmentScriptToDatabase } from "./persistence";

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
};

describe("saveSegmentScriptToDatabase task13", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not create CharacterProfile while persisting segment draft lines", async () => {
    const tx = {
      scriptSentence: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      characterProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "narration-1",
            canonicalName: "旁白",
            aliases: [],
          },
          {
            id: "char-ning",
            canonicalName: "宁采臣",
            aliases: [{ alias: "宁书生" }],
          },
        ]),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx)
    );

    await saveSegmentScriptToDatabase({
      bookId: "book-1",
      segmentId: "segment-1",
      dialogueLines: [
        {
          id: "line-1",
          segmentId: "segment-1",
          chapterId: "chapter-1",
          characterName: "旁白",
          rawSpeaker: "旁白",
          text: "夜雨落檐。",
          orderInSegment: 0,
          isNarration: true,
        },
        {
          id: "line-2",
          segmentId: "segment-1",
          chapterId: "chapter-1",
          characterName: "宁书生",
          rawSpeaker: "宁书生",
          text: "在下见过姑娘。",
          orderInSegment: 1,
        },
      ],
      characterProfiles: [],
      characterMap: new Map<string, string>(),
    });

    expect(tx.characterProfile.findMany).toHaveBeenCalledTimes(1);
    expect(tx.characterProfile.upsert).not.toHaveBeenCalled();
    expect(tx.characterProfile.create).not.toHaveBeenCalled();
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
          characterId: "char-ning",
          rawSpeaker: "宁书生",
          roleType: "dialogue",
        }),
      })
    );
  });
});

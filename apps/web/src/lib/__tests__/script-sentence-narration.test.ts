jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
    },
    textSegment: {
      findFirst: jest.fn(),
    },
    characterProfile: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    scriptSentence: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  createBookScriptSentence,
  updateBookScriptSentences,
} from "@/lib/script-sentence-service";

const mockPrisma = prisma as unknown as {
  book: { findUnique: jest.Mock };
  textSegment: { findFirst: jest.Mock };
  characterProfile: {
    upsert: jest.Mock;
    findFirst: jest.Mock;
  };
  scriptSentence: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe("script sentence narration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.book.findUnique.mockResolvedValue({ id: "book-1" });
    mockPrisma.textSegment.findFirst.mockResolvedValue({
      id: "segment-1",
      chapterId: "chapter-1",
    });
    mockPrisma.scriptSentence.findFirst.mockResolvedValue({ orderInSegment: 0 });
    mockPrisma.characterProfile.upsert.mockResolvedValue({
      id: "narration-1",
      canonicalName: "旁白",
      isSystemRole: true,
      systemRoleType: "narration",
    });
  });

  it("should create narration sentence with narration character id", async () => {
    mockPrisma.scriptSentence.create.mockResolvedValue({
      id: "line-1",
      bookId: "book-1",
      segmentId: "segment-1",
      chapterId: "chapter-1",
      characterId: "narration-1",
      rawSpeaker: "旁白",
      text: "风从殿门吹入。",
      orderInSegment: 1,
      roleType: "narration",
      tone: "平静",
      audioFiles: [],
      chapter: null,
      segment: null,
      character: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createBookScriptSentence("book-1", {
      segmentId: "segment-1",
      text: "风从殿门吹入。",
      roleType: "narration",
      rawSpeaker: "旁白",
    });

    expect(mockPrisma.characterProfile.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.scriptSentence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: "narration-1",
          rawSpeaker: "旁白",
          roleType: "narration",
        }),
      })
    );
  });

  it("should normalize narration updates onto narration character", async () => {
    mockPrisma.scriptSentence.findMany.mockResolvedValue([{ id: "line-1" }]);
    mockPrisma.scriptSentence.update.mockResolvedValue({
      id: "line-1",
      bookId: "book-1",
      segmentId: "segment-1",
      chapterId: "chapter-1",
      characterId: "narration-1",
      rawSpeaker: "旁白",
      text: "夜色沉沉。",
      orderInSegment: 1,
      roleType: "narration",
      tone: "平静",
      audioFiles: [],
      chapter: null,
      segment: null,
      character: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await updateBookScriptSentences("book-1", {
      scripts: [
        {
          id: "line-1",
          text: "夜色沉沉。",
          roleType: "narration",
          rawSpeaker: "旁白",
          characterId: null,
        },
      ],
    });

    expect(mockPrisma.characterProfile.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.scriptSentence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterId: "narration-1",
          rawSpeaker: "旁白",
          roleType: "narration",
        }),
      })
    );
  });
});

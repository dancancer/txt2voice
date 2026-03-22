jest.mock("../llm-service", () => ({
  getLLMService: () => ({
    callLLM: jest.fn(),
  }),
}));

jest.mock("../prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    characterProfile: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    scriptSentence: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import prisma from "../prisma";
import { ScriptGenerator } from "../script-generator";

const mockPrisma = prisma as any;

describe("script-generator parallel inference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.book.findUnique.mockResolvedValue({
      id: "book-1",
      textSegments: [
        {
          id: "segment-1",
          content: "第一段",
          orderIndex: 0,
          chapterId: null,
        },
        {
          id: "segment-2",
          content: "第二段",
          orderIndex: 1,
          chapterId: null,
        },
      ],
      characterProfiles: [],
    });
  });

  it("should persist segment results in source order even when inference resolves out of order", async () => {
    const scriptGenerator = new ScriptGenerator();
    const persistOrder: string[] = [];
    const resolvers = new Map<string, (value: any) => void>();

    const inferSpy = jest
      .spyOn<any, any>(scriptGenerator as any, "inferSegment")
      .mockImplementation(async (segment: any) => {
        return await new Promise((resolve) => {
          resolvers.set(segment.id, resolve);
        });
      });

    const persistSpy = jest
      .spyOn<any, any>(scriptGenerator as any, "persistSegmentResult")
      .mockImplementation(async (segment: any) => {
        persistOrder.push(segment.id);
      });

    const generationPromise = scriptGenerator.generateScript("book-1");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(inferSpy).toHaveBeenCalledTimes(2);
    expect(persistSpy).not.toHaveBeenCalled();

    resolvers.get("segment-2")?.({
      dialogueLines: [
        {
          id: "line-2",
          text: "第二段台词",
          orderInSegment: 0,
          segmentId: "segment-2",
          chapterId: null,
          tone: "中性",
          isNarration: true,
        },
      ],
      characterCandidates: [],
    });
    await Promise.resolve();

    expect(persistSpy).not.toHaveBeenCalled();

    resolvers.get("segment-1")?.({
      dialogueLines: [
        {
          id: "line-1",
          text: "第一段台词",
          orderInSegment: 0,
          segmentId: "segment-1",
          chapterId: null,
          tone: "中性",
          isNarration: true,
        },
      ],
      characterCandidates: [],
    });

    await generationPromise;

    expect(persistOrder).toEqual(["segment-1", "segment-2"]);
  });
});

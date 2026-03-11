// 一旦我被更新，请更新我的开头注释
// input: workflow 依赖 mock/段落处理函数
// output: 失败明细汇总断言
// pos: 台本 workflow 测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { TTSError } from "@/lib/error-handler";
import { generateScriptByBook } from "@/lib/script-generator/pipeline/workflow";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;

const buildBook = () => ({
  id: "book-1",
  textSegments: [
    {
      id: "seg-1",
      chapterId: "chapter-1",
      orderIndex: 0,
      content: "第一段原文",
    },
    {
      id: "seg-2",
      chapterId: "chapter-1",
      orderIndex: 1,
      content: "第二段原文，有校验问题",
    },
  ],
  characterProfiles: [],
});

describe("script-workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue(buildBook());
  });

  it("should carry structured segment failure details from TTSError", async () => {
    const processSegmentAndSave = jest.fn(async ({ segment }: any) => {
      if (segment.id === "seg-2") {
        const error = new TTSError(
          "段落台本校验失败：原文覆盖率过低",
          "TTS_SERVICE_DOWN",
          "script-validator"
        );
        error.details = {
          stage: "script_validation",
          errorCode: "SCRIPT_VALIDATION_FAILED",
          coverageRatio: 0.81,
          issueCodes: ["LOW_COVERAGE"],
          issueMessages: ["原文覆盖率过低"],
          issuePreviews: ["第二段原文"],
          retryable: false,
        };
        throw error;
      }

      return {
        dialogueLines: [
          {
            id: "line-1",
            segmentId: "seg-1",
            chapterId: "chapter-1",
            orderInSegment: 0,
            text: "第一段原文",
            isNarration: true,
            characterName: "旁白",
          },
        ],
        characterCandidates: [],
      };
    });

    const result = await generateScriptByBook({
      bookId: "book-1",
      options: {
        includeNarration: true,
        emotionDetection: true,
        contextAnalysis: true,
        minDialogueLength: 1,
        maxDialogueLength: 180,
        preserveOriginalBreaks: true,
      },
      processSegmentAndSave,
    });

    expect(result.summary.failedSegments).toBe(1);
    expect(result.summary.failedSegmentIds).toEqual(["seg-2"]);
    expect(result.summary.failedSegmentDetails).toHaveLength(1);
    expect(result.summary.failedSegmentDetails?.[0]).toMatchObject({
      segmentId: "seg-2",
      chapterId: "chapter-1",
      stage: "script_validation",
      errorCode: "SCRIPT_VALIDATION_FAILED",
      provider: "script-validator",
      coverageRatio: 0.81,
      issueCodes: ["LOW_COVERAGE"],
    });
  });

  it("should fallback to unknown failure detail for generic error", async () => {
    const processSegmentAndSave = jest.fn(async ({ segment }: any) => {
      if (segment.id === "seg-2") {
        throw new Error("mock crash");
      }

      return {
        dialogueLines: [
          {
            id: "line-1",
            segmentId: "seg-1",
            chapterId: "chapter-1",
            orderInSegment: 0,
            text: "第一段原文",
            isNarration: true,
            characterName: "旁白",
          },
        ],
        characterCandidates: [],
      };
    });

    const result = await generateScriptByBook({
      bookId: "book-1",
      options: {
        includeNarration: true,
        emotionDetection: true,
        contextAnalysis: true,
        minDialogueLength: 1,
        maxDialogueLength: 180,
        preserveOriginalBreaks: true,
      },
      processSegmentAndSave,
    });

    expect(result.summary.failedSegments).toBe(1);
    expect(result.summary.failedSegmentDetails?.[0]).toMatchObject({
      segmentId: "seg-2",
      stage: "unknown",
      errorCode: "UNKNOWN_ERROR",
      message: "mock crash",
      issueMessages: ["mock crash"],
    });
  });

  it("should return failure summary when every segment fails", async () => {
    const processSegmentAndSave = jest.fn(async ({ segment }: any) => {
      const error = new TTSError(
        `段落 ${segment.id} 台本校验失败`,
        "TTS_SERVICE_DOWN",
        "script-validator"
      );
      error.details = {
        stage: "script_validation",
        errorCode: "SCRIPT_VALIDATION_FAILED",
        coverageRatio: 0.72,
        issueCodes: ["LOW_COVERAGE"],
        issueMessages: [`${segment.id} 覆盖率不足`],
        issuePreviews: [segment.content.slice(0, 20)],
        retryable: false,
      };
      throw error;
    });

    const result = await generateScriptByBook({
      bookId: "book-1",
      options: {
        includeNarration: true,
        emotionDetection: true,
        contextAnalysis: true,
        minDialogueLength: 1,
        maxDialogueLength: 180,
        preserveOriginalBreaks: true,
      },
      processSegmentAndSave,
    });

    expect(result.dialogueLines).toEqual([]);
    expect(result.segments).toEqual([]);
    expect(result.summary).toMatchObject({
      totalLines: 0,
      totalSegments: 2,
      processedSegments: 0,
      failedSegments: 2,
      failedSegmentIds: ["seg-1", "seg-2"],
    });
    expect(result.summary.failedSegmentDetails).toHaveLength(2);
    expect(result.summary.failedSegmentDetails?.[0]).toMatchObject({
      segmentId: "seg-1",
      errorCode: "SCRIPT_VALIDATION_FAILED",
    });
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 复核查询参数/服务依赖 mock
// output: Script Validation 子类型查询断言
// pos: 人工复核脚本子类型测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    manualReviewItem: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue", () => ({
  enqueueAudioGenerationJob: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { listScriptValidationSubtypesByRecommendedAction } from "@/lib/script-validation-detail";
import {
  listManualReviewItems,
  parseManualReviewQuery,
} from "@/lib/manual-review-service";

const mockCount = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindMany = (prisma as any).manualReviewItem.findMany as jest.Mock;

const baseItem = () => ({
  id: "review-script-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  segmentId: "segment-2",
  sentenceId: null,
  audioFileId: null,
  issueType: "SCRIPT_VALIDATION",
  priority: "high",
  status: "pending",
  issueDetail: {
    scriptSubtype: "COVERAGE",
    issueCodes: ["LOW_COVERAGE"],
    issueMessages: ["原文覆盖率过低"],
  },
  assignedTo: null,
  resolutionType: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: new Date("2026-03-10T10:00:00.000Z"),
  updatedAt: new Date("2026-03-10T10:00:00.000Z"),
  scriptSentence: null,
  audioFile: null,
  qualityCheckResult: null,
});

describe("manual-review-script-subtype", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse scriptSubtype from query string", () => {
    const query = parseManualReviewQuery(
      new URLSearchParams("issueType=SCRIPT_VALIDATION&scriptSubtype=COVERAGE")
    );

    expect(query).toMatchObject({
      issueType: "SCRIPT_VALIDATION",
      scriptSubtype: "COVERAGE",
    });
  });

  it("should parse recommendedAction from query string", () => {
    const query = parseManualReviewQuery(
      new URLSearchParams(
        "issueType=SCRIPT_VALIDATION&recommendedAction=regenerate"
      )
    );

    expect(query).toMatchObject({
      issueType: "SCRIPT_VALIDATION",
      recommendedAction: "regenerate",
    });
  });

  it("should filter script validation items by issueDetail.scriptSubtype", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([baseItem()]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
      issueType: "SCRIPT_VALIDATION",
      scriptSubtype: "COVERAGE",
    } as any);

    expect(mockCount).toHaveBeenNthCalledWith(1, {
      where: {
        bookId: "book-1",
        status: "pending",
        issueType: "SCRIPT_VALIDATION",
        AND: [
          {
            issueDetail: {
              path: ["scriptSubtype"],
              equals: "COVERAGE",
            },
          },
        ],
      },
    });
    expect(result.data[0]).toMatchObject({
      issueType: "SCRIPT_VALIDATION",
      issueSubtype: "COVERAGE",
    });
  });

  it("should filter script validation items by recommendedAction", async () => {
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockFindMany.mockResolvedValueOnce([baseItem()]);

    const result = await listManualReviewItems("book-1", {
      page: 1,
      limit: 20,
      offset: 0,
      status: "pending",
      issueType: "SCRIPT_VALIDATION",
      recommendedAction: "regenerate",
    } as any);

    expect(mockCount).toHaveBeenNthCalledWith(1, {
      where: {
        bookId: "book-1",
        status: "pending",
        issueType: "SCRIPT_VALIDATION",
        AND: [
          {
            OR: listScriptValidationSubtypesByRecommendedAction("regenerate").map(
              (subtype) => ({
                issueDetail: {
                  path: ["scriptSubtype"],
                  equals: subtype,
                },
              })
            ),
          },
        ],
      },
    });
    expect(result.data[0]).toMatchObject({
      issueType: "SCRIPT_VALIDATION",
      issueSubtype: "COVERAGE",
      recommendedAction: "regenerate",
    });
  });
});

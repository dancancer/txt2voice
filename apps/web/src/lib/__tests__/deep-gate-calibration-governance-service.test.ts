// 一旦我被更新，请更新我的开头注释
// input: 阈值治理服务依赖 mock
// output: 评估/发布/回滚流程断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    qualityCheckResult: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  evaluateDeepGateCalibrationForBook,
  parseEvaluateDeepGateCalibrationPayload,
  parsePublishDeepGateCalibrationPayload,
  parseRollbackDeepGateCalibrationPayload,
  publishDeepGateCalibrationForBook,
  rollbackDeepGateCalibrationForBook,
} from "@/lib/deep-gate-calibration-governance-service";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockFindQualityResults = (prisma as any).qualityCheckResult.findMany as jest.Mock;

const baseBookRecord = {
  id: "book-1",
  metadata: {
    qualityCheck: {
      deepGateThresholdTemplate: {
        q4PassScore: 74,
        q4ManualReviewScore: 58,
        q5PassScore: 74,
        q5ManualReviewScore: 60,
        chapterPassScore: 85,
        chapterRepairScore: 72,
        hardFailScore: 35,
        falsePositiveDelta: 16,
      },
      deepGateCalibration: {
        recommendation: {
          q4PassScore: 76,
          q4ManualReviewScore: 60,
          q5PassScore: 75,
          q5ManualReviewScore: 61,
        },
      },
      deepGateThresholdGovernance: {
        reports: [],
        releases: [],
        activeVersion: 0,
        activeReleaseId: null,
      },
    },
  },
};

describe("deep-gate-calibration-governance-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateBook.mockResolvedValue({});
    mockFindQualityResults.mockResolvedValue([]);
  });

  it("should parse evaluate payload and reject invalid sampleLimit", () => {
    expect(() =>
      parseEvaluateDeepGateCalibrationPayload({
        sampleLimit: 1,
      })
    ).toThrow(ValidationError);
  });

  it("should evaluate calibration report with inline samples", async () => {
    mockFindBook.mockResolvedValueOnce(baseBookRecord);

    const payload = parseEvaluateDeepGateCalibrationPayload({
      createdBy: "ops",
      samples: [
        {
          q4Score: 90,
          q5Score: 91,
          expectedVerdict: "pass",
          issueType: "EMOTION",
          source: "manual_review",
        },
        {
          q4Score: 61,
          q5Score: 63,
          expectedVerdict: "repair",
          issueType: "CONTINUITY",
          source: "manual_review",
        },
        {
          q4Score: 44,
          q5Score: 43,
          expectedVerdict: "manual_review",
          issueType: "EMOTION",
          source: "qc_retry",
          fallbackUsed: true,
        },
      ],
    });

    const result = await evaluateDeepGateCalibrationForBook({
      bookId: "book-1",
      payload,
    });

    expect(result.report.sampleSize).toBe(3);
    expect(result.report.candidateSummary?.sampleSize).toBe(3);
    expect(result.report.comparison).toEqual(
      expect.objectContaining({
        exactMatchRateDelta: expect.any(Number),
        falsePositiveRateDelta: expect.any(Number),
      })
    );
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: {
        id: "book-1",
      },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            deepGateThresholdGovernance: expect.objectContaining({
              reports: expect.arrayContaining([
                expect.objectContaining({
                  id: result.report.id,
                  sampleSize: 3,
                }),
              ]),
            }),
          }),
        }),
      },
    });
    expect(mockFindQualityResults).not.toHaveBeenCalled();
  });

  it("should publish report as new active threshold version", async () => {
    mockFindBook.mockResolvedValueOnce({
      ...baseBookRecord,
      metadata: {
        qualityCheck: {
          ...baseBookRecord.metadata.qualityCheck,
          deepGateThresholdGovernance: {
            reports: [
              {
                id: "report-1",
                status: "evaluated",
                createdAt: "2026-03-06T03:10:00.000Z",
                sampleSize: 36,
                baselineTemplate: baseBookRecord.metadata.qualityCheck.deepGateThresholdTemplate,
                candidateTemplate: {
                  ...baseBookRecord.metadata.qualityCheck.deepGateThresholdTemplate,
                  q4PassScore: 77,
                  q5PassScore: 76,
                },
                baselineSummary: {},
                candidateSummary: {},
                comparison: {},
                publishedVersion: null,
              },
            ],
            releases: [],
            activeVersion: 0,
            activeReleaseId: null,
          },
        },
      },
    });

    const payload = parsePublishDeepGateCalibrationPayload({
      reportId: "report-1",
      reviewedBy: "qa-lead",
      publishedBy: "ops",
      changeNote: "promote v1",
      expectedVersion: 0,
    });

    const result = await publishDeepGateCalibrationForBook({
      bookId: "book-1",
      payload,
    });

    expect(result.release.version).toBe(1);
    expect(result.release.changeType).toBe("publish");
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: {
        id: "book-1",
      },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            deepGateThresholdTemplate: expect.objectContaining({
              q4PassScore: 77,
              q5PassScore: 76,
            }),
            deepGateThresholdGovernance: expect.objectContaining({
              activeVersion: 1,
            }),
          }),
        }),
      },
    });
  });

  it("should rollback to target threshold version", async () => {
    mockFindBook.mockResolvedValueOnce({
      ...baseBookRecord,
      metadata: {
        qualityCheck: {
          ...baseBookRecord.metadata.qualityCheck,
          deepGateThresholdGovernance: {
            reports: [],
            releases: [
              {
                id: "release-2",
                version: 2,
                status: "active",
                changeType: "publish",
                reportId: "report-2",
                template: {
                  ...baseBookRecord.metadata.qualityCheck.deepGateThresholdTemplate,
                  q4PassScore: 79,
                },
                createdAt: "2026-03-06T05:20:00.000Z",
              },
              {
                id: "release-1",
                version: 1,
                status: "superseded",
                changeType: "publish",
                reportId: "report-1",
                template: {
                  ...baseBookRecord.metadata.qualityCheck.deepGateThresholdTemplate,
                  q4PassScore: 76,
                },
                createdAt: "2026-03-06T04:20:00.000Z",
              },
            ],
            activeVersion: 2,
            activeReleaseId: "release-2",
          },
        },
      },
    });

    const payload = parseRollbackDeepGateCalibrationPayload({
      targetVersion: 1,
      reviewedBy: "qa-lead",
      rolledBackBy: "ops",
      expectedVersion: 2,
    });

    const result = await rollbackDeepGateCalibrationForBook({
      bookId: "book-1",
      payload,
    });

    expect(result.release.version).toBe(3);
    expect(result.release.changeType).toBe("rollback");
    expect(result.rollbackTargetVersion).toBe(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: {
        id: "book-1",
      },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            deepGateThresholdTemplate: expect.objectContaining({
              q4PassScore: 76,
            }),
            deepGateThresholdGovernance: expect.objectContaining({
              activeVersion: 3,
            }),
          }),
        }),
      },
    });
  });
});

// 一旦我被更新，请更新我的开头注释
// input: worker 失败场景/依赖 mock
// output: calibration_eval 失败隔离断言
// pos: 任务队列状态测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
}));

import prisma from "@/lib/prisma";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { markTaskFailed } from "@/lib/task-queue/worker-state";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

describe("task-queue worker-state calibration_eval isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
    mockUpdateTask.mockResolvedValue({});
    mockUpdateBook.mockResolvedValue({});
  });

  it("should mark replayTaskStatus failed without downgrading book status", async () => {
    mockFindTask.mockResolvedValueOnce({
      taskData: {
        metadata: {
          source: "calibration_eval",
          calibrationEval: {
            reportId: "report-1",
          },
        },
      },
    });
    mockFindBook.mockResolvedValueOnce({
      metadata: {
        qualityCheck: {
          deepGateThresholdGovernance: {
            reports: [
              {
                id: "report-1",
                status: "evaluated",
                createdAt: "2026-03-07T10:00:00.000Z",
                sampleSize: 1,
                baselineTemplate: {},
                candidateTemplate: {},
                baselineSummary: {},
                candidateSummary: {},
                comparison: {},
                publishedVersion: null,
                sampleSetId: "sample-set-1",
                replayTaskId: "qc-old",
                replayTaskStatus: "queued",
              },
            ],
            releases: [],
            sampleSets: [
              {
                id: "sample-set-1",
                createdAt: "2026-03-07T10:00:00.000Z",
                createdBy: "ops",
                sampleLimit: 20,
                sampleSize: 1,
                source: "quality_results_snapshot",
                audioFileIds: ["audio-1"],
                qualityResultIds: ["qc-history-1"],
                samples: [],
                latestReplayTaskId: "qc-old",
              },
            ],
            activeVersion: 0,
            activeReleaseId: null,
            lastEvaluatedReportId: "report-1",
          },
        },
      },
    });

    await markTaskFailed(
      "qc-task-1",
      "book-1",
      "completed_with_errors",
      "mock failure",
      {
        source: "calibration_eval",
      }
    );

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "qc-task-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "mock failure",
      }),
    });
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            deepGateThresholdGovernance: expect.objectContaining({
              reports: expect.arrayContaining([
                expect.objectContaining({
                  id: "report-1",
                  replayTaskId: "qc-task-1",
                  replayTaskStatus: "failed",
                }),
              ]),
            }),
          }),
        }),
      },
    });
    expect(mockUpdateBook).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed_with_errors",
        }),
      })
    );
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 复核同步任务参数/依赖 mock
// output: 状态归集与交付触发断言
// pos: S31 复核同步执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    manualReviewItem: {
      count: jest.fn(),
    },
    processingTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue/ops/auto-pipeline-enqueue", () => ({
  enqueueAutoPipelineJobInternal: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  updateProcessingTaskProgress: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";
import { runManualReviewSyncTask } from "@/lib/manual-review-sync-runner";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockCountItems = (prisma as any).manualReviewItem.count as jest.Mock;
const mockFindProcessingTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockEnqueueWorkflow = enqueueAutoPipelineJobInternal as jest.MockedFunction<
  typeof enqueueAutoPipelineJobInternal
>;

describe("manual-review-sync-runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ metadata: {}, status: "manual_review_pending" });
    mockUpdateBook.mockResolvedValue({});
    mockFindProcessingTask.mockResolvedValue(null);
    mockCreateTask.mockResolvedValue({ id: "assembly-task-1" });
    mockUpdateTask.mockResolvedValue({});
    mockEnqueueWorkflow.mockResolvedValue({
      jobId: "assembly-task-1",
      dedupeKey: "auto_pipeline:book-1:hash",
      reused: false,
      state: "waiting",
    });
  });

  it("should sync counts and trigger final assembly when queue is clear", async () => {
    mockCountItems
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    await runManualReviewSyncTask({
      taskId: "review-sync-task-1",
      bookId: "book-1",
      autoTriggerFinalAssembly: true,
      finalAssemblyPayload: {
        type: "book",
        options: {
          format: "mp3",
        },
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "FINAL_ASSEMBLY",
      }),
    });
    expect(mockEnqueueWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "assembly-task-1",
        mode: "final_assembly",
        workflowPayload: expect.objectContaining({
          type: "book",
          options: { format: "mp3" },
        }),
      }),
      expect.objectContaining({
        reason: "manual_review_sync",
      })
    );
    expect(mockUpdateBook).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "assembling_audio",
        metadata: expect.objectContaining({
          manualReviewSync: expect.objectContaining({
            taskId: "review-sync-task-1",
            readyForAssembly: true,
            finalAssemblyTaskId: "assembly-task-1",
          }),
        }),
      }),
    });
  });

  it("should reuse existing final assembly task instead of creating a duplicate", async () => {
    mockCountItems
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    mockFindProcessingTask.mockResolvedValueOnce({ id: "assembly-task-existing" });

    await runManualReviewSyncTask({
      taskId: "review-sync-task-1",
      bookId: "book-1",
      autoTriggerFinalAssembly: true,
      finalAssemblyPayload: {
        type: "book",
      },
    });

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueWorkflow).not.toHaveBeenCalled();
    expect(mockUpdateBook).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "assembling_audio",
        metadata: expect.objectContaining({
          manualReviewSync: expect.objectContaining({
            finalAssemblyTaskId: "assembly-task-existing",
          }),
        }),
      }),
    });
  });
});

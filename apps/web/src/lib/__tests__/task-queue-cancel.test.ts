// 一旦我被更新，请更新我的开头注释
// input: 复核同步任务取消请求/依赖 mock
// output: 取消后的书籍状态兜底断言
// pos: 任务队列取消测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    workflowRun: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    stageRun: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    agentRun: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    toolCall: {
      updateMany: jest.fn(),
    },
    book: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-cancellation", () => ({
  CANCELED_TASK_STATUS: "canceled",
  markProcessingTaskCanceled: jest.fn(),
}));

jest.mock("@/lib/task-queue/core/runtime", () => ({
  cancelProcessingTaskJob: jest.fn(),
  getQueueJobState: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { markProcessingTaskCanceled } from "@/lib/task-cancellation";
import { cancelProcessingTaskJob } from "@/lib/task-queue/core/runtime";
import { cancelProcessingTask } from "@/lib/task-queue/ops/cancel";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockFindRelatedTasks = (prisma as any).processingTask.findMany as jest.Mock;
const mockFindWorkflowRuns = (prisma as any).workflowRun.findMany as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockCancelJob = cancelProcessingTaskJob as jest.MockedFunction<
  typeof cancelProcessingTaskJob
>;
const mockMarkCanceled = markProcessingTaskCanceled as jest.MockedFunction<
  typeof markProcessingTaskCanceled
>;

describe("cancelProcessingTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindWorkflowRuns.mockResolvedValue([]);
    mockFindRelatedTasks.mockResolvedValue([]);
    mockUpdateBook.mockResolvedValue({});
    mockMarkCanceled.mockResolvedValue(undefined as never);
    mockCancelJob.mockResolvedValue({
      exists: true,
      state: "active",
      canceled: false,
    });
  });

  it("keeps manual review sync cancellation fallback at audio_review_ready", async () => {
    mockFindTask.mockResolvedValue({
      id: "manual-review-sync-1",
      bookId: "book-1",
      taskType: "MANUAL_REVIEW_SYNC",
      status: "processing",
      taskData: {
        metadata: {
          source: "manual_review_sync",
        },
      },
    });

    const result = await cancelProcessingTask("manual-review-sync-1", {
      reason: "operator_cancel",
    });

    expect(result).toMatchObject({
      taskId: "manual-review-sync-1",
      taskType: "MANUAL_REVIEW_SYNC",
      status: "canceled",
    });
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        status: "audio_review_ready",
      },
    });
  });
});

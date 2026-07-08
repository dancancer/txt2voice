// 一旦我被更新，请更新我的开头注释
// input: 停滞任务/队列状态 mock
// output: 恢复失败时的书籍状态兜底断言
// pos: 任务队列恢复测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue/core/runtime", () => ({
  getQueueJobState: jest.fn(),
  queueState: {
    recovering: false,
    lastRecoveryAt: 0,
  },
}));

jest.mock("@/lib/task-queue/ops/replay", () => ({
  replayProcessingTask: jest.fn(),
}));

jest.mock("@/lib/task-queue/worker-state", () => ({
  markTaskFailed: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { getQueueJobState, queueState } from "@/lib/task-queue/core/runtime";
import { replayProcessingTask } from "@/lib/task-queue/ops/replay";
import { recoverStalledProcessingTasks } from "@/lib/task-queue/ops/recovery";
import { markTaskFailed } from "@/lib/task-queue/worker-state";

const mockFindTasks = (prisma as any).processingTask.findMany as jest.Mock;
const mockGetQueueJobState = getQueueJobState as jest.MockedFunction<
  typeof getQueueJobState
>;
const mockReplayProcessingTask = replayProcessingTask as jest.MockedFunction<
  typeof replayProcessingTask
>;
const mockMarkTaskFailed = markTaskFailed as jest.MockedFunction<typeof markTaskFailed>;

describe("recoverStalledProcessingTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueState.recovering = false;
    queueState.lastRecoveryAt = 0;
  });

  it("keeps manual review sync fallback at audio_review_ready", async () => {
    mockFindTasks.mockResolvedValue([
      {
        id: "manual-review-sync-1",
        bookId: "book-1",
        taskType: "MANUAL_REVIEW_SYNC",
        externalTaskId: "job-1",
      },
    ]);
    mockGetQueueJobState.mockResolvedValue({
      exists: false,
      state: null,
    });
    mockReplayProcessingTask.mockRejectedValue(new Error("missing payload"));

    const result = await recoverStalledProcessingTasks();

    expect(result).toMatchObject({
      status: "ok",
      scanned: 1,
      recovered: 0,
      failed: 1,
    });
    expect(mockMarkTaskFailed).toHaveBeenCalledWith(
      "manual-review-sync-1",
      "book-1",
      "audio_review_ready",
      "自动恢复失败：missing payload",
      expect.objectContaining({
        recoveryReason: "watchdog_recovery_failed",
        queueJobId: "job-1",
      })
    );
  });
});

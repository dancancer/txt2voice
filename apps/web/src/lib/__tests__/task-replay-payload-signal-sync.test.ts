// 一旦我被更新，请更新我的开头注释
// input: 信号生产任务模拟数据
// output: 重放载荷与 recoverable 断言
// pos: S30.1 队列辅助测试
import { extractPayloadFromTask, isRecoverableTask } from "@/lib/task-queue/replay-payload";

describe("signal sync replay payload", () => {
  it("should extract signal sync payload from queue metadata", () => {
    const payload = extractPayloadFromTask({
      id: "signal-task-1",
      bookId: "book-1",
      taskType: "QUALITY_SIGNAL_SYNC",
      status: "failed",
      progress: 0,
      totalItems: 3,
      processedItems: 0,
      taskData: {
        metadata: {
          queuePayload: {
            type: "batch",
            chapterId: null,
            audioFileIds: ["audio-1", "audio-2"],
            forceResync: true,
          },
        },
      },
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-03-07T13:00:00.000Z"),
      updatedAt: new Date("2026-03-07T13:05:00.000Z"),
      externalTaskId: null,
    } as any);

    expect(payload).toEqual({
      kind: "signal_sync",
      input: {
        taskId: "signal-task-1",
        bookId: "book-1",
        type: "batch",
        chapterId: undefined,
        audioFileIds: ["audio-1", "audio-2"],
        forceResync: true,
      },
    });
    expect(isRecoverableTask("QUALITY_SIGNAL_SYNC")).toBe(true);
  });
});

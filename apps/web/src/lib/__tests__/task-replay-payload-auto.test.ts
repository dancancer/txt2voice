// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 模拟数据
// output: 自动编排任务重放载荷断言
// pos: 队列辅助模块测试
import { extractPayloadFromTask, isRecoverableTask } from "@/lib/task-queue/replay-payload";

describe("auto pipeline replay payload", () => {
  const baseTask = {
    id: "task-auto-1",
    bookId: "book-1",
    taskType: "AUTO_PIPELINE",
    status: "failed",
    progress: 35,
    totalItems: 4,
    processedItems: 1,
    taskData: {},
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-03-05T08:00:00.000Z"),
    updatedAt: new Date("2026-03-05T08:30:00.000Z"),
    externalTaskId: null,
  };

  it("should extract auto pipeline payload from queue metadata", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          queuePayload: {
            options: {
              qualityCheck: {
                enabled: false,
              },
            },
          },
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "auto_pipeline",
      input: {
        taskId: "task-auto-1",
        bookId: "book-1",
        options: {
          qualityCheck: {
            enabled: false,
          },
        },
      },
    });
  });

  it("should fallback to metadata options payload when queue payload missing", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          options: {
            audioGeneration: {
              autoMerge: true,
            },
          },
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "auto_pipeline",
      input: {
        taskId: "task-auto-1",
        bookId: "book-1",
        options: {
          audioGeneration: {
            autoMerge: true,
          },
        },
      },
    });
  });

  it("should treat auto pipeline as recoverable task", () => {
    expect(isRecoverableTask("AUTO_PIPELINE")).toBe(true);
    expect(isRecoverableTask("UNKNOWN_TASK")).toBe(false);
  });
});

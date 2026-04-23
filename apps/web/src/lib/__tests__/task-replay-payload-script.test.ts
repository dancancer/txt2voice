// 一旦我被更新，请更新我的开头注释
// input: SCRIPT_GENERATION 任务模拟数据
// output: 台本任务重放与去重断言
// pos: 队列辅助模块测试
import { buildScriptDedupeKey } from "@/lib/task-queue/dedupe";
import { extractPayloadFromTask } from "@/lib/task-queue/replay-payload";

describe("script replay payload", () => {
  const baseTask = {
    id: "task-script-1",
    bookId: "book-1",
    taskType: "SCRIPT_GENERATION",
    status: "failed",
    progress: 20,
    totalItems: 3,
    processedItems: 1,
    taskData: {},
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-04-03T08:00:00.000Z"),
    updatedAt: new Date("2026-04-03T08:10:00.000Z"),
    externalTaskId: null,
  };

  it("should extract llmModelId from queued script payload", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          queuePayload: {
            options: {
              includeNarration: true,
              llmModelId: "qwen-local",
            },
            extraParams: {
              regenerateSegments: false,
            },
          },
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "script",
      input: {
        taskId: "task-script-1",
        bookId: "book-1",
        options: {
          includeNarration: true,
          llmModelId: "qwen-local",
        },
        extraParams: {
          regenerateSegments: false,
        },
      },
    });
  });

  it("should keep script dedupe keys distinct across llmModelId values", () => {
    const qwenKey = buildScriptDedupeKey({
      bookId: "book-1",
      options: {
        llmModelId: "qwen-local",
      },
      extraParams: {
        regenerateSegments: false,
      },
    } as any);
    const deepseekKey = buildScriptDedupeKey({
      bookId: "book-1",
      options: {
        llmModelId: "deepseek-cloud",
      },
      extraParams: {
        regenerateSegments: false,
      },
    } as any);

    expect(qwenKey).not.toBe(deepseekKey);
  });
});

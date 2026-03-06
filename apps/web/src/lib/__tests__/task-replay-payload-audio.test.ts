// 一旦我被更新，请更新我的开头注释
// input: ProcessingTask 模拟数据
// output: 音频任务重放载荷断言
// pos: 队列辅助模块测试
import { extractPayloadFromTask } from "@/lib/task-queue/replay-payload";

describe("audio replay payload", () => {
  const baseTask = {
    id: "task-audio-1",
    bookId: "book-1",
    taskType: "AUDIO_GENERATION",
    status: "failed",
    progress: 50,
    totalItems: 10,
    processedItems: 5,
    taskData: {},
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-03-06T04:00:00.000Z"),
    updatedAt: new Date("2026-03-06T04:10:00.000Z"),
    externalTaskId: null,
  };

  it("should extract router options from queue payload", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          queuePayload: {
            type: "batch",
            scriptSentenceIds: ["sentence-1"],
            options: {
              provider: "voxcpm",
              routerPolicyVersion: "router-v1",
              enableRouterDebug: true,
            },
          },
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "audio",
      input: {
        taskId: "task-audio-1",
        bookId: "book-1",
        type: "batch",
        chapterId: undefined,
        scriptSentenceIds: ["sentence-1"],
        voiceProfileId: undefined,
        autoMerge: false,
        options: {
          provider: "voxcpm",
          routerPolicyVersion: "router-v1",
          enableRouterDebug: true,
        },
      },
    });
  });

  it("should fallback to metadata router options when queue payload missing", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          type: "single",
          scriptSentenceIds: ["sentence-2"],
          provider: "indextts",
          routerPolicyVersion: "router-v2",
          enableRouterDebug: false,
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "audio",
      input: {
        taskId: "task-audio-1",
        bookId: "book-1",
        type: "single",
        chapterId: undefined,
        scriptSentenceIds: ["sentence-2"],
        voiceProfileId: undefined,
        autoMerge: false,
        options: {
          provider: "indextts",
          routerPolicyVersion: "router-v2",
          enableRouterDebug: false,
        },
      },
    });
  });
});

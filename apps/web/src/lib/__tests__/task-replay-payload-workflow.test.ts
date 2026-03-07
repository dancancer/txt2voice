// 一旦我被更新，请更新我的开头注释
// input: 交付任务模拟数据
// output: workflow 任务重放载荷断言
// pos: S31 队列辅助测试
import { extractPayloadFromTask, isRecoverableTask } from "@/lib/task-queue/replay-payload";

describe("workflow task replay payload", () => {
  it("should extract final assembly payload", () => {
    const payload = extractPayloadFromTask({
      id: "assembly-task-1",
      bookId: "book-1",
      taskType: "FINAL_ASSEMBLY",
      status: "failed",
      progress: 0,
      totalItems: 1,
      processedItems: 0,
      taskData: {
        metadata: {
          queuePayload: {
            mode: "final_assembly",
            workflowPayload: {
              type: "book",
              options: { format: "mp3" },
            },
          },
        },
      },
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalTaskId: null,
    } as any);

    expect(payload).toEqual({
      kind: "auto_pipeline",
      input: expect.objectContaining({
        taskId: "assembly-task-1",
        mode: "final_assembly",
        workflowPayload: {
          type: "book",
          options: { format: "mp3" },
        },
      }),
    });
  });

  it("should treat final assembly and review sync as recoverable tasks", () => {
    expect(isRecoverableTask("FINAL_ASSEMBLY")).toBe(true);
    expect(isRecoverableTask("MANUAL_REVIEW_SYNC")).toBe(true);
  });
});

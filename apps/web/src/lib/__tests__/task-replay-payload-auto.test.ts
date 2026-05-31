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
        mode: "pipeline",
        triggerSource: undefined,
        triggerMetadata: {},
        allowReuseRunningTask: undefined,
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
        mode: "pipeline",
        triggerSource: undefined,
        triggerMetadata: {},
        allowReuseRunningTask: undefined,
      },
    });
  });

  it("should prefer resolvedOptions snapshot when replaying without queue payload", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskData: {
        metadata: {
          options: {
            audioGeneration: {
              options: {
                preferredProvider: "qwen3voice",
              },
            },
          },
          resolvedOptions: {
            audioGeneration: {
              autoMerge: false,
              options: {
                preferredProvider: "voxcpm",
                skipExisting: true,
              },
            },
            qualityCheck: {
              enabled: true,
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
            autoMerge: false,
            options: {
              preferredProvider: "voxcpm",
              skipExisting: true,
            },
          },
          qualityCheck: {
            enabled: true,
          },
        },
        mode: "pipeline",
        triggerSource: undefined,
        triggerMetadata: {},
        allowReuseRunningTask: undefined,
      },
    });
  });

  it("should treat auto pipeline as recoverable task", () => {
    expect(isRecoverableTask("AUTO_PIPELINE")).toBe(true);
    expect(isRecoverableTask("UNKNOWN_TASK")).toBe(false);
  });

  it("should extract compensation payload and mark it recoverable", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskType: "AUTO_PIPELINE_COMPENSATION",
      taskData: {
        metadata: {
          queuePayload: {
            mode: "trigger_compensation",
            triggerSource: "upload_compensation",
            triggerMetadata: {
              filename: "book.txt",
            },
            allowReuseRunningTask: true,
            options: {
              qualityCheck: {
                enabled: true,
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
        mode: "trigger_compensation",
        triggerSource: "upload_compensation",
        triggerMetadata: {
          filename: "book.txt",
        },
        allowReuseRunningTask: true,
        options: {
          qualityCheck: {
            enabled: true,
          },
        },
      },
    });
    expect(isRecoverableTask("AUTO_PIPELINE_COMPENSATION")).toBe(true);
  });

  it("should preserve final assembly mode when queue payload is missing", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskType: "FINAL_ASSEMBLY",
      taskData: {
        metadata: {
          source: "final_assembly",
          type: "chapter",
          chapterId: "chapter-1",
          options: {
            format: "mp3",
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
          format: "mp3",
        },
        mode: "final_assembly",
        triggerSource: undefined,
        triggerMetadata: {},
        allowReuseRunningTask: undefined,
        workflowPayload: {
          source: "final_assembly",
          type: "chapter",
          chapterId: "chapter-1",
          options: {
            format: "mp3",
          },
        },
      },
    });
  });

  it("should preserve manual review sync mode when queue payload is missing", () => {
    const payload = extractPayloadFromTask({
      ...baseTask,
      taskType: "MANUAL_REVIEW_SYNC",
      taskData: {
        metadata: {
          source: "manual_review_sync",
          autoTriggerFinalAssembly: true,
          finalAssembly: {
            type: "book",
          },
        },
      },
    } as any);

    expect(payload).toEqual({
      kind: "auto_pipeline",
      input: {
        taskId: "task-auto-1",
        bookId: "book-1",
        options: {},
        mode: "manual_review_sync",
        triggerSource: undefined,
        triggerMetadata: {},
        allowReuseRunningTask: undefined,
        workflowPayload: {
          source: "manual_review_sync",
          autoTriggerFinalAssembly: true,
          finalAssembly: {
            type: "book",
          },
        },
      },
    });
  });

});

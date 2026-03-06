// 一旦我被更新，请更新我的开头注释
// input: 自动编排触发参数/服务依赖 mock
// output: 自动编排触发与补偿调度断言
// pos: 服务层单元测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
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

jest.mock("@/lib/processing-task-utils", () => {
  const actual = jest.requireActual("@/lib/processing-task-utils");
  return {
    ...actual,
    mergeTaskData: jest.fn(),
  };
});

import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { enqueueAutoPipelineJobInternal } from "@/lib/task-queue/ops/auto-pipeline-enqueue";
import { mergeTaskData } from "@/lib/processing-task-utils";
import {
  scheduleAutoPipelineCompensationTask,
  startAutoPipelineTask,
} from "@/lib/auto-pipeline-trigger-service";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findFirst as jest.Mock;
const mockCreateTask = (prisma as any).processingTask.create as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockEnqueueAutoPipeline = enqueueAutoPipelineJobInternal as jest.MockedFunction<
  typeof enqueueAutoPipelineJobInternal
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

describe("auto-pipeline-trigger-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({
      id: "book-1",
      status: "uploaded",
      uploadedFilePath: "/tmp/book-1.txt",
      metadata: {},
    });
    mockUpdateBook.mockResolvedValue({});
  });

  it("should create and enqueue auto pipeline task", async () => {
    mockFindTask.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-auto-1",
    });
    mockEnqueueAutoPipeline.mockResolvedValueOnce({
      jobId: "task-auto-1",
      dedupeKey: "auto_pipeline:book-1:hash",
      reused: false,
      state: "waiting",
    });

    const result = await startAutoPipelineTask({
      bookId: "book-1",
      triggerSource: "pipeline_auto_api",
      options: {
        qualityCheck: {
          enabled: true,
          type: "book",
        },
      },
    });

    expect(result).toEqual({
      taskId: "task-auto-1",
      reused: false,
      totalStages: 4,
      qualityCheckEnabled: true,
    });
    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUTO_PIPELINE",
        totalItems: 4,
        taskData: expect.objectContaining({
          metadata: expect.objectContaining({
            triggerSource: "pipeline_auto_api",
            totalStages: 4,
          }),
        }),
      }),
    });
    expect(mockEnqueueAutoPipeline).toHaveBeenCalledWith(
      {
        taskId: "task-auto-1",
        bookId: "book-1",
        options: {
          qualityCheck: {
            enabled: true,
            type: "book",
          },
        },
        mode: "pipeline",
        triggerSource: "pipeline_auto_api",
        triggerMetadata: {},
        allowReuseRunningTask: true,
      },
      {
        reason: "pipeline_auto_api",
      }
    );
    expect(mockUpdateBook).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-1" },
        data: expect.objectContaining({
          status: "processing",
        }),
      })
    );
  });

  it("should reuse running auto pipeline task when enabled", async () => {
    mockFindTask
      .mockResolvedValueOnce({
        id: "task-running",
        taskData: {
          metadata: {
            totalStages: 3,
          },
        },
      })
      .mockResolvedValueOnce(null);

    const result = await startAutoPipelineTask({
      bookId: "book-1",
      triggerSource: "upload_api",
      allowReuseRunningTask: true,
    });

    expect(result).toEqual({
      taskId: "task-running",
      reused: true,
      totalStages: 3,
      qualityCheckEnabled: false,
    });
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockEnqueueAutoPipeline).not.toHaveBeenCalled();
  });

  it("should reject when a stage task is running", async () => {
    mockFindTask
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "task-stage-1",
        taskType: "SCRIPT_GENERATION",
      });

    await expect(
      startAutoPipelineTask({
        bookId: "book-1",
        triggerSource: "pipeline_auto_api",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("should mark task failed and restore book status when enqueue fails", async () => {
    mockFindTask.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCreateTask.mockResolvedValueOnce({
      id: "task-auto-failed",
    });
    mockEnqueueAutoPipeline.mockRejectedValueOnce(new Error("redis down"));
    mockMergeTaskData.mockResolvedValueOnce({
      message: "Auto Pipeline 入队失败",
      metadata: {
        queueError: "redis down",
      },
    } as any);

    await expect(
      startAutoPipelineTask({
        bookId: "book-1",
        triggerSource: "upload_api",
      })
    ).rejects.toThrow("redis down");

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "task-auto-failed" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "redis down",
      }),
    });
    expect(mockUpdateBook).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "book-1" },
        data: {
          status: "uploaded",
        },
      })
    );
  });

  it("should create and enqueue upload compensation task", async () => {
    mockCreateTask.mockResolvedValueOnce({
      id: "task-compensation-1",
    });
    mockEnqueueAutoPipeline.mockResolvedValueOnce({
      jobId: "task-compensation-1",
      dedupeKey: "auto_pipeline:book-1:compensation",
      reused: false,
      state: "waiting",
    });

    const result = await scheduleAutoPipelineCompensationTask({
      bookId: "book-1",
      options: {
        qualityCheck: {
          enabled: true,
          type: "book",
        },
      },
      originalTriggerSource: "upload_api",
      triggerMetadata: {
        filename: "book.txt",
      },
      triggerFailure: "redis down",
    });

    expect(result).toEqual({
      taskId: "task-compensation-1",
      status: "scheduled",
    });
    expect(mockCreateTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "book-1",
        taskType: "AUTO_PIPELINE_COMPENSATION",
      }),
    });
    expect(mockEnqueueAutoPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-compensation-1",
        bookId: "book-1",
        mode: "trigger_compensation",
        triggerSource: "upload_compensation",
        allowReuseRunningTask: true,
      }),
      expect.objectContaining({
        allowReuse: false,
        reason: "upload_trigger_compensation",
      })
    );
    expect(mockUpdateBook).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-1" },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            autoPipeline: expect.objectContaining({
              compensation: expect.objectContaining({
                taskId: "task-compensation-1",
                status: "scheduled",
              }),
            }),
          }),
        }),
      })
    );
  });
});

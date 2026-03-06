// 一旦我被更新，请更新我的开头注释
// input: 上传补偿任务参数/服务依赖 mock
// output: 上传补偿执行与状态回写断言
// pos: 自动触发补偿执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auto-pipeline-trigger-service", () => ({
  startAutoPipelineTask: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => {
  const actual = jest.requireActual("@/lib/processing-task-utils");
  return {
    ...actual,
    mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  };
});

import prisma from "@/lib/prisma";
import { startAutoPipelineTask } from "@/lib/auto-pipeline-trigger-service";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { runAutoPipelineCompensationTask } from "@/lib/auto-pipeline-compensation-runner";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockStartAutoPipelineTask = startAutoPipelineTask as jest.MockedFunction<
  typeof startAutoPipelineTask
>;
const mockMergeTaskData = mergeTaskData as jest.MockedFunction<typeof mergeTaskData>;

describe("auto-pipeline-compensation-runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateBook.mockResolvedValue({});
    mockUpdateTask.mockResolvedValue({});
    mockMergeTaskData.mockImplementation(async (_taskId, updates) => updates as any);
  });

  it("should skip outdated compensation task", async () => {
    mockFindBook.mockResolvedValueOnce({
      id: "book-1",
      metadata: {
        autoPipeline: {
          compensation: {
            taskId: "task-compensation-new",
          },
        },
      },
    });

    await runAutoPipelineCompensationTask({
      taskId: "task-compensation-old",
      bookId: "book-1",
    });

    expect(mockStartAutoPipelineTask).not.toHaveBeenCalled();
    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "task-compensation-old" },
      data: expect.objectContaining({
        status: "completed",
        progress: 100,
      }),
    });
  });

  it("should trigger auto pipeline and mark compensation completed", async () => {
    mockFindBook
      .mockResolvedValueOnce({
        id: "book-1",
        metadata: {
          autoPipeline: {
            compensation: {
              taskId: "task-compensation-1",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        metadata: {
          autoPipeline: {
            compensation: {
              taskId: "task-compensation-1",
            },
          },
        },
      });
    mockStartAutoPipelineTask.mockResolvedValueOnce({
      taskId: "task-auto-1",
      reused: false,
      totalStages: 4,
      qualityCheckEnabled: true,
    });

    await runAutoPipelineCompensationTask({
      taskId: "task-compensation-1",
      bookId: "book-1",
      triggerMetadata: {
        filename: "book.txt",
      },
      allowReuseRunningTask: true,
    });

    expect(mockStartAutoPipelineTask).toHaveBeenCalledWith({
      bookId: "book-1",
      options: {},
      triggerSource: "upload_compensation",
      triggerMetadata: {
        filename: "book.txt",
        compensationTaskId: "task-compensation-1",
      },
      allowReuseRunningTask: true,
    });
    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "task-compensation-1" },
      data: expect.objectContaining({
        status: "completed",
        progress: 100,
      }),
    });
    expect(mockUpdateBook).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          autoPipeline: expect.objectContaining({
            compensation: expect.objectContaining({
              taskId: "task-compensation-1",
              status: "completed",
              linkedTaskId: "task-auto-1",
            }),
          }),
        }),
      }),
    });
  });
});

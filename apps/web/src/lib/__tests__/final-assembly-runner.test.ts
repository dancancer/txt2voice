// 一旦我被更新，请更新我的开头注释
// input: 最终合并任务参数/音频合并依赖 mock
// output: 合并任务成功回写断言
// pos: S31 交付执行器测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    processingTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/audio-merger", () => ({
  getAudioMerger: jest.fn(),
}));

jest.mock("@/lib/processing-task-utils", () => ({
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  updateProcessingTaskProgress: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { getAudioMerger } from "@/lib/audio-merger";
import { runFinalAssemblyTask } from "@/lib/final-assembly-runner";

const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockGetAudioMerger = getAudioMerger as jest.MockedFunction<typeof getAudioMerger>;

describe("final-assembly-runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindBook.mockResolvedValue({ metadata: {}, status: "manual_review_pending" });
    mockFindTask.mockResolvedValue({ taskData: { metadata: {} } });
    mockUpdateBook.mockResolvedValue({});
    mockUpdateTask.mockResolvedValue({});
    mockGetAudioMerger.mockReturnValue({
      mergeBookAudio: jest.fn().mockResolvedValue({
        success: true,
        outputPath: "/tmp/book.mp3",
        fileName: "book.mp3",
        fileSize: 1024,
        duration: 120,
      }),
      mergeChapterAudio: jest.fn(),
      mergeSegmentAudio: jest.fn(),
    } as any);
  });

  it("should merge book audio asynchronously and update task/book state", async () => {
    await runFinalAssemblyTask({
      taskId: "assembly-task-1",
      bookId: "book-1",
      type: "book",
      options: {
        format: "mp3",
      },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      where: { id: "assembly-task-1" },
      data: expect.objectContaining({
        status: "completed",
        progress: 100,
      }),
    });
    expect(mockUpdateBook).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "completed",
        metadata: expect.objectContaining({
          finalAssembly: expect.objectContaining({
            taskId: "assembly-task-1",
            type: "book",
            outputPath: "/tmp/book.mp3",
          }),
        }),
      }),
    });
  });

  it("should preserve completed_with_errors when final assembly packages a partial book", async () => {
    mockFindBook.mockResolvedValue({
      metadata: {
        audioGenerationStatus: "completed_with_errors",
      },
      status: "assembling_audio",
    });
    mockFindTask.mockResolvedValue({
      taskData: {
        metadata: {
          previousBookStatus: "completed_with_errors",
        },
      },
    });

    await runFinalAssemblyTask({
      taskId: "assembly-task-errors",
      bookId: "book-1",
      type: "book",
    });

    expect(mockUpdateBook).toHaveBeenLastCalledWith({
      where: { id: "book-1" },
      data: expect.objectContaining({
        status: "completed_with_errors",
      }),
    });
  });
});

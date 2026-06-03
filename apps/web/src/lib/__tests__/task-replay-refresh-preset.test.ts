// 一旦我被更新，请更新我的开头注释
// input: 自动编排任务元数据/重放控制项
// output: preset 刷新与普通快照重放断言
// pos: 队列重放服务测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/task-queue/ops/enqueue", () => ({
  enqueueAutoPipelineJob: jest.fn(),
  enqueueAudioGenerationJob: jest.fn(),
  enqueueQualityCheckJob: jest.fn(),
  enqueueQualitySignalSyncJob: jest.fn(),
  enqueueScriptGenerationJob: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { replayProcessingTask } from "@/lib/task-queue/ops/replay";
import { enqueueAutoPipelineJob } from "@/lib/task-queue/ops/enqueue";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockEnqueueAutoPipeline = enqueueAutoPipelineJob as jest.MockedFunction<
  typeof enqueueAutoPipelineJob
>;

const buildAutoPipelineTask = () =>
  ({
    id: "task-auto-1",
    bookId: "book-1",
    taskType: "AUTO_PIPELINE",
    status: "failed",
    taskData: {
      metadata: {
        presetId: "zero_touch_voxcpm",
        options: {
          qualityCheck: {
            enabled: false,
          },
        },
        resolvedOptions: {
          audioGeneration: {
            options: {
              preferredProvider: "voxcpm",
            },
          },
          qualityCheck: {
            enabled: false,
          },
        },
      },
    },
  }) as any;

describe("replayProcessingTask preset refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTask.mockResolvedValue(buildAutoPipelineTask());
    mockEnqueueAutoPipeline.mockResolvedValue({
      jobId: "job-auto-1",
      dedupeKey: "auto:book-1",
      reused: false,
      state: "waiting",
    });
  });

  it("uses stored resolvedOptions for normal replay", async () => {
    await replayProcessingTask("task-auto-1", {
      force: true,
      reason: "manual_replay",
    });

    expect(mockEnqueueAutoPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          audioGeneration: {
            options: {
              preferredProvider: "voxcpm",
            },
          },
          qualityCheck: {
            enabled: false,
          },
        },
      }),
      expect.anything()
    );
  });

  it("uses current preset only when refreshPreset is explicit", async () => {
    await replayProcessingTask("task-auto-1", {
      force: true,
      reason: "manual_replay",
      refreshPreset: true,
    });

    expect(mockEnqueueAutoPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          audioGeneration: {
            autoMerge: false,
            options: {
              preferredProvider: "voxcpm",
              skipExisting: true,
            },
          },
          qualityCheck: {
            enabled: false,
          },
        },
      }),
      expect.anything()
    );
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 自动编排请求参数样例
// output: 自动编排参数解析断言
// pos: 任务执行器测试
jest.mock("@/lib/audio-generation-runner", () => ({
  runAudioGenerationTask: jest.fn(),
}));

jest.mock("@/lib/quality-check-runner", () => ({
  runQualityCheckTask: jest.fn(),
}));

jest.mock("@/lib/script-generation-runner", () => ({
  runScriptGenerationTask: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
  Prisma: {},
}));

jest.mock("@/lib/text-processor", () => ({
  processFileContent: jest.fn(),
  createChapterSegmentRecords: jest.fn(),
}));

jest.mock("@/lib/auto-pipeline/task-stage-utils", () => ({
  createStageTask: jest.fn(),
  runStage: jest.fn(async ({ run }) => run()),
  runTextProcessingStage: jest.fn(),
  getAudioTaskBookStatus: jest.fn(async () => "completed"),
  completeAutoPipeline: jest.fn(),
  markPipelineFailed: jest.fn(),
}));

import {
  parseAutoPipelineOptions,
  runAutoPipelineTask,
} from "@/lib/auto-pipeline-runner";
import prisma from "@/lib/prisma";
import { runQualityCheckTask } from "@/lib/quality-check-runner";
import {
  completeAutoPipeline,
  createStageTask,
} from "@/lib/auto-pipeline/task-stage-utils";

const mockedPrisma = prisma as any;
const mockedCreateStageTask = createStageTask as jest.Mock;
const mockedRunQualityCheckTask = runQualityCheckTask as jest.Mock;
const mockedCompleteAutoPipeline = completeAutoPipeline as jest.Mock;

const at = (iso: string) => new Date(iso);

const baseSentence = (id: string) => ({
  id,
  chapterId: `chapter-${id}`,
  segmentId: `segment-${id}`,
});

const baseAudio = (overrides: Record<string, unknown>) => ({
  id: "audio-1",
  sentenceId: "sentence-1",
  status: "completed",
  attemptNo: 1,
  createdAt: at("2026-01-01T00:00:00.000Z"),
  filePath: "/audio/a.mp3",
  fileSize: 1000,
  duration: 2.5,
  format: "mp3",
  ...overrides,
});

const setupRunnerPrisma = () => {
  mockedCreateStageTask
    .mockResolvedValueOnce({ id: "text-task" })
    .mockResolvedValueOnce({ id: "script-task" })
    .mockResolvedValueOnce({ id: "audio-task" })
    .mockResolvedValueOnce({ id: "quality-task" });

  mockedPrisma.processingTask = {
    findUnique: jest.fn(async () => ({
      status: "processing",
      taskData: {},
    })),
    update: jest.fn(async () => ({})),
  };
  mockedPrisma.book = {
    update: jest.fn(async () => ({})),
    findUnique: jest.fn(async () => ({
      status: "processing",
      metadata: {},
    })),
  };
  mockedPrisma.textSegment = {
    count: jest.fn(async () => 2),
  };
  mockedPrisma.scriptSentence = {
    count: jest.fn(async () => 2),
    findMany: jest.fn(async () => [
      baseSentence("sentence-1"),
      baseSentence("sentence-2"),
    ]),
  };
  mockedPrisma.audioFile = {
    findMany: jest.fn(async () => []),
  };
  mockedPrisma.manualReviewItem = {
    count: jest.fn(async () => 0),
    findMany: jest.fn(async () => []),
    createMany: jest.fn(async () => ({ count: 0 })),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  setupRunnerPrisma();
});

describe("auto-pipeline-runner", () => {
  it("should parse and normalize nested options", () => {
    const options = parseAutoPipelineOptions({
      textProcessing: {
        maxSegmentLength: 888,
        minSegmentLength: 66,
        preserveFormatting: false,
      },
      scriptGeneration: {
        includeNarration: true,
      },
      audioGeneration: {
        autoMerge: true,
        options: {
          provider: "cosyvoice",
          batchSize: 3,
        },
      },
      qualityCheck: {
        enabled: false,
        type: "chapter",
        chapterId: "chapter-1",
      },
    });

    expect(options).toEqual({
      textProcessing: {
        maxSegmentLength: 888,
        minSegmentLength: 66,
        preserveFormatting: false,
      },
      scriptGeneration: {
        includeNarration: true,
      },
      audioGeneration: {
        autoMerge: true,
        options: {
          provider: "cosyvoice",
          batchSize: 3,
        },
      },
      qualityCheck: {
        enabled: false,
        type: "chapter",
        chapterId: "chapter-1",
      },
    });
  });

  it("should fallback invalid values to safe defaults", () => {
    const options = parseAutoPipelineOptions({
      textProcessing: {
        maxSegmentLength: -100,
      },
      audioGeneration: {
        options: "invalid",
      },
      qualityCheck: {
        type: "batch",
      },
    });

    expect(options).toEqual({
      textProcessing: {
        maxSegmentLength: 100,
      },
      scriptGeneration: {},
      audioGeneration: {
        options: {},
      },
      qualityCheck: {},
    });
  });

  it("runs quality check only for the selected audio set", async () => {
    mockedPrisma.audioFile.findMany.mockResolvedValue([
      baseAudio({
        id: "audio-old",
        sentenceId: "sentence-1",
        attemptNo: 1,
      }),
      baseAudio({
        id: "audio-new",
        sentenceId: "sentence-1",
        attemptNo: 2,
      }),
      baseAudio({
        id: "audio-s2",
        sentenceId: "sentence-2",
        attemptNo: 1,
      }),
    ]);

    await runAutoPipelineTask({
      taskId: "pipeline-task",
      bookId: "book-1",
      options: {},
    });

    expect(mockedRunQualityCheckTask).toHaveBeenCalledWith({
      taskId: "quality-task",
      bookId: "book-1",
      type: "batch",
      audioFileIds: ["audio-new", "audio-s2"],
    });
  });

  it("creates one actionable review item per missing audio sentence", async () => {
    mockedPrisma.audioFile.findMany.mockResolvedValue([
      baseAudio({
        id: "audio-s1",
        sentenceId: "sentence-1",
      }),
    ]);

    await runAutoPipelineTask({
      taskId: "pipeline-task",
      bookId: "book-1",
      options: {},
    });

    expect(mockedRunQualityCheckTask).not.toHaveBeenCalled();
    expect(mockedPrisma.manualReviewItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          bookId: "book-1",
          chapterId: "chapter-sentence-2",
          segmentId: "segment-sentence-2",
          sentenceId: "sentence-2",
          issueType: "MISSING_AUDIO",
          status: "pending",
          resolutionType: null,
        }),
      ],
    });
    expect(mockedCompleteAutoPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingReviewCount: 1,
      })
    );
  });
});

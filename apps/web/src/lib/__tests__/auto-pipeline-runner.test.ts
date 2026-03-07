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

import { parseAutoPipelineOptions } from "@/lib/auto-pipeline-runner";

describe("auto-pipeline-runner", () => {
  it("should parse and normalize nested options", () => {
    const options = parseAutoPipelineOptions({
      textProcessing: {
        maxSegmentLength: 888,
        minSegmentLength: 66,
        preserveFormatting: false,
        useSmartSplitter: true,
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
        useSmartSplitter: true,
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
});

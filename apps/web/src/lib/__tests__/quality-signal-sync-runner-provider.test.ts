// 一旦我被更新，请更新我的开头注释
// input: 信号生产任务上下文/provider 推理 mock
// output: provider 优先回写断言
// pos: S30.1 provider 集成测试
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    processingTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    audioFile: {
      findMany: jest.fn(),
    },
    synthesisAttempt: {
      update: jest.fn(),
    },
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/processing-task-utils", () => ({
  mergeTaskData: jest.fn(async (_taskId: string, updates: unknown) => updates),
  updateProcessingTaskProgress: jest.fn(),
  jsonObject: (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
}));

jest.mock("@/lib/quality-check/signal-model-runtime", () => ({
  resolveQualitySignalModelRuntime: jest.fn(() => ({
    source: "task_override",
    runtime: {
      useAsrModel: true,
      useSpeakerModel: true,
      asrModelUrl: "http://asr",
      speakerModelUrl: "http://speaker",
      asrApiKey: null,
      speakerApiKey: null,
      timeoutMs: 1200,
    },
  })),
}));

jest.mock("@/lib/quality-check/signal-model-inference", () => ({
  inferQualitySignalProviders: jest.fn(async () => ({
    cer: 0.021,
    speakerSimilarity: 0.93,
    diagnostics: {
      asrProviderUsed: true,
      speakerProviderUsed: true,
      asrReason: null,
      speakerReason: null,
    },
  })),
}));

import prisma from "@/lib/prisma";
import { runQualitySignalSyncTask } from "@/lib/quality-signal-sync-runner";

const mockFindTask = (prisma as any).processingTask.findUnique as jest.Mock;
const mockUpdateTask = (prisma as any).processingTask.update as jest.Mock;
const mockFindAudioFiles = (prisma as any).audioFile.findMany as jest.Mock;
const mockUpdateAttempt = (prisma as any).synthesisAttempt.update as jest.Mock;
const mockFindBook = (prisma as any).book.findUnique as jest.Mock;
const mockUpdateBook = (prisma as any).book.update as jest.Mock;

describe("quality-signal-sync-runner provider integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTask.mockResolvedValue({
      taskData: {
        metadata: {
          source: "quality_signal_sync",
          signalModelRuntime: {
            useAsrModel: true,
            useSpeakerModel: true,
          },
        },
      },
    });
    mockFindBook.mockResolvedValue({ metadata: {} });
    mockUpdateBook.mockResolvedValue({});
    mockUpdateTask.mockResolvedValue({});
    mockFindAudioFiles.mockResolvedValue([
      {
        id: "audio-1",
        bookId: "book-1",
        sentenceId: "sentence-1",
        filePath: "/tmp/audio-1.mp3",
        voiceProfileId: "voice-1",
        duration: 6,
        scriptSentence: {
          text: "第一章此地无银三百两",
          roleType: "dialogue",
          priority: "high",
        },
        synthesisAttempts: [
          {
            id: "attempt-1",
            metrics: {},
          },
        ],
      },
    ]);
  });

  it("should prefer provider values over heuristic fallback", async () => {
    await runQualitySignalSyncTask({
      taskId: "signal-task-provider-1",
      bookId: "book-1",
      type: "book",
      forceResync: true,
    });

    expect(mockUpdateAttempt).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        metrics: expect.objectContaining({
          cer: 0.021,
          speakerSimilarity: 0.93,
          signalSync: expect.objectContaining({
            version: "s30.1-v2",
            cerSource: "provider",
            speakerSource: "provider",
            modelRuntimeSource: "task_override",
          }),
        }),
      },
    });
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { id: "book-1" },
      data: {
        metadata: expect.objectContaining({
          qualityCheck: expect.objectContaining({
            signalSupply: expect.objectContaining({
              signalModelRuntime: expect.objectContaining({
                asrModelUsedCount: 1,
                speakerModelUsedCount: 1,
                fallbackCount: 0,
              }),
            }),
          }),
        }),
      },
    });
  });
});

// 一旦我被更新，请更新我的开头注释
// input: 批量音频请求/单句生成 mock
// output: 三阶段补跑与可靠性指标断言
// pos: 音频可靠性策略测试
jest.mock("@/lib/tts-service", () => ({
  ttsServiceManager: {
    ready: jest.fn().mockResolvedValue(undefined),
    getVoice: jest.fn(),
    synthesize: jest.fn(),
  },
}));

import { AudioGenerator } from "@/lib/audio-generator";
import { generateBatchAudioWithReliability as generateBatchAudioWithReliabilityFromModule } from "@/lib/audio-generation/execution/batch-audio-runtime";

describe("audio-generator reliability", () => {
  it("should retry failed items in staged passes and keep final order", async () => {
    const generator = new AudioGenerator();
    const generateSingleAudio = jest
      .spyOn(generator, "generateSingleAudio")
      .mockResolvedValueOnce({
        success: true,
        audioFileId: "audio-1",
        duration: 1,
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "timeout-1",
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "timeout-2",
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "retry-failed",
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        audioFileId: "audio-3",
        duration: 3,
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        audioFileId: "audio-2",
        duration: 2,
        metadata: {
          routerDecision: {
            selectedEngine: "indextts",
          },
        },
      });

    const summary = await generator.generateBatchAudioWithReliability(
      [
        { scriptSentenceId: "sentence-1", outputFormat: "mp3" },
        { scriptSentenceId: "sentence-2", outputFormat: "mp3" },
        { scriptSentenceId: "sentence-3", outputFormat: "mp3" },
      ],
      {
        provider: "indextts",
      }
    );

    expect(generateSingleAudio).toHaveBeenCalledTimes(6);
    expect(summary.results.map((result) => result.audioFileId || result.error)).toEqual([
      "audio-1",
      "audio-2",
      "audio-3",
    ]);
    expect(summary.reliability.firstPassSuccessRate).toBeCloseTo(1 / 3, 4);
    expect(summary.reliability.retryRounds).toBe(2);
    expect(summary.reliability.passSummaries).toEqual([
      expect.objectContaining({
        passName: "pass-1",
        requestCount: 3,
        successCount: 1,
        failedCount: 2,
      }),
      expect.objectContaining({
        passName: "pass-2",
        requestCount: 2,
        successCount: 1,
        failedCount: 1,
      }),
      expect.objectContaining({
        passName: "pass-3",
        requestCount: 1,
        successCount: 1,
        failedCount: 0,
      }),
    ]);
    expect(summary.reliability.providerFailures).toEqual([
      expect.objectContaining({
        provider: "indextts",
        failed: 3,
      }),
    ]);
    expect(summary.reliability.averageDurationMs).toBe(2000);
  });

  it("batch runtime helper should match AudioGenerator reliability contract", async () => {
    const generator = new AudioGenerator();
    const generateSingleAudio = jest
      .spyOn(generator, "generateSingleAudio")
      .mockResolvedValueOnce({
        success: true,
        audioFileId: "audio-1",
        duration: 1,
        metadata: {
          routerDecision: {
            selectedEngine: "voxcpm",
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "timeout-1",
        metadata: {
          routerDecision: {
            selectedEngine: "voxcpm",
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        audioFileId: "audio-2",
        duration: 2,
        metadata: {
          routerDecision: {
            selectedEngine: "voxcpm",
          },
        },
      });

    const summary = await generateBatchAudioWithReliabilityFromModule({
      requests: [
        { scriptSentenceId: "sentence-1", outputFormat: "mp3" },
        { scriptSentenceId: "sentence-2", outputFormat: "mp3" },
      ],
      options: {
        provider: "voxcpm",
      },
      defaultOptions: {
        batchSize: 5,
        maxRetries: 3,
        retryDelay: 1000,
        priority: "normal",
        skipExisting: true,
        overwriteExisting: false,
      },
      generateSingleAudio: (request, options) =>
        generator.generateSingleAudio(request, options),
    });

    expect(generateSingleAudio).toHaveBeenCalledTimes(3);
    expect(summary.results.map((result) => result.audioFileId || result.error)).toEqual([
      "audio-1",
      "audio-2",
    ]);
    expect(summary.reliability.firstPassSuccessRate).toBe(0.5);
  });
});

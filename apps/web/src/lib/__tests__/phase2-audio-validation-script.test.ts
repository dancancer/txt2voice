// 一旦我被更新，请更新我的开头注释
// input: 远端 Phase 2 验证脚本参数与 fetch mock
// output: probe 门禁、轮询与 review markdown 断言
// pos: 验收脚本测试
const {
  parseArgs,
  runPhase2AudioValidation,
  buildPhase2ValidationReviewMarkdown,
} = require("../../../../../scripts/phase2-audio-validation.js");

describe("phase2-audio-validation script", () => {
  it("should parse required cli options", () => {
    const options = parseArgs([
      "--provider",
      "voxcpm",
      "--type",
      "chapter",
      "--book-id",
      "book-1",
      "--chapter-id",
      "chapter-1",
      "--repeat-count",
      "2",
      "--batch-size",
      "1",
    ]);

    expect(options.provider).toBe("voxcpm");
    expect(options.type).toBe("chapter");
    expect(options.bookId).toBe("book-1");
    expect(options.chapterId).toBe("chapter-1");
    expect(options.repeatCount).toBe(2);
    expect(options.batchSize).toBe(1);
  });

  it("should stop before audio generation when probe fails", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            providers: [
              {
                provider: "voxcpm",
                healthy: true,
                probeHealthy: false,
                probeMessage: "真实合成失败",
              },
            ],
          },
        }),
      });

    const result = await runPhase2AudioValidation(
      {
        baseUrl: "http://example.com",
        provider: "voxcpm",
        type: "chapter",
        bookId: "book-1",
        chapterId: "chapter-1",
        repeatCount: 1,
        pollIntervalMs: 1,
        timeoutMs: 10,
      },
      {
        fetch: fetchMock,
        sleep: async () => {},
      }
    );

    expect(result.overallVerdict).toBe("probe_failed");
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].verdict).toBe("probe_failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should diagnose stale deployment when probe fields are missing", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            providers: [
              {
                provider: "voxcpm",
                healthy: true,
                message: "服务可用",
              },
            ],
          },
        }),
      });

    const result = await runPhase2AudioValidation(
      {
        baseUrl: "http://example.com",
        provider: "voxcpm",
        type: "chapter",
        bookId: "book-1",
        chapterId: "chapter-1",
        repeatCount: 1,
        pollIntervalMs: 1,
        timeoutMs: 10,
      },
      {
        fetch: fetchMock,
        sleep: async () => {},
      }
    );

    expect(result.overallVerdict).toBe("probe_failed");
    expect(result.runs[0].probe.message).toContain("未返回 probe 字段");
  });

  it("should capture audioReliability after a successful run", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            providers: [
              {
                provider: "voxcpm",
                healthy: true,
                probeHealthy: true,
                probeMessage: "真实合成可用",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            taskId: "task-audio-1",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            generationStatus: "processing",
            generationProgress: 20,
            taskDetails: {
              id: "task-audio-1",
              status: "processing",
              progress: 20,
              metadata: null,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            generationStatus: "completed",
            generationProgress: 100,
            taskDetails: {
              id: "task-audio-1",
              status: "completed",
              progress: 100,
              metadata: {
                successCount: 10,
                failedCount: 0,
                audioReliability: {
                  firstPassSuccessRate: 0.8,
                  retryRounds: 1,
                  averageDurationMs: 2500,
                  providerFailures: [
                    {
                      provider: "voxcpm",
                      failed: 2,
                    },
                  ],
                  passSummaries: [
                    {
                      passName: "pass-1",
                      requestCount: 10,
                      successCount: 8,
                      failedCount: 2,
                    },
                  ],
                },
              },
            },
          },
        }),
      });

    const result = await runPhase2AudioValidation(
      {
        baseUrl: "http://example.com",
        provider: "voxcpm",
        type: "chapter",
        bookId: "book-1",
        chapterId: "chapter-1",
        repeatCount: 1,
        pollIntervalMs: 1,
        timeoutMs: 100,
      },
      {
        fetch: fetchMock,
        sleep: async () => {},
      }
    );

    expect(result.overallVerdict).toBe("completed");
    expect(result.runs[0].taskId).toBe("task-audio-1");
    expect(result.runs[0].audioReliability).toEqual(
      expect.objectContaining({
        firstPassSuccessRate: 0.8,
        retryRounds: 1,
      })
    );

    const markdown = buildPhase2ValidationReviewMarkdown(result);
    expect(markdown).toContain("firstPassSuccessRate");
    expect(markdown).toContain("task-audio-1");
    expect(markdown).toContain("voxcpm");
  });
});

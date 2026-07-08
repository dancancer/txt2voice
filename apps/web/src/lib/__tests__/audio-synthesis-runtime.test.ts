const enqueueAudioSynthesisJob = jest.fn();

jest.mock("@/lib/task-queue", () => ({
  enqueueAudioSynthesisJob: (...args: unknown[]) => enqueueAudioSynthesisJob(...args),
}));

describe("audio-synthesis-runtime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should wait for child job result and enrich runtime metrics", async () => {
    const { runAudioSynthesisRequest } = await import("@/lib/audio-synthesis-runtime");

    enqueueAudioSynthesisJob.mockResolvedValueOnce({
      jobId: "audio-job-1",
      job: {
        id: "audio-job-1",
        attemptsMade: 0,
        timestamp: 1_000,
        processedOn: 1_050,
        finishedOn: 1_220,
        finished: jest.fn().mockResolvedValue({
          success: true,
          audioFileId: "audio-1",
          duration: 2.1,
          provider: "voxcpm",
          attempt: 1,
        }),
      },
    });

    const result = await runAudioSynthesisRequest({
      request: {
        scriptSentenceId: "sentence-1",
        outputFormat: "mp3",
      },
      options: {
        preferredProvider: "voxcpm",
      },
      metadata: {
        source: "test",
      },
    });

    expect(result).toMatchObject({
      success: true,
      audioFileId: "audio-1",
      provider: "voxcpm",
      waitMs: 50,
      totalElapsedMs: 220,
      retriesUsed: 0,
      queueJobId: "audio-job-1",
    });
  });

  it("should restore retryable audio job errors from serialized payload", async () => {
    const { runAudioSynthesisRequest } = await import("@/lib/audio-synthesis-runtime");
    const { serializeAudioJobError } = await import("@/lib/audio-job-error");
    const { TTSError } = await import("@/lib/error-handler");

    enqueueAudioSynthesisJob.mockResolvedValueOnce({
      jobId: "audio-job-2",
      job: {
        id: "audio-job-2",
        attemptsMade: 2,
        timestamp: 1_000,
        processedOn: 1_020,
        finishedOn: 1_400,
        finished: jest
          .fn()
          .mockRejectedValueOnce(
            new Error(
              serializeAudioJobError(
                new TTSError("provider timeout", "TTS_SERVICE_DOWN", "voxcpm", true),
                {
                  provider: "voxcpm",
                  attempt: 3,
                  retriesUsed: 2,
                }
              )
            )
          ),
      },
    });

    await expect(
      runAudioSynthesisRequest({
        request: {
          scriptSentenceId: "sentence-2",
          outputFormat: "mp3",
        },
        options: {
          preferredProvider: "voxcpm",
        },
      })
    ).rejects.toMatchObject({
      provider: "voxcpm",
      retryable: true,
      details: expect.objectContaining({
        attempt: 3,
        retriesUsed: 2,
      }),
    });
  });
});

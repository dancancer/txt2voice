const runAudioSynthesisRequest = jest.fn();

jest.mock("@/lib/audio-synthesis-runtime", () => ({
  runAudioSynthesisRequest: (...args: unknown[]) => runAudioSynthesisRequest(...args),
}));

jest.mock("@/lib/tts-service", () => ({
  ttsServiceManager: {
    ready: jest.fn(),
    getVoice: jest.fn(),
    synthesize: jest.fn(),
  },
}));

describe("audio-generator job runtime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should route single audio generation through audio synthesis runtime", async () => {
    const { AudioGenerator } = await import("@/lib/audio-generator");

    runAudioSynthesisRequest.mockResolvedValueOnce({
      success: true,
      audioFileId: "audio-1",
      duration: 2.2,
      provider: "voxcpm",
      attempt: 1,
    });

    const generator = new AudioGenerator();
    const result = await generator.generateSingleAudio(
      {
        scriptSentenceId: "sentence-1",
        outputFormat: "mp3",
      },
      {
        preferredProvider: "voxcpm",
      }
    );

    expect(runAudioSynthesisRequest).toHaveBeenCalledWith({
      request: {
        scriptSentenceId: "sentence-1",
        outputFormat: "mp3",
      },
      options: {
        preferredProvider: "voxcpm",
      },
      metadata: {
        source: "audio_generator",
      },
    });
    expect(result).toMatchObject({
      success: true,
      audioFileId: "audio-1",
      provider: "voxcpm",
    });
  });
});

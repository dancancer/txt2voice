const fetchMock = jest.fn();

global.fetch = fetchMock as unknown as typeof fetch;

describe("qwen3voice provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps remote speakers to txt2voice voices", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "speaker-1",
          name: "测试女声",
          language: "Chinese",
          tags: ["设计", "克隆"],
          meta: {
            source_type: "voice_design_clone",
          },
        },
      ],
    });

    const { Qwen3VoiceTTSService } = await import(
      "@/lib/tts/providers/qwen3voice"
    );

    const service = new Qwen3VoiceTTSService("http://qwen.test");
    const voices = await service.getAvailableVoices();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://qwen.test/api/speakers",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      })
    );
    expect(voices).toEqual([
      expect.objectContaining({
        id: "speaker-1",
        name: "测试女声",
        displayName: "测试女声",
        language: "zh-CN",
        gender: "neutral",
        age: "adult",
        style: ["设计", "克隆"],
        isNeural: true,
      }),
    ]);
  });

  it("synthesizes by creating a remote job and downloading the result audio", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "job-1",
          status: "completed",
          file_url: "http://qwen.test/files/results/job-1.wav",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });

    const { Qwen3VoiceTTSService } = await import(
      "@/lib/tts/providers/qwen3voice"
    );

    const service = new Qwen3VoiceTTSService("http://qwen.test");
    const response = await service.synthesize({
      text: "你好，世界",
      voice: {
        id: "speaker-1",
        name: "speaker-1",
        displayName: "测试音色",
        language: "zh-CN",
        gender: "neutral",
        age: "adult",
        style: ["narration"],
      },
      outputFormat: "mp3",
      temperature: 0.6,
      topP: 0.8,
      topK: 16,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://qwen.test/api/tts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(firstCallBody).toEqual({
      speaker_id: "speaker-1",
      text: "你好，世界",
      params: {
        language: "Chinese",
        temperature: 0.6,
        top_k: 16,
        top_p: 0.8,
      },
    });

    expect(response.format).toBe("wav");
    expect(response.sampleRate).toBe(24000);
    expect(response.metadata).toMatchObject({
      provider: "qwen3voice",
      audioUrl: "http://qwen.test/files/results/job-1.wav",
      jobId: "job-1",
      speakerId: "speaker-1",
    });
  });
});

export {};

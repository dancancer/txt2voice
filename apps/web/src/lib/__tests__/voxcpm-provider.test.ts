const fetchMock = jest.fn();

global.fetch = fetchMock as unknown as typeof fetch;

describe("voxcpm provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the default VoxCPM2 voice after health check", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", model: "OpenBMB/VoxCPM2" }),
    });

    const { VoxCPMTTSService } = await import("@/lib/tts/providers/voxcpm");

    const service = new VoxCPMTTSService("http://vox.test");
    const voices = await service.getAvailableVoices();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://vox.test/api/health",
      expect.any(Object)
    );
    expect(voices).toEqual([
      expect.objectContaining({
        id: "__voxcpm_default__",
        displayName: "VoxCPM2 默认音色",
        language: "zh-CN",
        sampleRate: 48000,
      }),
    ]);
  });

  it("sends instruction controls and downloads generated audio", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            audioUrl: "/files/outputs/job.wav",
            duration: 1.2,
            sampleRate: 48000,
            model: "OpenBMB/VoxCPM2",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });

    const { VoxCPMTTSService } = await import("@/lib/tts/providers/voxcpm");

    const service = new VoxCPMTTSService("http://vox.test");
    const response = await service.synthesize({
      text: "你好，世界",
      voice: {
        id: "__voxcpm_default__",
        name: "voxcpm2-default",
        displayName: "VoxCPM2 默认音色",
        language: "zh-CN",
        gender: "neutral",
        age: "adult",
        style: ["narration"],
        sampleRate: 48000,
      },
      outputFormat: "wav",
      emotion: "calm",
      style: "narration",
      cfgValue: 2,
      inferenceTimesteps: 10,
      normalize: true,
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      text: "你好，世界",
      control_instruction: expect.stringContaining("calm"),
      cfg_value: 2,
      inference_timesteps: 10,
      normalize: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://vox.test/files/outputs/job.wav"
    );
    expect(response).toMatchObject({
      duration: 1.2,
      format: "wav",
      sampleRate: 48000,
      metadata: {
        provider: "voxcpm",
        audioUrl: "http://vox.test/files/outputs/job.wav",
      },
    });
  });
});

export {};

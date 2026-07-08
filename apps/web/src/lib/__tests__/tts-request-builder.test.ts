import { buildTTSRequest } from "@/lib/audio-generation/synthesis/tts-request-builder";

describe("tts request builder", () => {
  it("passes VoxCPM speaker reference audio into the provider request", async () => {
    const request = await buildTTSRequest({
      scriptSentence: {
        text: "资料带来了吗？",
        tone: "紧张",
        ttsParameters: {},
      },
      voiceProfile: {
        provider: "voxcpm",
        voiceId: "__voxcpm_default__",
        defaultParameters: {
          referenceAudio: "voxcpm2_reference.wav",
          promptText: "资料带来了吗？",
        },
      },
      request: {
        scriptSentenceId: "sentence-1",
        outputFormat: "mp3",
      },
      ttsServiceManager: {
        ready: jest.fn().mockResolvedValue(undefined),
        getVoice: jest.fn().mockResolvedValue({
          id: "__voxcpm_default__",
          name: "voxcpm2-default",
          displayName: "VoxCPM2 默认音色",
          language: "zh-CN",
          gender: "neutral",
          age: "adult",
          style: ["narration", "dialogue"],
        }),
      },
    });

    expect(request.referenceAudio).toBe("voxcpm2_reference.wav");
    expect(request.promptText).toBe("资料带来了吗？");
  });
});

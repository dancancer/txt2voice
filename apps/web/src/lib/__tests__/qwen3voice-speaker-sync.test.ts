describe("qwen3voice speaker sync", () => {
  it("creates local speaker and voice assets from a remote qwen speaker", async () => {
    const prismaClient = {
      speakerProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 101,
          name: "测试音色",
          referenceAudio: "http://qwen.test/ref.wav",
        }),
        update: jest.fn(),
      },
      tTSVoiceProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "voice-1",
          provider: "qwen3voice",
          voiceId: "speaker-1",
          displayName: "测试音色",
        }),
        update: jest.fn(),
      },
    };

    const service = {
      listSpeakers: jest.fn().mockResolvedValue([
        {
          id: "speaker-1",
          name: "测试音色",
          source_type: "voice_design_clone",
          language: "Chinese",
          reference_text: "你好",
          tags: ["设计", "克隆"],
          reference_audio_url: "http://qwen.test/ref.wav",
          preview_audio_url: "http://qwen.test/preview.wav",
        },
      ]),
    };

    const { syncQwen3VoiceSpeakerAssets } = await import(
      "@/lib/qwen3voice/speaker-sync"
    );

    const result = await syncQwen3VoiceSpeakerAssets({
      remoteSpeakerId: "speaker-1",
      prismaClient: prismaClient as any,
      service: service as any,
    });

    expect(service.listSpeakers).toHaveBeenCalledTimes(1);
    expect(prismaClient.speakerProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "测试音色",
          referenceAudio: "http://qwen.test/ref.wav",
        }),
      })
    );
    expect(prismaClient.tTSVoiceProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "qwen3voice",
          voiceId: "speaker-1",
          voiceName: "测试音色",
        }),
      })
    );
    expect(result).toMatchObject({
      speakerProfile: {
        id: 101,
      },
      voiceProfile: {
        id: "voice-1",
      },
    });
  });
});

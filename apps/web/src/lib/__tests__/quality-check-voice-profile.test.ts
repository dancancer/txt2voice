import {
  resolveQualityVoiceProfileId,
} from "@/lib/quality-check/process-audio-files";

describe("resolveQualityVoiceProfileId", () => {
  it("uses synthesis speaker variant when legacy voiceProfileId is absent", () => {
    expect(
      resolveQualityVoiceProfileId({
        voiceProfileId: null,
        synthesisAttempts: [
          {
            speakerProfileId: 6,
            speakerEngineVariantId: "variant-1",
          },
        ],
      })
    ).toBe("speaker_engine_variant:variant-1");
  });

  it("keeps legacy TTS voice profile id when present", () => {
    expect(
      resolveQualityVoiceProfileId({
        voiceProfileId: "legacy-voice-1",
        synthesisAttempts: [
          {
            speakerProfileId: 6,
            speakerEngineVariantId: "variant-1",
          },
        ],
      })
    ).toBe("legacy-voice-1");
  });
});

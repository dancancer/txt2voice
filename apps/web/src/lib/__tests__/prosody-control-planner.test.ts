import { planVoxCPMProsodyParams } from "@/lib/audio-generation/synthesis/prosody-control-planner";

describe("prosody control planner", () => {
  it("builds VoxCPM controls from explicit overrides first", () => {
    expect(
      planVoxCPMProsodyParams({
        tone: "calm",
        emotionLabel: "sad",
        requestOverrides: {
          controlInstruction: "低声、克制地朗读",
          cfgValue: 2,
          inferenceTimesteps: 10,
          normalize: false,
          denoise: true,
        },
        ttsParameters: {
          ttsHints: {
            controlInstruction: "不要使用这条",
            cfgValue: 3,
          },
        },
      })
    ).toEqual({
      controlInstruction: "低声、克制地朗读",
      cfgValue: 2,
      inferenceTimesteps: 10,
      normalize: false,
      denoise: true,
    });
  });

  it("derives a stable instruction from script emotion when no explicit instruction exists", () => {
    expect(
      planVoxCPMProsodyParams({
        tone: "serious",
        emotionLabel: "angry",
        emotionIntensity: 0.73,
      }).controlInstruction
    ).toBe("情绪偏 angry，强度 73%");
  });
});

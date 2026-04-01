// 一旦我被更新，请更新我的开头注释
// input: provider probe 依赖 mock
// output: 真实 synth 探针断言
// pos: 音频可靠性策略测试
import { probeTtsProviderRuntime } from "@/lib/tts-runtime-probe";

describe("tts-runtime-probe", () => {
  it("should fail probe when indextts has no reference audio", async () => {
    const result = await probeTtsProviderRuntime({
      provider: "indextts",
      deps: {
        indextts: {
          getReferenceAudios: jest.fn().mockResolvedValue([]),
          synthesizeAndWait: jest.fn(),
        },
      },
    });

    expect(result.provider).toBe("indextts");
    expect(result.healthy).toBe(false);
    expect(result.message).toContain("参考音频");
  });

  it("should run real synth probe for voxcpm", async () => {
    const synthesize = jest.fn().mockResolvedValue({
      audioUrl: "http://localhost/fake.wav",
      duration: 1.2,
    });

    const result = await probeTtsProviderRuntime({
      provider: "voxcpm",
      deps: {
        voxcpm: {
          synthesize,
        },
      },
    });

    expect(result.provider).toBe("voxcpm");
    expect(result.healthy).toBe(true);
    expect(result.message).toContain("可用");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.any(String),
      })
    );
  });
});

// 一旦我被更新，请更新我的开头注释
// input: provider 名称
// output: 音频运行时策略断言
// pos: 音频可靠性策略测试
import { getAudioRuntimePolicy } from "@/lib/audio-runtime-policy";

describe("audio-runtime-policy", () => {
  it("should return conservative staged concurrency for voxcpm", () => {
    const policy = getAudioRuntimePolicy("voxcpm");

    expect(policy.provider).toBe("voxcpm");
    expect(policy.firstPassConcurrency).toBe(1);
    expect(policy.retryPassConcurrency).toBe(1);
    expect(policy.rescuePassConcurrency).toBe(1);
    expect(policy.maxPasses).toBe(3);
    expect(policy.synthProbe.text.length).toBeGreaterThan(0);
  });

  it("should fallback to mixed policy when provider is omitted", () => {
    const policy = getAudioRuntimePolicy();

    expect(policy.provider).toBe("mixed");
    expect(policy.firstPassConcurrency).toBeGreaterThan(0);
    expect(policy.retryPassConcurrency).toBeLessThanOrEqual(
      policy.firstPassConcurrency
    );
    expect(policy.rescuePassConcurrency).toBe(1);
  });
});

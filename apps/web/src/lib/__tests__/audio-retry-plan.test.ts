// 一旦我被更新，请更新我的开头注释
// input: 音频请求列表/阶段结果
// output: 重跑阶段规划断言
// pos: 音频可靠性策略测试
import {
  buildAudioRetryPass,
  buildNextAudioRetryPass,
} from "@/lib/audio-retry-plan";

type RequestItem = {
  scriptSentenceId: string;
};

const requests: RequestItem[] = [
  { scriptSentenceId: "sentence-1" },
  { scriptSentenceId: "sentence-2" },
  { scriptSentenceId: "sentence-3" },
];

describe("audio-retry-plan", () => {
  it("should build first pass from the full request set", () => {
    const pass = buildAudioRetryPass({
      passName: "pass-1",
      requests,
      getRequestId: (request) => request.scriptSentenceId,
    });

    expect(pass.passName).toBe("pass-1");
    expect(pass.mode).toBe("full");
    expect(pass.requests.map((request) => request.scriptSentenceId)).toEqual([
      "sentence-1",
      "sentence-2",
      "sentence-3",
    ]);
    expect(pass.concurrency).toBeGreaterThan(1);
  });

  it("should only keep failed requests for later passes", () => {
    const pass1 = buildAudioRetryPass({
      passName: "pass-1",
      requests,
      getRequestId: (request) => request.scriptSentenceId,
    });

    const pass2 = buildNextAudioRetryPass({
      previousPass: pass1,
      results: [{ success: true }, { success: false }, { success: false }],
      getRequestId: (request) => request.scriptSentenceId,
    });

    expect(pass2).not.toBeNull();
    expect(pass2?.passName).toBe("pass-2");
    expect(pass2?.mode).toBe("failed-only");
    expect(pass2?.requests.map((request) => request.scriptSentenceId)).toEqual([
      "sentence-2",
      "sentence-3",
    ]);

    const pass3 = buildNextAudioRetryPass({
      previousPass: pass2!,
      results: [{ success: false }, { success: true }],
      getRequestId: (request) => request.scriptSentenceId,
    });

    expect(pass3).not.toBeNull();
    expect(pass3?.passName).toBe("pass-3");
    expect(pass3?.mode).toBe("rescue");
    expect(pass3?.requests.map((request) => request.scriptSentenceId)).toEqual([
      "sentence-2",
    ]);
    expect(pass3?.concurrency).toBe(1);

    const done = buildNextAudioRetryPass({
      previousPass: pass3!,
      results: [{ success: true }],
      getRequestId: (request) => request.scriptSentenceId,
    });

    expect(done).toBeNull();
  });
});

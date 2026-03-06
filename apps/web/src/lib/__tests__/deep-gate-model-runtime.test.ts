// 一旦我被更新，请更新我的开头注释
// input: Deep Gate 模型运行时模块
// output: 配置解析与模型信号断言
// pos: Deep Gate 模型运行时测试
import { inferDeepGateModelSignals } from "@/lib/quality-check/deep-gate-model-inference";
import { resolveDeepGateModelRuntime } from "@/lib/quality-check/deep-gate-model-runtime";

const makeFetchResponse = (payload: Record<string, unknown>) => {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
};

const setFetch = (fetchImpl: unknown) => {
  Object.defineProperty(globalThis, "fetch", {
    value: fetchImpl,
    configurable: true,
    writable: true,
  });

  const maybeWindow = (globalThis as { window?: unknown }).window as
    | Record<string, unknown>
    | undefined;
  if (maybeWindow) {
    Object.defineProperty(maybeWindow, "fetch", {
      value: fetchImpl,
      configurable: true,
      writable: true,
    });
  }
};

describe("deep-gate-model-runtime", () => {
  const originalFetch = (globalThis as any).fetch;
  const envBackup = {
    emotionModelUrl: process.env.QC_DEEP_GATE_EMOTION_MODEL_URL,
    continuityModelUrl: process.env.QC_DEEP_GATE_CONTINUITY_MODEL_URL,
    useEmotionModel: process.env.QC_DEEP_GATE_USE_EMOTION_MODEL,
    useContinuityModel: process.env.QC_DEEP_GATE_USE_CONTINUITY_MODEL,
    timeoutMs: process.env.QC_DEEP_GATE_MODEL_TIMEOUT_MS,
    apiKey: process.env.QC_DEEP_GATE_MODEL_API_KEY,
  };

  afterEach(() => {
    process.env.QC_DEEP_GATE_EMOTION_MODEL_URL = envBackup.emotionModelUrl;
    process.env.QC_DEEP_GATE_CONTINUITY_MODEL_URL = envBackup.continuityModelUrl;
    process.env.QC_DEEP_GATE_USE_EMOTION_MODEL = envBackup.useEmotionModel;
    process.env.QC_DEEP_GATE_USE_CONTINUITY_MODEL = envBackup.useContinuityModel;
    process.env.QC_DEEP_GATE_MODEL_TIMEOUT_MS = envBackup.timeoutMs;
    process.env.QC_DEEP_GATE_MODEL_API_KEY = envBackup.apiKey;
    setFetch(originalFetch);
  });

  it("should resolve runtime with task override", () => {
    process.env.QC_DEEP_GATE_EMOTION_MODEL_URL = "http://env/emotion";
    process.env.QC_DEEP_GATE_CONTINUITY_MODEL_URL = "http://env/continuity";
    process.env.QC_DEEP_GATE_USE_EMOTION_MODEL = "true";
    process.env.QC_DEEP_GATE_USE_CONTINUITY_MODEL = "true";

    const resolution = resolveDeepGateModelRuntime({
      taskMetadata: {
        deepGateModelRuntime: {
          useEmotionModel: false,
          useContinuityModel: true,
          continuityModelUrl: "http://task/continuity",
        },
      },
      bookMetadata: {
        qualityCheck: {
          deepGateModelRuntime: {
            useEmotionModel: true,
            emotionModelUrl: "http://book/emotion",
          },
        },
      },
    });

    expect(resolution.source).toBe("task_override");
    expect(resolution.runtime).toMatchObject({
      useEmotionModel: false,
      useContinuityModel: true,
      emotionModelUrl: "http://book/emotion",
      continuityModelUrl: "http://task/continuity",
    });
  });

  it("should use model scores when remote endpoints return valid payload", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({
          predictedLabel: "joy",
          confidence: 0.9,
          scores: {
            joy: 0.82,
            calm: 0.12,
          },
        })
      )
      .mockResolvedValueOnce(
        makeFetchResponse({
          similarity: 0.66,
          confidence: 0.88,
        })
      );
    setFetch(fetchMock);

    const inference = await inferDeepGateModelSignals({
      runtime: {
        useEmotionModel: true,
        useContinuityModel: true,
        emotionModelUrl: "http://mock/emotion",
        continuityModelUrl: "http://mock/continuity",
        timeoutMs: 1_000,
      },
      input: {
        text: "我们终于赢了。",
        roleType: "dialogue",
        emotionLabel: "joy",
        emotionIntensity: 0.8,
        charsPerSecond: 2.3,
        chapterContext: {
          chapterId: "chapter-1",
          sampleCount: 8,
          averageCharsPerSecond: 2.1,
          roleTypeAverages: {
            dialogue: 2.1,
          },
          voiceProfileAverages: {
            "voice-a": 2.2,
          },
        },
        voiceProfileId: "voice-a",
      },
    });
    expect(inference.q4Source).toBe("emotion_model");
    expect(inference.q5Source).toBe("continuity_model");
    expect(inference.q4Score).toBe(82);
    expect(inference.q5Score).toBe(66);
  });

  it("should fallback to heuristic when model request fails", async () => {
    setFetch(jest.fn().mockRejectedValueOnce(new Error("timeout")));

    const inference = await inferDeepGateModelSignals({
      runtime: {
        useEmotionModel: true,
        useContinuityModel: false,
        emotionModelUrl: "http://mock/emotion",
        continuityModelUrl: null,
        timeoutMs: 1_000,
      },
      input: {
        text: "我知道了。",
        roleType: "dialogue",
        emotionLabel: "calm",
        emotionIntensity: 0.4,
        charsPerSecond: 1.9,
      },
    });

    expect(inference.q4Source).toBe("heuristic");
    expect(inference.q4Score).toBeUndefined();
    expect(inference.diagnostics).toMatchObject({
      emotionModel: {
        used: false,
      },
    });
  });
});

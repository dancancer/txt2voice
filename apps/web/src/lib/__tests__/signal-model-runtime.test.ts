// 一旦我被更新，请更新我的开头注释
// input: 环境变量/任务配置/书籍配置
// output: 信号模型运行时解析断言
// pos: S30.1 provider 运行时测试
import { resolveQualitySignalModelRuntime } from "@/lib/quality-check/signal-model-runtime";

describe("signal-model-runtime", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should resolve runtime from env defaults", () => {
    process.env.QC_SIGNAL_ASR_MODEL_URL = "http://localhost:9001/asr";
    process.env.QC_SIGNAL_SPEAKER_MODEL_URL = "http://localhost:9002/speaker";
    process.env.QC_SIGNAL_MODEL_TIMEOUT_MS = "3200";

    const result = resolveQualitySignalModelRuntime({
      taskMetadata: {},
      bookMetadata: {},
    });

    expect(result).toEqual({
      source: "default",
      runtime: expect.objectContaining({
        useAsrModel: true,
        useSpeakerModel: true,
        asrModelUrl: "http://localhost:9001/asr",
        speakerModelUrl: "http://localhost:9002/speaker",
        timeoutMs: 3200,
      }),
    });
  });

  it("should allow task override to replace book metadata runtime", () => {
    const result = resolveQualitySignalModelRuntime({
      taskMetadata: {
        signalModelRuntime: {
          useAsrModel: true,
          asrModelUrl: "http://task/asr",
          timeoutMs: 1800,
        },
      },
      bookMetadata: {
        qualityCheck: {
          signalModelRuntime: {
            useAsrModel: true,
            useSpeakerModel: true,
            asrModelUrl: "http://book/asr",
            speakerModelUrl: "http://book/speaker",
            timeoutMs: 2600,
          },
        },
      },
    });

    expect(result.source).toBe("task_override");
    expect(result.runtime).toEqual(
      expect.objectContaining({
        useAsrModel: true,
        asrModelUrl: "http://task/asr",
        useSpeakerModel: true,
        speakerModelUrl: "http://book/speaker",
        timeoutMs: 1800,
      })
    );
  });
});

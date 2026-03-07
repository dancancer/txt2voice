// 一旦我被更新，请更新我的开头注释
// input: 模型运行时/HTTP 响应 mock
// output: 信号 provider 推理解析断言
// pos: S30.1 provider 推理测试
import { inferQualitySignalProviders } from "@/lib/quality-check/signal-model-inference";

describe("signal-model-inference", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("should parse direct cer and similarity values from providers", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { cer: 0.07 };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { similarity: 0.91 };
        },
      }) as any;

    const result = await inferQualitySignalProviders({
      runtime: {
        useAsrModel: true,
        useSpeakerModel: true,
        asrModelUrl: "http://asr",
        speakerModelUrl: "http://speaker",
        asrApiKey: null,
        speakerApiKey: null,
        timeoutMs: 1200,
      },
      input: {
        audioFileId: "audio-1",
        sentenceId: "sentence-1",
        bookId: "book-1",
        filePath: "/tmp/audio-1.mp3",
        text: "第一章此地无银三百两",
        durationSeconds: 6,
        roleType: "dialogue",
        priority: "high",
        voiceProfileId: "voice-1",
      },
    });

    expect(result.cer).toBe(0.07);
    expect(result.speakerSimilarity).toBe(0.91);
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        asrProviderUsed: true,
        speakerProviderUsed: true,
        asrReason: null,
        speakerReason: null,
      })
    );
  });

  it("should derive cer from transcript and similarity from embeddings", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { transcript: "第一章此地无银三百两" };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return {
            embedding: [1, 0, 0],
            referenceEmbedding: [0.8, 0.2, 0],
          };
        },
      }) as any;

    const result = await inferQualitySignalProviders({
      runtime: {
        useAsrModel: true,
        useSpeakerModel: true,
        asrModelUrl: "http://asr",
        speakerModelUrl: "http://speaker",
        asrApiKey: null,
        speakerApiKey: null,
        timeoutMs: 1200,
      },
      input: {
        audioFileId: "audio-1",
        sentenceId: "sentence-1",
        bookId: "book-1",
        filePath: "/tmp/audio-1.mp3",
        text: "第一章此地无银三百两",
        durationSeconds: 6,
        roleType: "dialogue",
        priority: "high",
        voiceProfileId: "voice-1",
      },
    });

    expect(result.cer).toBe(0);
    expect(result.speakerSimilarity).toBeGreaterThan(0.9);
  });
});

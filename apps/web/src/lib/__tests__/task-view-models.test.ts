import {
  getTaskChildJobSummaries,
  getTaskStatusMeta,
} from "@/lib/view-models/tasks";

describe("task view models", () => {
  it("should derive llm and audio child job summaries from task metadata", () => {
    const summaries = getTaskChildJobSummaries({
      llmMetrics: {
        submitted: 5,
        completed: 3,
        failed: 1,
        retried: 2,
        averageWaitMs: 120,
        averageLatencyMs: 840,
        providers: [
          {
            provider: "openai",
            submitted: 5,
            completed: 3,
            failed: 1,
            retried: 2,
            averageWaitMs: 120,
            averageLatencyMs: 840,
          },
        ],
      },
      audioChildJobMetrics: {
        submitted: 4,
        completed: 4,
        failed: 0,
        retried: 1,
        averageWaitMs: 40,
        averageLatencyMs: 1500,
        providers: [
          {
            provider: "voxcpm",
            submitted: 4,
            completed: 4,
            failed: 0,
            retried: 1,
            averageWaitMs: 40,
            averageLatencyMs: 1500,
          },
        ],
      },
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        key: "llm",
        label: "LLM 子任务",
        submitted: 5,
        completed: 3,
        failed: 1,
        retried: 2,
        inFlight: 1,
      }),
      expect.objectContaining({
        key: "audio_synthesis",
        label: "TTS 子任务",
        submitted: 4,
        completed: 4,
        failed: 0,
        retried: 1,
        inFlight: 0,
      }),
    ]);
  });

  it("should ignore malformed child job metadata", () => {
    const summaries = getTaskChildJobSummaries({
      llmMetrics: "invalid",
      audioChildJobMetrics: {
        submitted: "oops",
      },
    });

    expect(summaries).toEqual([]);
  });

  it("should expose canceled status meta", () => {
    expect(getTaskStatusMeta("canceled")).toEqual({
      label: "已取消",
      className: "bg-amber-100 text-amber-700",
    });
  });
});

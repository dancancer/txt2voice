export {};

const queueState = {
  scriptQueue: null,
  audioQueue: null,
  audioSynthesisQueue: null,
  qualityQueue: null,
  signalSyncQueue: null,
  autoPipelineQueue: null,
  llmQueue: null,
  deadLetterQueue: null,
  workerStarted: false,
  recovering: false,
  lastRecoveryAt: 0,
};

const makeQueue = (name: string) => ({
  name,
  process: jest.fn(),
  add: jest.fn(),
  getJob: jest.fn(),
});

const scriptQueue = makeQueue("script");
const audioQueue = makeQueue("audio");
const audioSynthesisQueue = makeQueue("audio-synthesis");
const qualityQueue = makeQueue("quality");
const signalSyncQueue = makeQueue("signal-sync");
const autoPipelineQueue = makeQueue("auto-pipeline");
const llmQueue = makeQueue("llm");

const runAudioSynthesisJob = jest.fn();

jest.mock("@/lib/task-queue/core/runtime", () => ({
  queueState,
  addDeadLetter: jest.fn(),
  getAutoPipelineQueue: jest.fn(() => autoPipelineQueue),
  getAudioQueue: jest.fn(() => audioQueue),
  getAudioSynthesisQueue: jest.fn(() => audioSynthesisQueue),
  getDeadLetterQueue: jest.fn(() => ({ name: "dead-letter" })),
  getLLMQueue: jest.fn(() => llmQueue),
  getQualityQueue: jest.fn(() => qualityQueue),
  getScriptQueue: jest.fn(() => scriptQueue),
  getSignalSyncQueue: jest.fn(() => signalSyncQueue),
}));

jest.mock("@/lib/auto-pipeline-runner", () => ({
  runAutoPipelineTask: jest.fn(),
}));
jest.mock("@/lib/auto-pipeline-compensation-runner", () => ({
  runAutoPipelineCompensationTask: jest.fn(),
}));
jest.mock("@/lib/final-assembly-runner", () => ({
  runFinalAssemblyTask: jest.fn(),
}));
jest.mock("@/lib/manual-review-sync-runner", () => ({
  runManualReviewSyncTask: jest.fn(),
}));
jest.mock("@/lib/audio-generation-runner", () => ({
  runAudioGenerationTask: jest.fn(),
}));
jest.mock("@/lib/quality-check-runner", () => ({
  runQualityCheckTask: jest.fn(),
}));
jest.mock("@/lib/quality-signal-sync-runner", () => ({
  runQualitySignalSyncTask: jest.fn(),
}));
jest.mock("@/lib/script-generation-runner", () => ({
  runScriptGenerationTask: jest.fn(),
}));
jest.mock("@/lib/task-queue/worker-state", () => ({
  handleWorkerFailure: jest.fn(),
  markTaskAttemptStart: jest.fn(),
  withTaskHeartbeat: jest.fn(
    async (_taskId: string, _job: unknown, _interval: number, run: () => Promise<unknown>) =>
      run()
  ),
}));
jest.mock("@/lib/task-queue/ops/llm-execute", () => ({
  runLLMExecutionJob: jest.fn(),
}));
jest.mock("@/lib/task-queue/ops/audio-synthesis-execute", () => ({
  runAudioSynthesisJob: (...args: unknown[]) => runAudioSynthesisJob(...args),
}));

describe("audio-synthesis-job-runtime queue wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueState.workerStarted = false;
    process.env.AUDIO_SYNTHESIS_MAX_CONCURRENCY = "9";
  });

  afterAll(() => {
    delete process.env.AUDIO_SYNTHESIS_MAX_CONCURRENCY;
  });

  it("should expose audio synthesis queue defaults", async () => {
    jest.resetModules();
    const constants = await import("@/lib/task-queue/core/constants");

    expect(constants.AUDIO_SYNTHESIS_QUEUE_NAME).toContain("audio-synthesis");
    expect(constants.AUDIO_SYNTHESIS_JOB_OPTIONS).toMatchObject({
      attempts: expect.any(Number),
      timeout: expect.any(Number),
    });
  });

  it("should register audio synthesis worker with configured concurrency", async () => {
    jest.resetModules();
    const { ensureTaskWorkerStarted } = await import("@/lib/task-queue/ops/worker");

    await ensureTaskWorkerStarted();

    expect(audioSynthesisQueue.process).toHaveBeenCalledWith(9, expect.any(Function));
  });

  it("should execute sentence jobs through audio synthesis executor", async () => {
    jest.resetModules();
    runAudioSynthesisJob.mockResolvedValueOnce({
      success: true,
      audioFileId: "audio-1",
      duration: 2.4,
      metadata: {
        provider: "voxcpm",
      },
    });

    const { ensureTaskWorkerStarted } = await import("@/lib/task-queue/ops/worker");
    await ensureTaskWorkerStarted();

    const worker = audioSynthesisQueue.process.mock.calls[0][1] as (job: any) => Promise<unknown>;
    const result = await worker({
      id: "audio-job-1",
      attemptsMade: 0,
      data: {
        requestId: "audio-job-1",
        request: {
          scriptSentenceId: "sentence-1",
          outputFormat: "mp3",
        },
        options: {
          provider: "voxcpm",
        },
        metadata: {
          source: "test",
        },
      },
    });

    expect(runAudioSynthesisJob).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "audio-job-1",
      }),
      expect.objectContaining({
        attempt: 1,
      })
    );
    expect(result).toMatchObject({
      success: true,
      audioFileId: "audio-1",
    });
  });
});

export {};

const queueState = {
  scriptQueue: null,
  audioQueue: null,
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

const runLLMExecutionJob = jest.fn();

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

jest.mock("@/lib/task-queue/namespace-check", () => ({
  warnIfLegacyNamespaceHasPendingJobs: jest.fn(),
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
  runLLMExecutionJob: (...args: unknown[]) => runLLMExecutionJob(...args),
}));

describe("llm-job-runtime queue wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueState.workerStarted = false;
    queueState.llmQueue = null;
    process.env.LLM_MAX_CONCURRENCY = "7";
  });

  afterAll(() => {
    delete process.env.LLM_MAX_CONCURRENCY;
  });

  it("should expose llm queue defaults", async () => {
    jest.resetModules();

    const constants = await import("@/lib/task-queue/core/constants");

    expect(constants.LLM_QUEUE_NAME).toContain("llm-execution");
    expect(constants.LLM_JOB_OPTIONS).toMatchObject({
      attempts: 3,
      timeout: expect.any(Number),
    });
  });

  it("should register llm worker with configured concurrency", async () => {
    jest.resetModules();

    const { ensureTaskWorkerStarted } = await import("@/lib/task-queue/ops/worker");

    await ensureTaskWorkerStarted();

    expect(llmQueue.process).toHaveBeenCalledWith(7, expect.any(Function));
  });

  it("should execute llm jobs through llm executor", async () => {
    jest.resetModules();
    runLLMExecutionJob.mockResolvedValueOnce({
      content: "ok",
      model: "gpt-test",
      provider: "mock",
      latencyMs: 12,
      attempt: 1,
      usage: null,
    });

    const { ensureTaskWorkerStarted } = await import("@/lib/task-queue/ops/worker");
    await ensureTaskWorkerStarted();

    const worker = llmQueue.process.mock.calls[0][1] as (job: any) => Promise<unknown>;
    const result = await worker({
      id: "llm-job-1",
      attemptsMade: 0,
      data: {
        requestId: "llm-job-1",
        provider: {
          name: "mock",
          apiKey: "test",
          model: "gpt-test",
        },
        prompt: "hello",
        systemPrompt: "system",
        metadata: {
          callSite: "test",
        },
        requestOptions: {},
      },
    });

    expect(runLLMExecutionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "llm-job-1",
        prompt: "hello",
      }),
      expect.objectContaining({
        attempt: 1,
      })
    );
    expect(result).toMatchObject({
      content: "ok",
      model: "gpt-test",
    });
  });
});

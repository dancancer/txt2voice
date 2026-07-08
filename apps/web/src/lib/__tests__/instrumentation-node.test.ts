// 一旦我被更新，请更新我的开头注释
// input: 服务端启动环境变量/任务队列启动依赖 mock
// output: queue worker 启动行为断言
// pos: instrumentation node 启动回归测试
export {};

const ensureTaskWorkerStarted = jest.fn();

jest.mock("@/lib/task-queue", () => ({
  ensureTaskWorkerStarted: (...args: unknown[]) => ensureTaskWorkerStarted(...args),
}));

describe("instrumentation-node", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it("should start task worker when redis is configured", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    const { bootstrapTaskQueueWorker } = await import("@/instrumentation-node");

    await bootstrapTaskQueueWorker();

    expect(ensureTaskWorkerStarted).toHaveBeenCalledTimes(1);
  });

  it("should skip task worker bootstrap when redis is missing", async () => {
    delete process.env.REDIS_URL;

    const { bootstrapTaskQueueWorker } = await import("@/instrumentation-node");

    await bootstrapTaskQueueWorker();

    expect(ensureTaskWorkerStarted).not.toHaveBeenCalled();
  });
});

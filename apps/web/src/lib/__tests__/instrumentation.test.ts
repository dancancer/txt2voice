// 一旦我被更新，请更新我的开头注释
// input: Next runtime 环境变量/服务端启动 bootstrap mock
// output: instrumentation register 行为断言
// pos: instrumentation 启动回归测试
export {};

const bootstrapTaskQueueWorker = jest.fn();

jest.mock("@/instrumentation-node", () => ({
  bootstrapTaskQueueWorker: (...args: unknown[]) => bootstrapTaskQueueWorker(...args),
}));

describe("instrumentation register", () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
  });

  it("should bootstrap task worker in nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    const { register } = await import("@/instrumentation");

    await register();

    expect(bootstrapTaskQueueWorker).toHaveBeenCalledTimes(1);
  });

  it("should skip task worker bootstrap in edge runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";

    const { register } = await import("@/instrumentation");

    await register();

    expect(bootstrapTaskQueueWorker).not.toHaveBeenCalled();
  });
});

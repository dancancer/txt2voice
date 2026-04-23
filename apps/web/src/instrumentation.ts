// 一旦我被更新，请更新我的开头注释
// input: Next 服务端 runtime 生命周期
// output: 服务级启动副作用注册
// pos: Next instrumentation 启动入口

/* =========================
 * Next 服务端启动钩子
 * 只在 nodejs runtime 启动常驻 worker
 * ========================= */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { bootstrapTaskQueueWorker } = await import("@/instrumentation-node");
  await bootstrapTaskQueueWorker();
}

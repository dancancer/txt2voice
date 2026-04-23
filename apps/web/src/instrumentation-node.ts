// 一旦我被更新，请更新我的开头注释
// input: 进程环境变量/任务队列启动依赖
// output: queue worker 启动副作用
// pos: Next 服务端 node runtime 启动引导
import { ensureTaskWorkerStarted } from "@/lib/task-queue";

/* =========================
 * 启动入口：任务队列 worker
 * ========================= */
export async function bootstrapTaskQueueWorker(): Promise<void> {
  if (!process.env.REDIS_URL) {
    return;
  }

  await ensureTaskWorkerStarted();
}

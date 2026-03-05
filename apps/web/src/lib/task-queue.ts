// 一旦我被更新，请更新我的开头注释
// input: 任务入参与队列配置
// output: 队列入队/worker 启动能力
// pos: 任务基础设施
export type {
  AudioGenerationQueueInput,
  QualityCheckQueueInput,
  QueueControlOptions,
  RecoveryResult,
  ReplayControlOptions,
  ReplayResult,
  ScriptGenerationQueueInput,
} from "@/lib/task-queue/core/types";

export {
  enqueueAudioGenerationJob,
  enqueueQualityCheckJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue/ops/enqueue";
export { getTaskQueueHealth } from "@/lib/task-queue/ops/health";
export { recoverStalledProcessingTasks } from "@/lib/task-queue/ops/recovery";
export { replayProcessingTask } from "@/lib/task-queue/ops/replay";
export { ensureTaskWorkerStarted } from "@/lib/task-queue/ops/worker";

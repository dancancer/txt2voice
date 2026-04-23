// 一旦我被更新，请更新我的开头注释
// input: 任务入参与队列配置
// output: 队列入队/worker 启动能力
// pos: 任务基础设施
export type {
  AutoPipelineQueueInput,
  AudioGenerationQueueInput,
  AudioSynthesisJobData,
  AudioSynthesisJobResult,
  AudioSynthesisQueueInput,
  LLMExecutionJobData,
  LLMExecutionJobResult,
  LLMExecutionQueueInput,
  LLMExecutionRequestOptions,
  LLMProviderSnapshot,
  QualityCheckQueueInput,
  QualitySignalSyncQueueInput,
  QueueControlOptions,
  RecoveryResult,
  ReplayControlOptions,
  ReplayResult,
  ScriptGenerationQueueInput,
} from "@/lib/task-queue/core/types";
export type { CancelProcessingTaskResult } from "@/lib/task-queue/ops/cancel";

export {
  enqueueAutoPipelineJob,
  enqueueAudioGenerationJob,
  enqueueAudioSynthesisJob,
  enqueueLLMExecutionJob,
  enqueueQualityCheckJob,
  enqueueQualitySignalSyncJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue/ops/enqueue";
export { getTaskQueueHealth } from "@/lib/task-queue/ops/health";
export { recoverStalledProcessingTasks } from "@/lib/task-queue/ops/recovery";
export { replayProcessingTask } from "@/lib/task-queue/ops/replay";
export { cancelProcessingTask } from "@/lib/task-queue/ops/cancel";
export { cancelProcessingTaskJob } from "@/lib/task-queue/core/runtime";
export { runLLMExecutionJob } from "@/lib/task-queue/ops/llm-execute";
export { runAudioSynthesisJob } from "@/lib/task-queue/ops/audio-synthesis-execute";
export { ensureTaskWorkerStarted } from "@/lib/task-queue/ops/worker";

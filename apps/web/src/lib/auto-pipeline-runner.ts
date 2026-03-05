// 一旦我被更新，请更新我的开头注释
// input: 自动编排模块调用参数
// output: 自动编排执行与参数解析导出
// pos: 自动编排对外入口
export type {
  AutoPipelineOptions,
  AutoPipelineRunParams,
  AutoPipelineStage,
  AutoPipelineStageState,
  AutoPipelineStageStatus,
} from "@/lib/auto-pipeline/common";

export { parseAutoPipelineOptions } from "@/lib/auto-pipeline/common";
export { runAutoPipelineTask } from "@/lib/auto-pipeline/runner";

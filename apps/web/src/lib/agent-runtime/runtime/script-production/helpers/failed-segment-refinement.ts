// 一旦我被更新，请更新我的开头注释
// input: 失败 segment 与校验失败上下文
// output: refinement 主能力导出
// pos: script production helper
/**
 * failed segment refinement 导出入口
 */

export type {
  FailedSegmentRefinementInput,
  RefinedSegmentSlice,
} from "./failed-segment-refinement/types";
export {
  refineFailedSegment,
  shouldRefineSegmentFailure,
} from "./failed-segment-refinement/pipeline";

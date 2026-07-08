// 一旦我被更新，请更新我的开头注释
// input: 文本分段调用方
// output: smart text splitter 对外导出
// pos: 共享业务库
/**
 * 智能文本分段器导出入口
 */

export { SmartTextSplitter, splitTextSmartly } from './smart-text-splitter/core/splitter'
export { calculateSmartLength } from './smart-text-splitter/shared/length'
export { validateSegmentQuality } from './smart-text-splitter/shared/quality'
export type { SmartSplitterOptions, TextSegment } from './smart-text-splitter/shared/types'

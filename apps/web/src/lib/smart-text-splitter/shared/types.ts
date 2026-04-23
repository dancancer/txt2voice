// 一旦我被更新，请更新我的开头注释
// input: 分段配置/运行时元数据
// output: 分段模块共享类型
// pos: smart text splitter shared
/**
 * 智能文本分段共享类型
 */

export type SegmentBreakReason =
  | 'sentence_boundary'
  | 'punctuation'
  | 'forced'
  | 'paragraph'
  | 'long_sentence'
  | 'final_segment'
  | 'merged_for_balance'
  | 'dp_optimized'

export interface SmartSplitterOptions {
  targetLength?: number
  maxLength?: number
  minLength?: number
  tolerance?: number
  preferSentenceBoundary?: boolean
}

export interface SmartSplitterConfig {
  targetLength: number
  maxLength: number
  minLength: number
  tolerance: number
  preferSentenceBoundary: boolean
}

export interface TextSegment {
  content: string
  length: number
  order: number
  metadata?: {
    breakReason?: SegmentBreakReason
    originalIndex?: number
    originalOrder?: number
    truncated?: boolean
    merged?: boolean
    split?: boolean
  }
}

export interface SentenceInfo {
  text: string
  start: number
  end: number
}

export interface SegmentPlan {
  start: number
  end: number
}

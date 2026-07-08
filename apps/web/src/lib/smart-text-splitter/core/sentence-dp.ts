// 一旦我被更新，请更新我的开头注释
// input: 原始文本/句子边界/分段配置
// output: 动态规划分段结果
// pos: smart text splitter core
/**
 * 句子级动态规划分段
 */

import type {
  SegmentBreakReason,
  SegmentPlan,
  SentenceInfo,
  SmartSplitterConfig,
  TextSegment,
} from '../shared/types'

interface SentenceDpOptions {
  text: string
  config: SmartSplitterConfig
  sentences: SentenceInfo[]
  measureLength: (text: string) => number
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
}

export function segmentWithSentenceDP({
  text,
  config,
  sentences,
  measureLength,
  createSegment,
}: SentenceDpOptions): TextSegment[] | null {
  if (sentences.length === 0) {
    return null
  }

  const memo = new Map<number, SegmentPlan[] | null>()

  const dfs = (index: number): SegmentPlan[] | null => {
    if (index >= sentences.length) {
      return []
    }

    if (memo.has(index)) {
      return memo.get(index) || null
    }

    let plan: SegmentPlan[] | null = null
    const startInfo = sentences[index]

    for (let end = index; end < sentences.length; end++) {
      const endInfo = sentences[end]
      const segmentContent = text.slice(startInfo.start, endInfo.end)
      const length = measureLength(segmentContent)
      const isLast = end === sentences.length - 1
      const lastSegmentHardLimit = Math.max(
        config.maxLength * 3,
        config.maxLength + config.tolerance * 2,
      )

      if ((!isLast && length > config.maxLength) || (isLast && length > lastSegmentHardLimit)) {
        break
      }

      const minRequirement = isLast ? 0 : config.minLength
      if (length < minRequirement) {
        continue
      }

      const rest = dfs(end + 1)
      if (!rest) {
        continue
      }

      plan = [{ start: index, end }, ...rest]
      break
    }

    memo.set(index, plan)
    return plan
  }

  const plan = dfs(0)
  if (!plan) {
    return null
  }

  return plan.map((segmentPlan, order) => {
    const startSentence = sentences[segmentPlan.start]
    const endSentence = sentences[segmentPlan.end]
    const content = text.slice(startSentence.start, endSentence.end)
    const breakReason = order === plan.length - 1 ? 'final_segment' : 'dp_optimized'
    return createSegment(content, order, breakReason)
  })
}

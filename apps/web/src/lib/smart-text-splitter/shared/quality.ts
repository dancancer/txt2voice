// 一旦我被更新，请更新我的开头注释
// input: 分段结果/校验配置
// output: 分段质量报告
// pos: smart text splitter shared
/**
 * 分段质量校验
 */

import type { SmartSplitterOptions, TextSegment } from './types'

export function validateSegmentQuality(
  segments: TextSegment[],
  options?: SmartSplitterOptions
): {
  valid: boolean
  issues: string[]
  stats: {
    totalSegments: number
    avgLength: number
    minLength: number
    maxLength: number
    segmentsInRange: number
  }
} {
  const opts = {
    targetLength: 500,
    maxLength: 600,
    minLength: 400,
    tolerance: 100,
    ...options,
  }

  const issues: string[] = []
  let totalLength = 0
  let segmentsInRange = 0

  segments.forEach((segment, index) => {
    const isLastSegment = index === segments.length - 1
    const isLongSentence = segment.metadata?.breakReason === 'long_sentence'
    const trimmedLength = segment.content.trim().length
    const effectiveLength = Math.max(segment.length, trimmedLength)

    totalLength += effectiveLength

    if (!isLastSegment && !isLongSentence && effectiveLength > opts.maxLength) {
      issues.push(`段落 ${segment.order} 超出最大长度限制: ${effectiveLength} > ${opts.maxLength}`)
    }

    if (!isLastSegment && effectiveLength < opts.minLength) {
      issues.push(`段落 ${segment.order} 低于最小长度要求: ${effectiveLength} < ${opts.minLength}`)
    }

    if (Math.abs(effectiveLength - opts.targetLength) <= opts.tolerance) {
      segmentsInRange++
    }

    if (
      segment.metadata?.breakReason === 'forced' &&
      !/[。！？；：.!?;:]\s*$/.test(segment.content)
    ) {
      issues.push(`段落 ${segment.order} 可能在句子中间被截断`)
    }
  })

  const stats = {
    totalSegments: segments.length,
    avgLength: segments.length > 0 ? Math.round(totalLength / segments.length) : 0,
    minLength: Math.min(...segments.map(segment => Math.max(segment.length, segment.content.trim().length))),
    maxLength: Math.max(...segments.map(segment => Math.max(segment.length, segment.content.trim().length))),
    segmentsInRange,
  }

  return {
    valid: issues.length === 0,
    issues,
    stats,
  }
}

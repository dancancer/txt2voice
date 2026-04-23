// 一旦我被更新，请更新我的开头注释
// input: 分段结果/均衡配置
// output: 均衡后的分段结果
// pos: smart text splitter core
/**
 * 分段长度均衡
 */

import { buildInsideDialogueQuoteMap } from '../../dialogue-quote-tracker'
import type { SegmentBreakReason, SmartSplitterConfig, TextSegment } from '../shared/types'

interface BalanceSegmentsOptions {
  segments: TextSegment[]
  config: SmartSplitterConfig
  measureLength: (text: string) => number
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
  processOversizedContent: (
    content: string,
    startOrder: number,
    allowFlexibleFinalSegment?: boolean,
    skipBalance?: boolean
  ) => TextSegment[]
}

export function balanceSegmentLengths({
  segments,
  config,
  measureLength,
  createSegment,
  processOversizedContent,
}: BalanceSegmentsOptions): TextSegment[] {
  if (segments.length <= 1) {
    return segments
  }

  const balancedSegments: TextSegment[] = []
  let index = 0

  while (index < segments.length) {
    const currentSegment = segments[index]
    const currentEffectiveLength = measureLength(currentSegment.content)

    if (currentEffectiveLength >= config.minLength && currentEffectiveLength <= config.maxLength) {
      balancedSegments.push(currentSegment)
      index++
      continue
    }

    if (currentSegment.length < config.minLength && index < segments.length - 1) {
      const merged = mergeForward({
        segments,
        startIndex: index,
        config,
        measureLength,
        createSegment,
        processOversizedContent,
      })

      if (merged) {
        balancedSegments.push(...merged.segments)
        index += merged.consumedCount
        continue
      }
    }

    if (currentEffectiveLength > config.maxLength && currentSegment.metadata?.breakReason !== 'long_sentence') {
      balancedSegments.push(
        ...forceSplitLongText({
          text: currentSegment.content,
          startOrder: currentSegment.order,
          config,
          createSegment,
        }),
      )
      index++
      continue
    }

    balancedSegments.push(currentSegment)
    index++
  }

  return balancedSegments
}

interface MergeForwardResult {
  segments: TextSegment[]
  consumedCount: number
}

function mergeForward({
  segments,
  startIndex,
  config,
  measureLength,
  createSegment,
  processOversizedContent,
}: {
  segments: TextSegment[]
  startIndex: number
  config: SmartSplitterConfig
  measureLength: (text: string) => number
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
  processOversizedContent: (
    content: string,
    startOrder: number,
    allowFlexibleFinalSegment?: boolean,
    skipBalance?: boolean
  ) => TextSegment[]
}): MergeForwardResult | null {
  const currentSegment = segments[startIndex]
  let consumedSegments = 1
  let combinedContent = currentSegment.content
  let combinedEffectiveLength = measureLength(combinedContent)
  let lastConsumedIndex = startIndex

  while (combinedEffectiveLength < config.minLength && startIndex + consumedSegments < segments.length) {
    const nextSegment = segments[startIndex + consumedSegments]
    combinedContent = `${combinedContent} ${nextSegment.content}`.trim()
    combinedEffectiveLength = measureLength(combinedContent)
    lastConsumedIndex = startIndex + consumedSegments
    consumedSegments++

    if (lastConsumedIndex === segments.length - 1) {
      break
    }
  }

  if (consumedSegments <= 1) {
    return null
  }

  const reachedEnd = lastConsumedIndex === segments.length - 1

  if (combinedEffectiveLength <= config.maxLength) {
    return {
      segments: [
        createMergedSegment(currentSegment, combinedContent, createSegment),
      ],
      consumedCount: consumedSegments,
    }
  }

  const rebalancedSegments = processOversizedContent(
    combinedContent,
    currentSegment.order,
    reachedEnd,
    true,
  )

  if (rebalancedSegments.length === 0) {
    return null
  }

  return {
    segments: rebalancedSegments,
    consumedCount: consumedSegments,
  }
}

function createMergedSegment(
  currentSegment: TextSegment,
  combinedContent: string,
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
): TextSegment {
  const mergedSegment = createSegment(combinedContent, currentSegment.order, 'merged_for_balance')
  mergedSegment.metadata = {
    ...currentSegment.metadata,
    breakReason: 'merged_for_balance',
    originalOrder: currentSegment.order,
    merged: true,
  }
  return mergedSegment
}

function forceSplitLongText({
  text,
  startOrder,
  config,
  createSegment,
}: {
  text: string
  startOrder: number
  config: SmartSplitterConfig
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
}): TextSegment[] {
  const segments: TextSegment[] = []
  const insideQuote = buildInsideDialogueQuoteMap(text)
  let currentPosition = 0

  while (currentPosition < text.length) {
    let endPosition = Math.min(currentPosition + config.maxLength, text.length)

    if (config.preferSentenceBoundary && endPosition < text.length) {
      const punctuationRegex = /[，。！？；：,.!?;:]/

      for (let index = endPosition; index > currentPosition + config.minLength; index--) {
        if (insideQuote[index]) {
          continue
        }

        if (punctuationRegex.test(text[index])) {
          endPosition = index + 1
          break
        }
      }
    }

    segments.push(
      createSegment(text.substring(currentPosition, endPosition), startOrder + segments.length, 'forced'),
    )
    currentPosition = endPosition
  }

  return segments
}

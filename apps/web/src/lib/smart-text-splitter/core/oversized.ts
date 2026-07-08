// 一旦我被更新，请更新我的开头注释
// input: 超长文本/分段配置/句子切分器
// output: 超长文本分段结果
// pos: smart text splitter core
/**
 * 超长文本拆分
 */

import type { SegmentBreakReason, SmartSplitterConfig, TextSegment } from '../shared/types'

interface OversizedSplitOptions {
  content: string
  startOrder: number
  config: SmartSplitterConfig
  measureLength: (text: string) => number
  splitIntoSentences: (text: string) => string[]
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
  balanceSegments: (segments: TextSegment[]) => TextSegment[]
  allowFlexibleFinalSegment?: boolean
  skipBalance?: boolean
}

export function processOversizedContent({
  content,
  startOrder,
  config,
  measureLength,
  splitIntoSentences,
  createSegment,
  balanceSegments,
  allowFlexibleFinalSegment = false,
  skipBalance = false,
}: OversizedSplitOptions): TextSegment[] {
  const segments: TextSegment[] = []
  const sentences = splitIntoSentences(content)
  let currentSegment = ''
  let segmentOrder = startOrder

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim()
    if (!sentence) {
      continue
    }

    const candidate = currentSegment ? `${currentSegment} ${sentence}` : sentence
    const candidateLength = measureLength(candidate)
    const currentLength = measureLength(currentSegment)

    if (candidateLength <= config.maxLength) {
      const shouldFinalizeCurrent =
        currentSegment.length > 0 &&
        currentLength >= config.targetLength &&
        candidateLength > config.targetLength

      if (shouldFinalizeCurrent) {
        segments.push(createSegment(currentSegment, segmentOrder++, 'sentence_boundary'))
        currentSegment = sentence
      } else {
        currentSegment = candidate
      }
      continue
    }

    if (currentSegment.trim().length > 0) {
      const breakReason = currentLength >= config.minLength ? 'sentence_boundary' : 'forced'
      segments.push(createSegment(currentSegment, segmentOrder++, breakReason))
      currentSegment = ''
    }

    const sentenceLength = measureLength(sentence)
    if (sentenceLength <= config.maxLength) {
      currentSegment = sentence
      continue
    }

    segments.push(createSegment(sentence, segmentOrder++, 'long_sentence'))
  }

  if (currentSegment.trim()) {
    const currentLength = measureLength(currentSegment)

    if (currentLength >= config.minLength || allowFlexibleFinalSegment) {
      const reason = allowFlexibleFinalSegment ? 'final_segment' : 'sentence_boundary'
      segments.push(createSegment(currentSegment, segmentOrder++, reason))
    } else if (segments.length > 0 && !allowFlexibleFinalSegment) {
      mergeShortTail({
        segments,
        currentSegment,
        segmentOrder,
        config,
        measureLength,
        createSegment,
      })
    } else {
      const reason = allowFlexibleFinalSegment ? 'final_segment' : 'forced'
      segments.push(createSegment(currentSegment, segmentOrder++, reason))
    }
  }

  return skipBalance ? segments : balanceSegments(segments)
}

interface MergeShortTailOptions {
  segments: TextSegment[]
  currentSegment: string
  segmentOrder: number
  config: SmartSplitterConfig
  measureLength: (text: string) => number
  createSegment: (content: string, order: number, breakReason?: SegmentBreakReason) => TextSegment
}

function mergeShortTail({
  segments,
  currentSegment,
  segmentOrder,
  config,
  measureLength,
  createSegment,
}: MergeShortTailOptions) {
  const lastSegment = segments[segments.length - 1]
  const mergedContent = `${lastSegment.content} ${currentSegment}`.trim()
  const mergedEffectiveLength = measureLength(mergedContent)

  if (mergedEffectiveLength <= config.maxLength) {
    lastSegment.content = mergedContent
    lastSegment.length = measureLength(mergedContent)
    lastSegment.metadata = {
      ...lastSegment.metadata,
      merged: true,
    }
    return
  }

  segments.push(createSegment(currentSegment, segmentOrder, 'forced'))
}

// 一旦我被更新，请更新我的开头注释
// input: 文本/分段配置
// output: 智能文本分段器及便捷入口
// pos: smart text splitter core
/**
 * 智能文本分段主流程
 */

import { CONFIG } from '../../constants'
import { updateDialogueQuoteStack } from '../../dialogue-quote-tracker'
import { logger } from '../../logger'
import { balanceSegmentLengths } from './balance'
import { processOversizedContent as processOversizedContentImpl } from './oversized'
import { segmentWithSentenceDP } from './sentence-dp'
import { calculateSmartLength, measureEffectiveLength } from '../shared/length'
import { splitIntoSentenceInfos, splitIntoSentences } from '../shared/sentence-boundaries'
import type {
  SegmentBreakReason,
  SmartSplitterConfig,
  SmartSplitterOptions,
  TextSegment,
} from '../shared/types'

/**
 * 智能文本分段器类
 */
export class SmartTextSplitter {
  private readonly config: SmartSplitterConfig

  constructor(options: SmartSplitterOptions = {}) {
    this.config = {
      targetLength: options.targetLength || CONFIG.TEXT_PROCESSING.DEFAULT_SEGMENT_LENGTH,
      maxLength: options.maxLength || CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH,
      minLength: options.minLength || CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH,
      tolerance: options.tolerance || CONFIG.TEXT_PROCESSING.SEGMENT_TOLERANCE,
      preferSentenceBoundary: options.preferSentenceBoundary ?? true,
    }

    if (this.config.targetLength > this.config.maxLength) {
      throw new Error('targetLength cannot be greater than maxLength')
    }

    if (this.config.minLength > this.config.targetLength) {
      throw new Error('minLength cannot be greater than targetLength')
    }
  }

  split(text: string): TextSegment[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    logger.info('Starting smart text splitting', {
      textLength: text.length,
      targetLength: this.config.targetLength,
      maxLength: this.config.maxLength,
      minLength: this.config.minLength,
    })

    const cleanText = this.preprocessText(text)
    const optimizedSegments = this.segmentWithSentenceDP(cleanText)

    if (optimizedSegments) {
      return optimizedSegments
    }

    if (this.measureLength(cleanText) <= this.config.maxLength) {
      return [this.createSegment(cleanText, 0, 'paragraph')]
    }

    const paragraphs = this.splitIntoParagraphs(cleanText)
    if (paragraphs.length === 1 && this.measureLength(paragraphs[0]) > this.config.maxLength) {
      return this.processOversizedContent(paragraphs[0], 0, true)
    }

    const segments = this.performSmartSplitting(paragraphs)

    logger.info('Smart text splitting completed', {
      originalLength: text.length,
      segmentCount: segments.length,
      avgLength:
        segments.length > 0
          ? Math.round(segments.reduce((sum, segment) => sum + segment.length, 0) / segments.length)
          : 0,
      targetLength: this.config.targetLength,
    })

    return segments
  }

  private preprocessText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/([。！？；，])\s+/g, '$1')
      .trim()
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
  }

  private performSmartSplitting(paragraphs: string[]): TextSegment[] {
    const segments: TextSegment[] = []
    let currentSegment = ''
    let segmentOrder = 0

    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index]
      const paragraphLength = this.measureLength(paragraph)
      const isLastParagraph = index === paragraphs.length - 1

      if (paragraphLength > this.config.maxLength) {
        if (currentSegment.trim().length > 0) {
          segments.push(this.createSegment(currentSegment, segmentOrder++))
          currentSegment = ''
        }

        const oversizedSegments = this.processOversizedContent(paragraph, segmentOrder, isLastParagraph)
        segments.push(...oversizedSegments)
        segmentOrder += oversizedSegments.length
        continue
      }

      if (currentSegment.length === 0) {
        currentSegment = paragraph
        continue
      }

      const combinedContent = `${currentSegment}\n\n${paragraph}`
      const potentialLength = this.measureLength(combinedContent)

      if (potentialLength <= this.config.maxLength) {
        currentSegment = combinedContent
        continue
      }

      if (this.measureLength(currentSegment) >= this.config.minLength) {
        segments.push(this.createSegment(currentSegment, segmentOrder++))
        currentSegment = paragraph
        continue
      }

      const oversizedSegments = this.processOversizedContent(combinedContent, segmentOrder, isLastParagraph)
      segments.push(...oversizedSegments)
      segmentOrder += oversizedSegments.length
      currentSegment = ''
    }

    if (currentSegment.trim().length > 0) {
      segments.push(this.createSegment(currentSegment, segmentOrder++, 'final_segment'))
    }

    return this.balanceSegmentLengths(segments)
  }

  private segmentWithSentenceDP(text: string): TextSegment[] | null {
    return segmentWithSentenceDP({
      text,
      config: this.config,
      sentences: splitIntoSentenceInfos(text, {
        updateQuoteStack: (quoteStack, char) => updateDialogueQuoteStack(quoteStack, char),
      }),
      measureLength: content => this.measureLength(content),
      createSegment: (content, order, breakReason) => this.createSegment(content, order, breakReason),
    })
  }

  private processOversizedContent(
    content: string,
    startOrder: number,
    allowFlexibleFinalSegment = false,
    skipBalance = false
  ): TextSegment[] {
    return processOversizedContentImpl({
      content,
      startOrder,
      config: this.config,
      measureLength: value => this.measureLength(value),
      splitIntoSentences: value =>
        splitIntoSentences(value, {
          updateQuoteStack: (quoteStack, char) => updateDialogueQuoteStack(quoteStack, char),
        }),
      createSegment: (value, order, breakReason) => this.createSegment(value, order, breakReason),
      balanceSegments: segments => this.balanceSegmentLengths(segments),
      allowFlexibleFinalSegment,
      skipBalance,
    })
  }

  private balanceSegmentLengths(segments: TextSegment[]): TextSegment[] {
    return balanceSegmentLengths({
      segments,
      config: this.config,
      measureLength: value => this.measureLength(value),
      createSegment: (value, order, breakReason) => this.createSegment(value, order, breakReason),
      processOversizedContent: (content, startOrder, allowFlexibleFinalSegment, skipBalance) =>
        this.processOversizedContent(content, startOrder, allowFlexibleFinalSegment, skipBalance),
    })
  }

  private measureLength(text: string): number {
    return measureEffectiveLength(text)
  }

  private createSegment(
    content: string,
    order: number,
    breakReason?: SegmentBreakReason
  ): TextSegment {
    return {
      content: content.trim(),
      length: calculateSmartLength(content),
      order,
      metadata: {
        breakReason,
      },
    }
  }
}

export function splitTextSmartly(text: string, options?: SmartSplitterOptions): TextSegment[] {
  const splitter = new SmartTextSplitter(options)
  return splitter.split(text)
}

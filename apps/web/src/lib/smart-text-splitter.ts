/**
 * 智能文本分段器
 *
 * 专门针对以下需求设计：
 * 1. 每段严格控制在500字内，不能超出
 * 2. 分段均匀，正负不超过100字（目标400-500字）
 * 3. 优先不截断句子，保持语义完整性
 */

import { CONFIG } from './constants'
import { logger } from './logger'

export interface SmartSplitterOptions {
  targetLength?: number      // 目标长度，默认400
  maxLength?: number         // 最大长度，默认500
  minLength?: number         // 最小长度，默认100
  tolerance?: number         // 容差，默认100
  preferSentenceBoundary?: boolean // 是否优先在句子边界分段
}

export interface TextSegment {
  content: string
  length: number
  order: number
  metadata?: {
    breakReason?: 'sentence_boundary' | 'punctuation' | 'forced' | 'paragraph' | 'long_sentence' | 'final_segment' | 'merged_for_balance' | 'dp_optimized'
    originalIndex?: number
    originalOrder?: number
    truncated?: boolean
    merged?: boolean
    split?: boolean
  }
}

interface SentenceInfo {
  text: string
  start: number
  end: number
}

interface SegmentPlan {
  start: number
  end: number
}

/**
 * 智能文本分段器类
 */
export class SmartTextSplitter {
  private targetLength: number
  private maxLength: number
  private minLength: number
  private tolerance: number
  private preferSentenceBoundary: boolean

  constructor(options: SmartSplitterOptions = {}) {
    this.targetLength = options.targetLength || CONFIG.TEXT_PROCESSING.DEFAULT_SEGMENT_LENGTH
    this.maxLength = options.maxLength || CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH
    this.minLength = options.minLength || CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH
    this.tolerance = options.tolerance || CONFIG.TEXT_PROCESSING.SEGMENT_TOLERANCE
    this.preferSentenceBoundary = options.preferSentenceBoundary ?? true

    // 参数验证
    if (this.targetLength > this.maxLength) {
      throw new Error('targetLength cannot be greater than maxLength')
    }
    if (this.minLength > this.targetLength) {
      throw new Error('minLength cannot be greater than targetLength')
    }
  }

  /**
   * 计算综合长度：取智能长度与实际字符长度中的较大值
   */
  private measureLength(text: string): number {
    const trimmedLength = text.trim().length
    const smartLength = calculateSmartLength(text)
    return Math.max(smartLength, trimmedLength)
  }

  /**
   * 分割文本
   */
  split(text: string): TextSegment[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    logger.info('Starting smart text splitting', {
      textLength: text.length,
      targetLength: this.targetLength,
      maxLength: this.maxLength,
      minLength: this.minLength,
    })

    // 预处理：清理和标准化文本
    const cleanText = this.preprocessText(text)

    const optimizedSegments = this.segmentWithSentenceDP(cleanText)
    if (optimizedSegments) {
      return optimizedSegments
    }

    // 检查文本长度，如果很短，直接返回
    const textLength = this.measureLength(cleanText)
    if (textLength <= this.maxLength) {
      return [this.createSegment(cleanText, 0, 'paragraph')]
    }

    // 按段落初步分割
    const paragraphs = this.splitIntoParagraphs(cleanText)

    // 检查是否只有一个段落但内容很长
    if (paragraphs.length === 1 && this.measureLength(paragraphs[0]) > this.maxLength) {
      // 单个长段落，直接分割，并允许最后一段自由
      return this.processOversizedContent(paragraphs[0], 0, true)
    }

    // 智能分段
    const segments = this.performSmartSplitting(paragraphs)

    logger.info('Smart text splitting completed', {
      originalLength: text.length,
      segmentCount: segments.length,
      avgLength: segments.length > 0 ? Math.round(segments.reduce((sum, s) => sum + s.length, 0) / segments.length) : 0,
      targetLength: this.targetLength,
    })

    return segments
  }

  /**
   * 预处理文本
   */
  private preprocessText(text: string): string {
    let clean = text

    // 标准化换行符
    clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // 移除多余的空行
    clean = clean.replace(/\n{3,}/g, '\n\n')

    // 标准化标点符号后的空格
    clean = clean.replace(/([。！？；，])\s+/g, '$1')

    return clean.trim()
  }

  /**
   * 按段落分割文本
   */
  private splitIntoParagraphs(text: string): string[] {
    // 按双换行分割段落
    const paragraphs = text.split(/\n\s*\n/)

    return paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0)
  }

  /**
   * 执行智能分段
   */
  private performSmartSplitting(paragraphs: string[]): TextSegment[] {
    const segments: TextSegment[] = []
    let currentSegment = ''
    let segmentOrder = 0

    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index]
      const paragraphLength = this.measureLength(paragraph)
      const isLastParagraph = index === paragraphs.length - 1

      // 单个段落超长，先处理超长段落
      if (paragraphLength > this.maxLength) {
        if (currentSegment.trim().length > 0) {
          segments.push(this.createSegment(currentSegment, segmentOrder++))
          currentSegment = ''
        }

        const processedSegments = this.processOversizedContent(paragraph, segmentOrder, isLastParagraph)
        segments.push(...processedSegments)
        segmentOrder += processedSegments.length
        continue
      }

      if (currentSegment.length === 0) {
        // 当前段落为空，直接添加段落
        currentSegment = paragraph
      } else {
        // 检查添加当前段落是否会超过长度限制
        const combinedContent = currentSegment + '\n\n' + paragraph
        const potentialLength = this.measureLength(combinedContent)

        if (potentialLength <= this.maxLength) {
          // 不超过限制，合并到当前段落
          currentSegment = combinedContent
        } else {
          // 超过限制，需要处理当前段落
          if (this.measureLength(currentSegment) >= this.minLength) {
            // 当前段落长度足够，创建分段
            const segment = this.createSegment(currentSegment, segmentOrder++)
            segments.push(segment)
            currentSegment = paragraph
          } else {
            // 当前段落太短，尝试分割长段落
            const processedSegments = this.processOversizedContent(combinedContent, segmentOrder, isLastParagraph)
            segments.push(...processedSegments)
            segmentOrder += processedSegments.length
            currentSegment = ''
          }
        }
      }
    }

    // 处理最后一个段落
    if (currentSegment.trim().length > 0) {
      const segment = this.createSegment(currentSegment, segmentOrder++, 'final_segment')
      segments.push(segment)
    }

    return this.balanceSegmentLengths(segments)
  }

  /**
   * 使用动态规划在句子级别寻找最优分割
   */
  private segmentWithSentenceDP(text: string): TextSegment[] | null {
    const sentences = this.splitIntoSentenceInfos(text)
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
        const length = this.measureLength(segmentContent)
        const isLast = end === sentences.length - 1

        if (!isLast && length > this.maxLength) {
          break
        }

        const minRequirement = isLast ? 0 : this.minLength
        if (length < minRequirement) {
          continue
        }

        const rest = dfs(end + 1)
        if (rest) {
          plan = [{ start: index, end }, ...rest]
          break
        }
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
      return this.createSegment(content, order, breakReason)
    })
  }

  /**
   * 处理超长内容
   */
  private processOversizedContent(content: string, startOrder: number, allowFlexibleFinalSegment = false): TextSegment[] {
    const segments: TextSegment[] = []

    // 首先尝试按句子分割
    const sentences = this.splitIntoSentences(content)
    let currentSegment = ''
    let segmentOrder = startOrder

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim()
      if (!sentence) {
        continue
      }

      const candidate = currentSegment ? `${currentSegment} ${sentence}` : sentence
      const candidateLength = this.measureLength(candidate)
      const currentLength = this.measureLength(currentSegment)

      if (candidateLength <= this.maxLength) {
        const shouldFinalizeCurrent =
          currentSegment.length > 0 &&
          currentLength >= this.targetLength &&
          candidateLength > this.targetLength

        if (shouldFinalizeCurrent) {
          segments.push(this.createSegment(currentSegment, segmentOrder++, 'sentence_boundary'))
          currentSegment = sentence
        } else {
          currentSegment = candidate
        }
        continue
      }

      if (currentSegment.trim().length > 0) {
        if (currentLength >= this.minLength) {
          segments.push(this.createSegment(currentSegment, segmentOrder++, 'sentence_boundary'))
        } else {
          segments.push(this.createSegment(currentSegment, segmentOrder++, 'forced'))
        }
        currentSegment = ''
      }

      const sentenceLength = this.measureLength(sentence)
      if (sentenceLength <= this.maxLength) {
        currentSegment = sentence
      } else {
        // 句子本身太长，保留整句避免截断
        segments.push(this.createSegment(sentence, segmentOrder++, 'long_sentence'))
        currentSegment = ''
      }
    }

    // 处理剩余内容
    if (currentSegment.trim()) {
      const currentLength = this.measureLength(currentSegment)
      if (currentLength >= this.minLength || allowFlexibleFinalSegment) {
        const reason = allowFlexibleFinalSegment ? 'final_segment' : 'sentence_boundary'
        segments.push(this.createSegment(currentSegment, segmentOrder++, reason))
      } else if (segments.length > 0 && !allowFlexibleFinalSegment) {
        // 最后一段太短，尝试合并到前一段
        const lastSegment = segments[segments.length - 1]
        const mergedContent = `${lastSegment.content} ${currentSegment}`.trim()
        const mergedEffectiveLength = this.measureLength(mergedContent)

        if (mergedEffectiveLength <= this.maxLength) {
          lastSegment.content = mergedContent
          lastSegment.length = calculateSmartLength(mergedContent)
          lastSegment.metadata = {
            ...lastSegment.metadata,
            merged: true,
          }
        } else {
          // 无法合并，作为独立段落保存
          segments.push(this.createSegment(currentSegment, segmentOrder++, 'forced'))
        }
      } else {
        // 只有一个段落且很短，也保存
        segments.push(this.createSegment(
          currentSegment,
          segmentOrder++,
          allowFlexibleFinalSegment ? 'final_segment' : 'forced'
        ))
      }
    }

    return this.balanceSegmentLengths(segments)
  }

  /**
   * 平衡段落长度，确保均匀性
   */
  private balanceSegmentLengths(segments: TextSegment[]): TextSegment[] {
    if (segments.length <= 1) {
      return segments
    }

    const balancedSegments: TextSegment[] = []
    let i = 0

    while (i < segments.length) {
      const currentSegment = segments[i]
      const currentEffectiveLength = this.measureLength(currentSegment.content)

      // 如果当前段落长度在合理范围内，直接保留
      if (currentEffectiveLength >= this.minLength && currentEffectiveLength <= this.maxLength) {
        balancedSegments.push(currentSegment)
        i++
        continue
      }

      // 如果当前段落太短且不是最后一个段落，尝试与下一个段落合并
      if (currentSegment.length < this.minLength && i < segments.length - 1) {
        let consumedSegments = 1
        let combinedContent = currentSegment.content
        let combinedEffectiveLength = this.measureLength(combinedContent)
        let lastConsumedIndex = i

        while (combinedEffectiveLength < this.minLength && i + consumedSegments < segments.length) {
          const nextSegment = segments[i + consumedSegments]
          combinedContent = `${combinedContent} ${nextSegment.content}`.trim()
          combinedEffectiveLength = this.measureLength(combinedContent)
          lastConsumedIndex = i + consumedSegments
          consumedSegments++

          if (lastConsumedIndex === segments.length - 1) {
            break
          }
        }

        const reachedEnd = lastConsumedIndex === segments.length - 1

        if (consumedSegments > 1) {
          if (combinedEffectiveLength <= this.maxLength && !reachedEnd) {
            const mergedSegment: TextSegment = {
              content: combinedContent,
              length: calculateSmartLength(combinedContent),
              order: currentSegment.order,
              metadata: {
                ...currentSegment.metadata,
                breakReason: 'merged_for_balance',
                originalOrder: currentSegment.order,
                merged: true,
              }
            }
            balancedSegments.push(mergedSegment)
            i += consumedSegments
            continue
          } else {
            const rebalancedSegments = this.processOversizedContent(
              combinedContent,
              currentSegment.order,
              reachedEnd
            )

            if (rebalancedSegments.length > 0) {
              balancedSegments.push(...rebalancedSegments)
              i += consumedSegments
              continue
            }
          }
        }
      }

      // 如果当前段落太长，需要重新分割
      if (currentEffectiveLength > this.maxLength && currentSegment.metadata?.breakReason !== 'long_sentence') {
        const splitSegments = this.forceSplitLongText(currentSegment.content, currentSegment.order)
        balancedSegments.push(...splitSegments)
        i++
        continue
      }

      // 其他情况，直接保留
      balancedSegments.push(currentSegment)
      i++
    }

    return balancedSegments
  }

  /**
   * 按句子分割文本
   */
  private splitIntoSentenceInfos(text: string): SentenceInfo[] {
    const sentences: SentenceInfo[] = []
    let buffer = ''
    let sentenceStart = 0
    let capturing = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      if (!capturing) {
        sentenceStart = i
        capturing = true
      }

      buffer += char

      if (this.isSentenceTerminator(char)) {
        while (i + 1 < text.length && this.isSentenceTerminator(text[i + 1])) {
          buffer += text[++i]
        }

        while (i + 1 < text.length && /["'”’））》」】]/.test(text[i + 1])) {
          buffer += text[++i]
        }

        const sentenceText = buffer.trim()
        if (sentenceText.length > 0) {
          sentences.push({
            text: sentenceText,
            start: sentenceStart,
            end: i + 1,
          })
        }

        buffer = ''
        capturing = false
      }
    }

    if (buffer.trim().length > 0) {
      sentences.push({
        text: buffer.trim(),
        start: sentenceStart,
        end: text.length,
      })
    }

    return sentences
  }

  private splitIntoSentences(text: string): string[] {
    const sentences: string[] = []
    let buffer = ''

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      buffer += char

      if (this.isSentenceTerminator(char)) {
        // 向前收集连续的结束符，避免拆分例如？！或……
        while (i + 1 < text.length && this.isSentenceTerminator(text[i + 1])) {
          buffer += text[++i]
        }

        // 包含紧随其后的引号或括号
        while (i + 1 < text.length && /["'”’））》」】]/.test(text[i + 1])) {
          buffer += text[++i]
        }

        const sentence = buffer.trim()
        if (sentence.length > 0) {
          sentences.push(sentence)
        }
        buffer = ''
      }
    }

    if (buffer.trim().length > 0) {
      sentences.push(buffer.trim())
    }

    return sentences
  }

  private isSentenceTerminator(char: string): boolean {
    return /[。！？；.!?…]/.test(char)
  }

  /**
   * 强制分割长文本
   */
  private forceSplitLongText(text: string, startOrder: number): TextSegment[] {
    const segments: TextSegment[] = []
    let currentPosition = 0

    while (currentPosition < text.length) {
      let endPosition = Math.min(currentPosition + this.maxLength, text.length)

      // 尝试在标点符号处分割
      if (this.preferSentenceBoundary && endPosition < text.length) {
        const punctuationRegex = /[，。！？；：,.!?;:]/
        let bestBreakPoint = -1

        // 从endPosition向前寻找最近的标点符号
        for (let i = endPosition; i > currentPosition + this.minLength; i--) {
          if (punctuationRegex.test(text[i])) {
            bestBreakPoint = i + 1
            break
          }
        }

        if (bestBreakPoint > currentPosition) {
          endPosition = bestBreakPoint
        }
      }

      const segmentText = text.substring(currentPosition, endPosition)
      segments.push(this.createSegment(segmentText, startOrder + segments.length, 'forced'))
      currentPosition = endPosition
    }

    return segments
  }

  /**
   * 创建文本段
   */
  private createSegment(content: string, order: number, breakReason?: string): TextSegment {
    return {
      content: content.trim(),
      length: calculateSmartLength(content),
      order,
      metadata: {
        breakReason: breakReason as any,
      }
    }
  }

  /**
   * 调整段落长度，确保均匀性
   */
  private adjustSegmentLengths(segments: TextSegment[]): TextSegment[] {
    const adjustedSegments: TextSegment[] = []

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      // 检查长度是否在容差范围内
      if (segment.length < this.minLength || segment.length > this.maxLength) {
        // 尝试与相邻段落调整
        const adjusted = this.tryAdjustWithNeighbors(segment, segments, i)
        if (adjusted) {
          adjustedSegments.push(adjusted)
          // 跳过下一个段落（如果已合并）
          if (segment.metadata?.merged) {
            i++
          }
          continue
        }
      }

      adjustedSegments.push(segment)
    }

    return adjustedSegments
  }

  /**
   * 尝试与相邻段落调整长度
   */
  private tryAdjustWithNeighbors(
    segment: TextSegment,
    allSegments: TextSegment[],
    index: number
  ): TextSegment | null {
    const segmentEffectiveLength = this.measureLength(segment.content)

    // 如果段落太短
    if (segment.length < this.minLength && index + 1 < allSegments.length) {
      const nextSegment = allSegments[index + 1]
      const mergedContent = `${segment.content}\n\n${nextSegment.content}`.trim()
      const mergedEffectiveLength = this.measureLength(mergedContent)

      if (mergedEffectiveLength <= this.maxLength) {
        return {
          ...segment,
          content: mergedContent,
          length: calculateSmartLength(mergedContent),
          metadata: {
            ...segment.metadata,
            merged: true,
            originalIndex: index,
          }
        }
      }
    }

    // 如果段落太长且有下一个段落
    if (segmentEffectiveLength > this.maxLength && index + 1 < allSegments.length) {
      // 尝试重新分割
      const sentences = this.splitIntoSentences(segment.content)
      let currentSegment = ''

      for (const sentence of sentences) {
        const testLength = this.measureLength(currentSegment ? `${currentSegment} ${sentence}` : sentence)
        if (testLength <= this.targetLength) {
          currentSegment = currentSegment ? currentSegment + ' ' + sentence : sentence
        } else {
          break
        }
      }

      const candidateLength = this.measureLength(currentSegment)
      if (candidateLength >= this.minLength && candidateLength <= this.maxLength) {
        return {
          ...segment,
          content: currentSegment,
          length: calculateSmartLength(currentSegment),
          metadata: {
            ...segment.metadata,
            split: true,
            originalIndex: index,
          }
        }
      }
    }

    return null
  }
}

/**
 * 计算智能文本长度
 * 考虑中英文差异，中文字符计为1，英文单词计为0.5
 */
export function calculateSmartLength(text: string): number {
  // 移除多余空格和换行符进行计算
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // 中文字符和标点
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length

  // 英文单词
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length

  // 数字
  const numbers = (cleanText.match(/\d+/g) || []).length

  return chineseChars + Math.ceil(englishWords * 0.5) + numbers
}

/**
 * 使用默认配置的便捷函数
 */
export function splitTextSmartly(text: string, options?: SmartSplitterOptions): TextSegment[] {
  const splitter = new SmartTextSplitter(options)
  return splitter.split(text)
}

/**
 * 验证分段质量
 */
export function validateSegmentQuality(segments: TextSegment[], options?: SmartSplitterOptions): {
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
    ...options
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

    // 检查是否在句子中间截断
    if (segment.metadata?.breakReason === 'forced' &&
        !/[。！？；：.!?;:]\s*$/.test(segment.content)) {
      issues.push(`段落 ${segment.order} 可能在句子中间被截断`)
    }
  })

  const stats = {
    totalSegments: segments.length,
    avgLength: segments.length > 0 ? Math.round(totalLength / segments.length) : 0,
    minLength: Math.min(...segments.map(s => Math.max(s.length, s.content.trim().length))),
    maxLength: Math.max(...segments.map(s => Math.max(s.length, s.content.trim().length))),
    segmentsInRange,
  }

  const valid = issues.length === 0

  return { valid, issues, stats }
}

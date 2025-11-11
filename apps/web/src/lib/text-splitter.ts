/**
 * 递归字符文本分割器 (Recursive Character Text Splitter)
 * 
 * 灵感来自 LangChain 的 RecursiveCharacterTextSplitter
 * 使用递归方式按照优先级分隔符进行文本分割，确保段落大小合理
 */

import { CONFIG } from './constants'
import { logger } from './logger'

export interface TextSplitterOptions {
  chunkSize?: number           // 目标段落大小（字符数）
  chunkOverlap?: number        // 段落重叠大小（字符数）
  separators?: string[]        // 分隔符列表（按优先级排序）
  keepSeparator?: boolean      // 是否保留分隔符
  lengthFunction?: (text: string) => number  // 长度计算函数
}

export interface TextChunk {
  content: string
  metadata: {
    startIndex: number
    endIndex: number
    length: number
    separatorUsed?: string
  }
}

/**
 * 默认分隔符（按优先级从高到低）
 * 优先使用更大的语义单元进行分割
 */
const DEFAULT_SEPARATORS = [
  '\n\n\n',           // 多个空行（章节分隔）
  '\n\n',             // 双换行（段落分隔）
  '\n',               // 单换行（行分隔）
  '。',               // 中文句号
  '！',               // 中文感叹号
  '？',               // 中文问号
  '；',               // 中文分号
  '.',                // 英文句号
  '!',                // 英文感叹号
  '?',                // 英文问号
  ';',                // 英文分号
  '，',               // 中文逗号
  ',',                // 英文逗号
  ' ',                // 空格
  '',                 // 字符级别（最后的兜底方案）
]

/**
 * 递归字符文本分割器类
 */
export class RecursiveCharacterTextSplitter {
  private chunkSize: number
  private chunkOverlap: number
  private separators: string[]
  private keepSeparator: boolean
  private lengthFunction: (text: string) => number

  constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize || CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH
    this.chunkOverlap = options.chunkOverlap || Math.floor(this.chunkSize * 0.1) // 默认10%重叠
    this.separators = options.separators || DEFAULT_SEPARATORS
    this.keepSeparator = options.keepSeparator ?? true
    this.lengthFunction = options.lengthFunction || ((text: string) => text.length)

    // 验证参数
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be less than chunkSize')
    }

    logger.debug('RecursiveCharacterTextSplitter initialized', {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separatorsCount: this.separators.length,
    })
  }

  /**
   * 分割文本为段落
   */
  splitText(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const chunks = this._splitTextRecursive(text, this.separators)
    
    logger.info('Text split completed', {
      originalLength: text.length,
      chunksCount: chunks.length,
      avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length) : 0,
    })

    return chunks
  }

  /**
   * 分割文本并返回带元数据的段落
   */
  splitTextWithMetadata(text: string): TextChunk[] {
    const chunks = this.splitText(text)
    let currentIndex = 0

    return chunks.map((content) => {
      const startIndex = currentIndex
      const endIndex = startIndex + content.length
      currentIndex = endIndex

      return {
        content,
        metadata: {
          startIndex,
          endIndex,
          length: content.length,
        },
      }
    })
  }

  /**
   * 递归分割文本
   */
  private _splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = []

    // 选择当前使用的分隔符
    let separator = separators[separators.length - 1]
    let newSeparators: string[] = []

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i]
      if (s === '' || text.includes(s)) {
        separator = s
        newSeparators = separators.slice(i + 1)
        break
      }
    }

    // 使用当前分隔符分割文本
    const splits = this._splitTextWithSeparator(text, separator, this.keepSeparator)

    // 合并小段落
    let goodSplits: string[] = []
    const _separator = this.keepSeparator ? '' : separator

    for (const s of splits) {
      const length = this.lengthFunction(s)

      if (length < this.chunkSize) {
        goodSplits.push(s)
      } else {
        // 如果有累积的小段落，先合并它们
        if (goodSplits.length > 0) {
          const mergedSplits = this._mergeSplits(goodSplits, _separator)
          finalChunks.push(...mergedSplits)
          goodSplits = []
        }

        // 如果当前段落仍然太大，且还有更细粒度的分隔符，继续递归分割
        if (newSeparators.length === 0) {
          finalChunks.push(s)
        } else {
          const otherInfo = this._splitTextRecursive(s, newSeparators)
          finalChunks.push(...otherInfo)
        }
      }
    }

    // 处理剩余的小段落
    if (goodSplits.length > 0) {
      const mergedSplits = this._mergeSplits(goodSplits, _separator)
      finalChunks.push(...mergedSplits)
    }

    return finalChunks
  }

  /**
   * 使用指定分隔符分割文本
   */
  private _splitTextWithSeparator(
    text: string,
    separator: string,
    keepSeparator: boolean
  ): string[] {
    if (separator === '') {
      // 字符级别分割
      return text.split('')
    }

    let splits: string[]

    if (keepSeparator) {
      // 保留分隔符
      const parts = text.split(separator)
      splits = []
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) {
          splits.push(parts[i] + separator)
        } else if (parts[i]) {
          splits.push(parts[i])
        }
      }
    } else {
      splits = text.split(separator)
    }

    return splits.filter(s => s.length > 0)
  }

  /**
   * 合并小段落
   */
  private _mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = []
    const currentDoc: string[] = []
    let total = 0

    for (const d of splits) {
      const length = this.lengthFunction(d)

      // 如果加入当前段落会超过大小限制
      if (total + length + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize) {
        if (total > this.chunkSize) {
          logger.warn('Created chunk larger than specified size', {
            chunkSize: this.chunkSize,
            actualSize: total,
          })
        }

        if (currentDoc.length > 0) {
          const doc = this._joinDocs(currentDoc, separator)
          if (doc) {
            docs.push(doc)
          }

          // 保持重叠
          while (
            total > this.chunkOverlap ||
            (total + length + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize &&
              total > 0)
          ) {
            total -= this.lengthFunction(currentDoc[0]) + (currentDoc.length > 1 ? separator.length : 0)
            currentDoc.shift()
          }
        }
      }

      currentDoc.push(d)
      total += length + (currentDoc.length > 1 ? separator.length : 0)
    }

    // 添加最后一个段落
    const doc = this._joinDocs(currentDoc, separator)
    if (doc) {
      docs.push(doc)
    }

    return docs
  }

  /**
   * 连接文档片段
   */
  private _joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim()
    return text.length > 0 ? text : null
  }
}

/**
 * 创建默认的文本分割器
 */
export function createTextSplitter(options?: TextSplitterOptions): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter(options)
}

/**
 * 快速分割文本（使用默认配置）
 */
export function splitText(text: string, chunkSize?: number): string[] {
  const splitter = createTextSplitter({ chunkSize })
  return splitter.splitText(text)
}

/**
 * 智能分割文本（根据内容类型选择最佳策略）
 */
export function smartSplitText(
  text: string,
  options: {
    contentType?: 'novel' | 'article' | 'dialogue' | 'general'
    chunkSize?: number
    chunkOverlap?: number
  } = {}
): string[] {
  const { contentType = 'general', chunkSize, chunkOverlap } = options

  let separators: string[]

  switch (contentType) {
    case 'novel':
      // 小说：优先按章节、段落分割
      separators = [
        '\n\n\n',
        '\n\n',
        '。"',
        '！"',
        '？"',
        '。',
        '！',
        '？',
        '\n',
        '；',
        '，',
        ' ',
        '',
      ]
      break

    case 'dialogue':
      // 对话：优先保持对话完整性
      separators = [
        '\n\n',
        '。"',
        '！"',
        '？"',
        '"',
        '\n',
        '。',
        '！',
        '？',
        '，',
        ' ',
        '',
      ]
      break

    case 'article':
      // 文章：优先按段落、句子分割
      separators = [
        '\n\n',
        '\n',
        '。',
        '！',
        '？',
        '.',
        '!',
        '?',
        '；',
        ';',
        '，',
        ',',
        ' ',
        '',
      ]
      break

    default:
      // 通用：使用默认分隔符
      separators = DEFAULT_SEPARATORS
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators,
    keepSeparator: true,
  })

  return splitter.splitText(text)
}

/**
 * 计算文本的智能长度（考虑中英文差异）
 */
export function calculateTextLength(text: string): number {
  // 中文字符计为1，英文单词计为0.5
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  
  return chineseChars + Math.ceil(englishWords * 0.5)
}

import { Prisma } from '@/generated/prisma'
import { FileProcessingError } from './error-handler'

export interface TextProcessingOptions {
  maxSegmentLength?: number
  minSegmentLength?: number
  preserveFormatting?: boolean
  encoding?: BufferEncoding
}

export interface ProcessedText {
  content: string
  wordCount: number
  characterCount: number
  encoding: string
  detectedFormat: 'txt' | 'md'
}

export interface TextSegmentData {
  order: number
  content: string
  wordCount: number
  type: 'paragraph' | 'dialogue' | 'scene' | 'chapter'
  metadata?: Record<string, any>
}

/**
 * 检测文本编码
 */
export function detectEncoding(buffer: Buffer): BufferEncoding {
  const encodings: BufferEncoding[] = ['utf8', 'utf16le', 'latin1']

  for (const encoding of encodings) {
    try {
      const decoded = buffer.toString(encoding)
      // 检查是否包含乱码字符
      if (!decoded.includes('�') && decoded.trim().length > 0) {
        // 检查是否是合理的文本内容
        if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(decoded) || // 中文字符
            /[a-zA-Z]/.test(decoded)) { // 英文字符
          return encoding
        }
      }
    } catch (error) {
      continue
    }
  }

  return 'utf8' // 默认返回UTF-8
}

/**
 * 清洗文本内容
 */
export function cleanText(text: string, options: TextProcessingOptions = {}): string {
  const { preserveFormatting = true } = options

  let cleaned = text

  // 移除BOM标记
  cleaned = cleaned.replace(/^\uFEFF/, '')

  if (!preserveFormatting) {
    // 标准化换行符
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // 移除多余的空白字符
    cleaned = cleaned.replace(/[ \t]+/g, ' ')
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

    // 移除首尾空白
    cleaned = cleaned.trim()
  } else {
    // 保持格式的情况下，只标准化换行符
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }

  return cleaned
}

/**
 * 检测文件格式
 */
export function detectFileFormat(filename: string, content: string): 'txt' | 'md' {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'))

  if (extension === '.md') {
    return 'md'
  }

  // 检查内容是否包含Markdown标记
  const markdownPatterns = [
    /^#{1,6}\s+/m, // 标题
    /\*\*.*?\*\*/, // 粗体
    /\*.*?\*/, // 斜体
    /\[.*?\]\(.*?\)/, // 链接
    /^[-*+]\s+/m, // 列表
    /^\d+\.\s+/m, // 有序列表
    /```[\s\S]*?```/, // 代码块
  ]

  for (const pattern of markdownPatterns) {
    if (pattern.test(content)) {
      return 'md'
    }
  }

  return 'txt'
}

/**
 * 处理上传的文件内容
 */
export function processFileContent(
  buffer: Buffer,
  filename: string,
  options: TextProcessingOptions = {}
): ProcessedText {
  // 检测编码
  const encoding = options.encoding || detectEncoding(buffer)

  // 解码内容
  let content = buffer.toString(encoding)

  // 检测格式
  const detectedFormat = detectFileFormat(filename, content)

  // 清洗文本
  content = cleanText(content, options)

  // 验证内容
  if (!content.trim()) {
    throw new FileProcessingError(
      '文件内容为空',
      'CORRUPTED_FILE',
      { message: '文件不包含任何有效文本内容' }
    )
  }

  // 统计信息
  const characterCount = content.length
  const wordCount = countWords(content)

  return {
    content,
    wordCount,
    characterCount,
    encoding,
    detectedFormat
  }
}

/**
 * 统计字数（支持中英文混合）
 */
export function countWords(text: string): number {
  // 移除HTML标签和Markdown标记
  const cleanText = text
    .replace(/<[^>]*>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 移除链接，保留文本
    .replace(/#{1,6}\s+/g, '') // 移除标题标记
    .replace(/\*\*([^*]*)\*\*/g, '$1') // 移除粗体标记
    .replace(/\*([^*]*)\*/g, '$1') // 移除斜体标记

  // 中文字符计数
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length

  // 英文单词计数
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length

  return chineseChars + englishWords
}

/**
 * 智能文本分割
 */
export function segmentText(
  content: string,
  options: TextProcessingOptions = {}
): TextSegmentData[] {
  const {
    maxSegmentLength = 1000,
    minSegmentLength = 50
  } = options

  const segments: TextSegmentData[] = []

  // 按段落分割
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)

  let currentSegment = ''
  let segmentOrder = 0

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()

    // 如果当前段落加入后超过最大长度，先保存当前段落
    if (currentSegment && currentSegment.length + trimmedParagraph.length > maxSegmentLength) {
      if (currentSegment.length >= minSegmentLength) {
        segments.push(createTextSegment(currentSegment, segmentOrder++))
        currentSegment = trimmedParagraph
      } else {
        // 如果当前段落太短，强制合并
        currentSegment += '\n\n' + trimmedParagraph
      }
    } else {
      if (currentSegment) {
        currentSegment += '\n\n' + trimmedParagraph
      } else {
        currentSegment = trimmedParagraph
      }
    }
  }

  // 处理最后一个段落
  if (currentSegment && currentSegment.length >= minSegmentLength) {
    segments.push(createTextSegment(currentSegment, segmentOrder))
  }

  return segments
}

/**
 * 创建文本段落数据
 */
function createTextSegment(content: string, order: number): TextSegmentData {
  const type = detectSegmentType(content)
  const wordCount = countWords(content)

  return {
    order,
    content: content.trim(),
    wordCount,
    type,
    metadata: {
      characterCount: content.length,
      hasDialogue: /[""「」].*?[""「」]/.test(content),
      hasDescription: /[，。！？；：]/.test(content)
    }
  }
}

/**
 * 检测段落类型
 */
function detectSegmentType(content: string): 'paragraph' | 'dialogue' | 'scene' | 'chapter' {
  // 检测章节标题
  if (/^第[一二三四五六七八九十百千万\d]+[章节卷篇部]/.test(content) ||
      /^Chapter\s+\d+/i.test(content) ||
      /^#{1,3}\s+/.test(content)) {
    return 'chapter'
  }

  // 检测场景描述
  if (/^(场景|地点|时间|环境|室内|室外)/.test(content) ||
      /^\[.*?\]$/.test(content) ||
      content.includes('场景：') || content.includes('环境：')) {
    return 'scene'
  }

  // 检测对话
  const dialogueCount = (content.match(/[""「」]/g) || []).length
  const totalChars = content.length
  if (dialogueCount > 0 && dialogueCount / totalChars > 0.1) {
    return 'dialogue'
  }

  return 'paragraph'
}

/**
 * 从文件创建文本段落记录
 */
export function createTextSegmentRecords(
  bookId: string,
  segments: TextSegmentData[]
): Prisma.TextSegmentCreateManyInput[] {
  let currentPosition = 0

  return segments.map((segment, index) => {
    const content = segment.content
    const startPosition = currentPosition
    const endPosition = currentPosition + content.length
    currentPosition = endPosition

    return {
      bookId,
      segmentIndex: index,
      startPosition,
      endPosition,
      content: segment.content,
      wordCount: segment.wordCount,
      segmentType: segment.type,
      orderIndex: segment.order,
      metadata: (segment.metadata || {}) as Prisma.InputJsonValue,
      status: 'pending'
    }
  })
}

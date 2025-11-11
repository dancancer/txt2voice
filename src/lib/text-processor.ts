import { Prisma } from '@/generated/prisma'
import { FileProcessingError } from './error-handler'
import { smartSplitText, calculateTextLength, RecursiveCharacterTextSplitter } from './text-splitter'
import { logger } from './logger'
import * as iconv from 'iconv-lite'

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
 * 支持 UTF-8, GBK, GB2312, UTF-16LE, UTF-16BE 等常见编码
 */
export function detectEncoding(buffer: Buffer): string {
  // 检查 BOM 标记
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    logger.debug('Detected UTF-8 BOM')
    return 'utf8'
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    logger.debug('Detected UTF-16LE BOM')
    return 'utf16le'
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    logger.debug('Detected UTF-16BE BOM')
    return 'utf16be'
  }

  // 尝试不同的编码
  const encodings = [
    { name: 'utf8', decoder: (buf: Buffer) => buf.toString('utf8') },
    { name: 'gbk', decoder: (buf: Buffer) => iconv.decode(buf, 'gbk') },
    { name: 'gb2312', decoder: (buf: Buffer) => iconv.decode(buf, 'gb2312') },
    { name: 'utf16le', decoder: (buf: Buffer) => buf.toString('utf16le') },
    { name: 'big5', decoder: (buf: Buffer) => iconv.decode(buf, 'big5') },
  ]

  let bestEncoding = 'utf8'
  let bestScore = 0

  for (const { name, decoder } of encodings) {
    try {
      const decoded = decoder(buffer)
      
      // 跳过空内容
      if (!decoded || decoded.trim().length === 0) {
        continue
      }

      // 计算得分
      let score = 0
      
      // 检查是否有乱码
      const hasGarbage = decoded.includes('�') || decoded.includes('\ufffd')
      if (hasGarbage) {
        continue // 有乱码，跳过
      }
      score += 10

      // 检查中文字符
      const chineseChars = (decoded.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
      if (chineseChars > 0) {
        score += chineseChars / decoded.length * 100
      }

      // 检查英文字符
      const englishChars = (decoded.match(/[a-zA-Z]/g) || []).length
      if (englishChars > 0) {
        score += englishChars / decoded.length * 10
      }

      // 检查常见标点符号
      const punctuation = (decoded.match(/[，。！？；：""''（）【】《》、]/g) || []).length
      if (punctuation > 0) {
        score += punctuation / decoded.length * 50
      }

      // 检查是否有不可打印字符（除了换行、制表符）
      const unprintable = (decoded.match(/[^\x09\x0A\x0D\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length
      if (unprintable > decoded.length * 0.1) {
        score -= 50 // 太多不可打印字符，降低得分
      }

      logger.debug('Encoding detection', {
        encoding: name,
        score,
        chineseChars,
        englishChars,
        punctuation,
        unprintable,
        preview: decoded.slice(0, 50)
      })

      if (score > bestScore) {
        bestScore = score
        bestEncoding = name
      }
    } catch (error) {
      logger.debug('Encoding detection failed', { encoding: name, error })
      continue
    }
  }

  logger.info('Detected encoding', { encoding: bestEncoding, score: bestScore })
  return bestEncoding
}

/**
 * 清洗文本内容
 */
export function cleanText(text: string, options: TextProcessingOptions = {}): string {
  const { preserveFormatting = true } = options

  let cleaned = text

  // 移除BOM标记
  cleaned = cleaned.replace(/^\uFEFF/, '')

  // 移除 NULL 字符和其他控制字符（保留换行、制表符、回车）
  cleaned = cleaned.replace(/\0/g, '')
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

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

  // 规范化 Unicode
  cleaned = cleaned.normalize('NFC')

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

  logger.info('Processing file content', { 
    filename, 
    encoding, 
    bufferSize: buffer.length 
  })

  // 解码内容
  let content: string
  if (encoding === 'gbk' || encoding === 'gb2312' || encoding === 'big5') {
    // 使用 iconv-lite 解码
    content = iconv.decode(buffer, encoding)
  } else {
    // 使用 Node.js 内置解码
    content = buffer.toString(encoding as BufferEncoding)
  }

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

  logger.info('File content processed', {
    encoding,
    detectedFormat,
    characterCount,
    wordCount,
  })

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
 * 智能文本分割（使用递归字符分割）
 */
export function segmentText(
  content: string,
  options: TextProcessingOptions = {}
): TextSegmentData[] {
  const {
    maxSegmentLength = 1000,
    minSegmentLength = 50
  } = options

  logger.info('Starting text segmentation', {
    contentLength: content.length,
    maxSegmentLength,
    minSegmentLength,
  })

  // 检测内容类型
  const contentType = detectContentType(content)
  logger.debug('Content type detected', { contentType })

  // 使用智能分割
  const chunks = smartSplitText(content, {
    contentType,
    chunkSize: maxSegmentLength,
    chunkOverlap: Math.floor(maxSegmentLength * 0.05), // 5% 重叠
  })

  // 过滤太短的段落并创建段落数据
  const segments: TextSegmentData[] = []
  let segmentOrder = 0

  for (const chunk of chunks) {
    const length = calculateTextLength(chunk)
    
    // 只保留长度符合要求的段落
    if (length >= minSegmentLength) {
      segments.push(createTextSegment(chunk, segmentOrder++))
    } else if (segments.length > 0) {
      // 如果段落太短，尝试合并到上一个段落
      const lastSegment = segments[segments.length - 1]
      const mergedContent = lastSegment.content + '\n\n' + chunk
      const mergedLength = calculateTextLength(mergedContent)
      
      if (mergedLength <= maxSegmentLength * 1.2) { // 允许超出20%
        lastSegment.content = mergedContent
        lastSegment.wordCount = countWords(mergedContent)
        lastSegment.metadata = {
          ...lastSegment.metadata,
          characterCount: mergedContent.length,
          merged: true,
        }
      } else {
        // 如果合并后太长，作为独立段落保留
        segments.push(createTextSegment(chunk, segmentOrder++))
      }
    } else {
      // 第一个段落即使很短也保留
      segments.push(createTextSegment(chunk, segmentOrder++))
    }
  }

  logger.info('Text segmentation completed', {
    totalSegments: segments.length,
    avgSegmentLength: segments.length > 0 
      ? Math.round(segments.reduce((sum, s) => sum + s.content.length, 0) / segments.length)
      : 0,
  })

  return segments
}

/**
 * 创建文本段落数据
 */
function createTextSegment(content: string, order: number): TextSegmentData {
  // 清理内容
  const cleanedContent = content.trim()
  const type = detectSegmentType(cleanedContent)
  const wordCount = countWords(cleanedContent)

  return {
    order,
    content: cleanedContent,
    wordCount,
    type,
    metadata: {
      characterCount: cleanedContent.length,
      hasDialogue: /[""「」].*?[""「」]/.test(cleanedContent),
      hasDescription: /[，。！？；：]/.test(cleanedContent)
    }
  }
}

/**
 * 检测内容类型
 */
function detectContentType(content: string): 'novel' | 'article' | 'dialogue' | 'general' {
  const dialogueRatio = (content.match(/[""「」]/g) || []).length / content.length
  const chapterMarkers = (content.match(/第[一二三四五六七八九十百千万\d]+[章节卷篇部]/g) || []).length
  
  // 如果有大量对话标记，判定为对话
  if (dialogueRatio > 0.05) {
    return 'dialogue'
  }
  
  // 如果有章节标记，判定为小说
  if (chapterMarkers > 0) {
    return 'novel'
  }
  
  // 如果段落较多且规整，判定为文章
  const paragraphs = content.split(/\n\s*\n/).length
  if (paragraphs > 5 && content.length / paragraphs < 500) {
    return 'article'
  }
  
  return 'general'
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
 * 清理文本内容，移除可能导致数据库错误的特殊字符
 */
function sanitizeContent(content: string): string {
  const originalLength = content.length
  
  // 移除或替换可能导致 Prisma 解析错误的字符
  const cleaned = content
    // 移除 NULL 字符
    .replace(/\0/g, '')
    // 移除其他控制字符（保留换行、制表符）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 规范化 Unicode
    .normalize('NFC')
  
  const removedCount = originalLength - cleaned.length
  
  if (removedCount > 0) {
    logger.debug('Sanitized content', {
      originalLength,
      cleanedLength: cleaned.length,
      removedCount,
      preview: content.slice(0, 50) + '...'
    })
  }
  
  return cleaned
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
    // 清理内容，避免特殊字符导致数据库错误
    const sanitizedContent = sanitizeContent(segment.content)
    const startPosition = currentPosition
    const endPosition = currentPosition + sanitizedContent.length
    currentPosition = endPosition

    return {
      bookId,
      segmentIndex: index,
      startPosition,
      endPosition,
      content: sanitizedContent,
      wordCount: segment.wordCount,
      segmentType: segment.type,
      orderIndex: segment.order,
      metadata: (segment.metadata || {}) as Prisma.InputJsonValue,
      status: 'pending'
    }
  })
}

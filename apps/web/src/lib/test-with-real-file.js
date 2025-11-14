/**
 * 使用真实测试文件测试智能分段器
 */

const fs = require('fs')
const path = require('path')

// 读取真实测试文件并转换编码
const testFilePath = path.join(__dirname, '../../../../docs/test.txt')
const buffer = fs.readFileSync(testFilePath)

// 使用 iconv-lite 转换 GBK 到 UTF-8（如果可用），否则使用 Node.js 内置方法
let testText
try {
  // 尝试使用 iconv-lite
  const iconv = require('iconv-lite')
  testText = iconv.decode(buffer, 'gbk')
} catch (e) {
  // 如果 iconv-lite 不可用，尝试简单的 GBK 解码
  testText = buffer.toString('binary')
    // 尝试修复常见的编码问题
    .replace(/Â/g, '')
    .replace(/\uFFFD/g, '')
}

console.log('=== 使用真实测试文件进行分段测试 ===')
console.log('文件路径:', testFilePath)
console.log('文件大小:', testText.length, '字符')

// 简单的长度计算函数
function calculateLength(text) {
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // 中文字符和标点
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length

  // 英文单词
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length

  // 数字
  const numbers = (cleanText.match(/\d+/g) || []).length

  return chineseChars + Math.ceil(englishWords * 0.5) + numbers
}

// 智能分段器
function smartSplitter(text, maxLength = 500, targetLength = 400, minLength = 100) {
  // 清理文本
  let cleanText = text
  // 移除控制字符但保留换行
  cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  // 标准化换行符
  cleanText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 按段落分割
  const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  let segments = []

  // 第一步：将内容拆分成句子
  const allSentences = []
  paragraphs.forEach(paragraph => {
    const sentences = paragraph.match(/[^。！？；.!?;]+[。！？；.!?;]*/g) || [paragraph]
    allSentences.push(...sentences.map(s => s.trim()))
  })

  if (allSentences.length === 0) return []

  // 第二步：重新组合句子成段落
  let currentSegment = []
  let currentLength = 0

  for (const sentence of allSentences) {
    const sentenceLength = calculateLength(sentence)

    // 如果添加这个句子会超过最大长度
    if (currentLength + sentenceLength > maxLength) {
      // 保存当前段落
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(' '))
      }

      // 处理当前句子
      if (sentenceLength > maxLength) {
        // 强制分割长句子
        const splitSentence = forceSplitSentence(sentence, maxLength)
        segments.push(...splitSentence)
        currentSegment = []
        currentLength = 0
      } else {
        currentSegment = [sentence]
        currentLength = sentenceLength
      }
    } else {
      currentSegment.push(sentence)
      currentLength += sentenceLength
    }
  }

  // 添加最后一个段落
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(' '))
  }

  // 第三步：修复短段落
  segments = fixShortSegments(segments, minLength, maxLength)

  return segments
}

// 强制分割句子
function forceSplitSentence(sentence, maxLength) {
  const segments = []
  const chars = sentence.split('')
  let current = ''

  for (const char of chars) {
    if (calculateLength(current + char) > maxLength) {
      if (current) {
        segments.push(current)
        current = char
      }
    } else {
      current += char
    }
  }

  if (current) {
    segments.push(current)
  }

  return segments
}

// 修复短段落
function fixShortSegments(segments, minLength, maxLength) {
  if (segments.length <= 1) {
    return segments
  }

  const result = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const length = calculateLength(segment)

    // 如果当前段落太短且不是最后一个段落
    if (length < minLength && i < segments.length - 1) {
      // 尝试与下一个段落合并
      const nextSegment = segments[i + 1]
      const mergedLength = length + calculateLength(nextSegment) + 1

      if (mergedLength <= maxLength) {
        result.push(segment + ' ' + nextSegment)
        i++ // 跳过下一个段落
      } else {
        // 无法合并，但仍添加当前段落
        result.push(segment)
      }
    } else {
      // 段落长度合适或者是最后一个段落
      result.push(segment)
    }
  }

  // 最后检查：如果最后一个段落太短，尝试与前一个合并
  if (result.length > 1) {
    const lastSegment = result[result.length - 1]
    const lastLength = calculateLength(lastSegment)

    if (lastLength < minLength) {
      const secondLastSegment = result[result.length - 2]
      const mergedLength = calculateLength(secondLastSegment + ' ' + lastSegment)

      if (mergedLength <= maxLength) {
        result[result.length - 2] = secondLastSegment + ' ' + lastSegment
        result.pop() // 移除最后一个段落
      }
    }
  }

  return result
}

// 执行分段测试
const segments = smartSplitter(testText, 500, 400, 100)

console.log('\n=== 分段结果 ===')
console.log(`总段落数: ${segments.length}`)

segments.forEach((segment, index) => {
  const length = calculateLength(segment)
  console.log(`\n段落 ${index + 1}:`)
  console.log(`  长度: ${length} 字`)
  console.log(`  状态: ${length >= 100 && length <= 500 ? '✓ 合格' : '✗ 不合格'}`)
  console.log(`  内容前100字: ${segment.substring(0, 100).replace(/\n/g, '\\n')}...`)
})

// 统计分析
const lengths = segments.map(calculateLength)
const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
const minLength = Math.min(...lengths)
const maxLength = Math.max(...lengths)
const segmentsInRange = lengths.filter(l => l >= 300 && l <= 500).length

console.log('\n=== 统计分析 ===')
console.log(`平均长度: ${avgLength} 字`)
console.log(`最短段落: ${minLength} 字`)
console.log(`最长段落: ${maxLength} 字`)
console.log(`在300-500字范围内的段落: ${segmentsInRange}/${segments.length} (${Math.round(segmentsInRange/segments.length*100)}%)`)

// 质量检查
console.log('\n=== 质量检查 ===')
const allUnderLimit = lengths.every(length => length <= 500)
const allAboveMin = lengths.every(length => length >= 100)

console.log(`所有段落都在500字以内: ${allUnderLimit ? '✓' : '✗'}`)
console.log(`所有段落都在100字以上: ${allAboveMin ? '✓' : '✗'}`)
console.log(`分段均匀性 (正负不超过100字): ${segmentsInRange/segments.length >= 0.7 ? '✓' : '✗'}`)

// 详细分段长度报告
console.log('\n=== 详细分段长度报告 ===')
lengths.forEach((length, index) => {
  const status = length >= 100 && length <= 500 ? '✓' : '✗'
  const range = length >= 300 && length <= 500 ? '目标范围' : length < 100 ? '太短' : '太长'
  console.log(`段落${(index+1).toString().padStart(2)}: ${length.toString().padStart(3)}字 ${status} (${range})`)
})
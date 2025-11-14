/**
 * 简单的文本分段测试
 */

// 创建测试文本
const testText = `
这是第一段测试内容。这段文字用来测试智能分段器的功能。

这是第二段。我们希望分段器能够在合适的时机分割文本，不要在句子中间截断。

这是第三段，内容稍长一些。测试一下当文本比较长的时候，分段器会如何处理。我们需要确保每段都在500字以内，而且分段比较均匀。

这是第四段，继续测试功能。一个好的分段器应该能够理解句子的边界，优先在句号、感叹号、问号等标点符号处进行分割。

这是第五段。我们还需要测试混合文本的情况，包括中英文混合的情况。This is English text mixed with Chinese.

这是第六段。我们来增加一些对话内容："你好，"他说，"今天天气真好。"是的，"她回答，"很适合出去走走。"

这是第七段，内容最长，用来测试分段器的处理能力。如果一段内容太长，超过了最大长度限制，分段器应该能够在合适的位置将其分割成多个段落，而不是简单地按照字符数切割。这样能够保持语义的完整性，让每一段都是完整的意思表达。这对于后续的文本处理非常重要，特别是对于语音合成等应用场景。

这是第八段，继续增加内容。我们需要验证分段器在各种情况下都能正常工作，包括不同的文本类型、不同的长度分布等。一个好的分段算法应该既简单又有效，能够处理大多数实际情况。

这是第九段。最后一段，用来总结测试。通过这些测试，我们可以确保分段器的质量满足要求。
`

// 简单的长度计算函数
function calculateLength(text) {
  // 移除多余空格和换行
  const cleanText = text.replace(/\s+/g, ' ').trim()

  // 中文字符和标点
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length

  // 英文单词
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length

  // 数字
  const numbers = (cleanText.match(/\d+/g) || []).length

  return chineseChars + Math.ceil(englishWords * 0.5) + numbers
}

// 修复的智能分段器
function smartSplitter(text, maxLength = 500, targetLength = 400, minLength = 100) {
  // 先按段落分割
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
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
      // 保存当前段落（如果不为空）
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(' '))
      }

      // 如果单个句子就超过最大长度，强制分割
      if (sentenceLength > maxLength) {
        const splitSentence = forceSplitSentence(sentence, maxLength)
        segments.push(...splitSentence)
        currentSegment = []
        currentLength = 0
      } else {
        currentSegment = [sentence]
        currentLength = sentenceLength
      }
    } else {
      // 可以添加到当前段落
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

  // 第四步：最终检查，确保没有太短的段落
  if (segments.length > 1) {
    const lastSegment = segments[segments.length - 1]
    const lastLength = calculateLength(lastSegment)

    console.log(`调试信息: 最后段落长度=${lastLength}, 最小长度=${minLength}`)
    console.log(`最后段落内容: "${lastSegment}"`)

    if (lastLength < minLength) {
      // 最后一个段落太短，尝试与前一个段落合并
      const secondLastSegment = segments[segments.length - 2]
      const mergedLength = calculateLength(secondLastSegment + ' ' + lastSegment)

      console.log(`调试信息: 合并后长度=${mergedLength}, 最大长度=${maxLength}`)

      if (mergedLength <= maxLength) {
        console.log(`合并成功！`)
        segments[segments.length - 2] = secondLastSegment + ' ' + lastSegment
        segments.pop() // 移除最后一个段落
      } else {
        console.log(`合并失败，合并后长度${mergedLength}超过最大长度${maxLength}`)
      }
    }
  }

  return segments
}

// 强制分割句子
function forceSplitSentence(sentence, maxLength) {
  const segments = []
  const words = sentence.split('')
  let current = ''

  for (const char of words) {
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

// 修复短段落 - 简化版本
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
      const mergedLength = length + calculateLength(nextSegment) + 1 // +1 for space

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

  return result
}

// 分割过长的段落
function splitLongParagraph(paragraph, maxLength, targetLength, minLength) {
  // 按句子分割
  const sentences = paragraph.split(/[。！？；.!?;]+/).filter(s => s.trim().length > 0)
  const segments = []
  let currentSegment = ''

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim()
    const sentenceWithPunctuation = sentence + getOriginalPunctuation(paragraph, i)

    if (currentSegment.length === 0) {
      currentSegment = sentenceWithPunctuation
    } else {
      const potentialLength = calculateLength(currentSegment + ' ' + sentenceWithPunctuation)

      if (potentialLength <= targetLength) {
        currentSegment += ' ' + sentenceWithPunctuation
      } else {
        const currentLength = calculateLength(currentSegment)
        if (currentLength >= minLength) {
          segments.push(currentSegment.trim())
          currentSegment = sentenceWithPunctuation
        } else {
          // 当前段落太短，尝试合并
          if (potentialLength <= maxLength) {
            currentSegment += ' ' + sentenceWithPunctuation
          } else {
            segments.push(currentSegment.trim())
            currentSegment = sentenceWithPunctuation
          }
        }
      }
    }
  }

  // 处理最后一个句子
  if (currentSegment.length > 0) {
    const currentLength = calculateLength(currentSegment)
    if (currentLength < minLength && segments.length > 0) {
      // 尝试合并到前一段
      const lastSegment = segments[segments.length - 1]
      const mergedLength = calculateLength(lastSegment + ' ' + currentSegment)

      if (mergedLength <= maxLength) {
        segments[segments.length - 1] = lastSegment + ' ' + currentSegment
      } else {
        segments.push(currentSegment.trim())
      }
    } else {
      segments.push(currentSegment.trim())
    }
  }

  return segments
}

// 获取原始标点符号
function getOriginalPunctuation(text, sentenceIndex) {
  const sentences = text.match(/[^。！？；.!?;]+[。！？；.!?;]*/g) || []
  if (sentenceIndex < sentences.length) {
    const sentence = sentences[sentenceIndex]
    const punctuation = sentence.match(/[。！？；.!?;]$/)
    return punctuation ? punctuation[0] : ''
  }
  return ''
}

console.log('=== 智能文本分段测试 ===')
console.log('原始文本长度:', calculateLength(testText))

const segments = smartSplitter(testText, 500, 400, 100)

console.log('分段结果:')
console.log(`总段落数: ${segments.length}`)

segments.forEach((segment, index) => {
  const length = calculateLength(segment)
  console.log(`\n段落 ${index + 1}:`)
  console.log(`  长度: ${length} 字`)
  console.log(`  内容: ${segment.substring(0, 80)}...`)
})

// 统计分析
const lengths = segments.map(calculateLength)
const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
const minLength = Math.min(...lengths)
const maxLength = Math.max(...lengths)

console.log('\n=== 统计分析 ===')
console.log(`平均长度: ${avgLength} 字`)
console.log(`最短段落: ${minLength} 字`)
console.log(`最长段落: ${maxLength} 字`)

// 检查是否符合要求
console.log('\n=== 质量检查 ===')
const allUnderLimit = lengths.every(length => length <= 500)
console.log(`所有段落都在500字以内: ${allUnderLimit ? '✓' : '✗'}`)

const segmentsInRange = lengths.filter(length => length >= 300 && length <= 500).length
const rangePercentage = Math.round((segmentsInRange / segments.length) * 100)
console.log(`在300-500字范围内的段落比例: ${rangePercentage}%`)

console.log('分段均匀性检查:')
lengths.forEach((length, index) => {
  const status = length >= 300 && length <= 500 ? '✓' : '⚠'
  console.log(`  段落${index + 1}: ${length}字 ${status}`)
})
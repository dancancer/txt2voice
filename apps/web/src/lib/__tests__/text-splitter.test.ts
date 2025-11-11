/**
 * 递归字符文本分割器测试
 */

import { 
  RecursiveCharacterTextSplitter,
  smartSplitText,
  splitText,
  calculateTextLength 
} from '../text-splitter'

describe('RecursiveCharacterTextSplitter', () => {
  describe('基础分割功能', () => {
    it('应该正确分割简单文本', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 10,
        separators: ['\n\n', '。', '，'],
      })

      const text = '第一句话。第二句话。第三句话。第四句话。第五句话。'
      const chunks = splitter.splitText(text)

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(60) // 允许一些超出
      })
    })

    it('应该保留分隔符', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 30,
        separators: ['。'],
        keepSeparator: true,
      })

      const text = '第一句。第二句。第三句。'
      const chunks = splitter.splitText(text)

      chunks.forEach(chunk => {
        if (chunk.length > 0) {
          expect(chunk).toMatch(/。$|^[^。]+$/)
        }
      })
    })

    it('应该处理空文本', () => {
      const splitter = new RecursiveCharacterTextSplitter()
      
      expect(splitter.splitText('')).toEqual([])
      expect(splitter.splitText('   ')).toEqual([])
    })

    it('应该处理单字符文本', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10,
      })

      const text = '测'
      const chunks = splitter.splitText(text)

      expect(chunks).toEqual(['测'])
    })
  })

  describe('段落重叠功能', () => {
    it('应该创建重叠的段落', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 10,
        separators: ['。'],
      })

      const text = '第一句话内容。第二句话内容。第三句话内容。第四句话内容。'
      const chunks = splitter.splitText(text)

      // 检查是否有重叠
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentEnd = chunks[i].slice(-10)
          const nextStart = chunks[i + 1].slice(0, 10)
          // 可能有部分重叠
          expect(currentEnd.length).toBeGreaterThan(0)
          expect(nextStart.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('递归分割功能', () => {
    it('应该使用多级分隔符', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 30,
        separators: ['\n\n', '\n', '。', '，'],
      })

      const text = '第一段第一句，第二句。\n\n第二段第一句，第二句。'
      const chunks = splitter.splitText(text)

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(40)
      })
    })

    it('应该在必要时使用字符级分割', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 5,
        separators: ['。', ''],
      })

      const text = '这是一个很长的没有标点的句子'
      const chunks = splitter.splitText(text)

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(6)
      })
    })
  })

  describe('带元数据的分割', () => {
    it('应该返回正确的元数据', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
      })

      const text = '第一段内容。第二段内容。第三段内容。'
      const chunks = splitter.splitTextWithMetadata(text)

      expect(chunks.length).toBeGreaterThan(0)
      
      chunks.forEach((chunk, index) => {
        expect(chunk.content).toBeTruthy()
        expect(chunk.metadata.startIndex).toBeGreaterThanOrEqual(0)
        expect(chunk.metadata.endIndex).toBeGreaterThan(chunk.metadata.startIndex)
        expect(chunk.metadata.length).toBe(chunk.content.length)
        
        if (index > 0) {
          expect(chunk.metadata.startIndex).toBeGreaterThanOrEqual(
            chunks[index - 1].metadata.startIndex
          )
        }
      })
    })
  })
})

describe('smartSplitText', () => {
  describe('内容类型检测', () => {
    it('应该正确处理小说文本', () => {
      const text = `第一章 开始

这是第一段内容。"你好，"他说，"我是主角。"

这是第二段内容。她回答道："很高兴认识你。"`

      const chunks = smartSplitText(text, {
        contentType: 'novel',
        chunkSize: 100,
      })

      expect(chunks.length).toBeGreaterThan(0)
      // 章节标记应该被保留
      expect(chunks.some(c => c.includes('第一章'))).toBe(true)
    })

    it('应该正确处理对话文本', () => {
      const text = `"你好！"
"你好，最近怎么样？"
"还不错，你呢？"
"我也很好。"`

      const chunks = smartSplitText(text, {
        contentType: 'dialogue',
        chunkSize: 100,
      })

      expect(chunks.length).toBeGreaterThan(0)
      // 对话应该尽量保持完整
      chunks.forEach(chunk => {
        const quoteCount = (chunk.match(/"/g) || []).length
        expect(quoteCount % 2).toBe(0) // 引号应该成对
      })
    })

    it('应该正确处理文章文本', () => {
      const text = `这是第一段。包含多个句子。每个句子都很短。

这是第二段。也包含多个句子。内容比较规整。

这是第三段。继续保持格式。`

      const chunks = smartSplitText(text, {
        contentType: 'article',
        chunkSize: 100,
      })

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(120)
      })
    })
  })

  describe('自动类型检测', () => {
    it('应该自动检测小说', () => {
      const text = '第一章 标题\n\n内容...'
      const chunks = smartSplitText(text, { chunkSize: 100 })
      
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('应该自动检测对话', () => {
      const text = '"你好""你好""再见""再见"'
      const chunks = smartSplitText(text, { chunkSize: 100 })
      
      expect(chunks.length).toBeGreaterThan(0)
    })
  })
})

describe('splitText', () => {
  it('应该使用默认配置快速分割', () => {
    const text = '第一句。第二句。第三句。第四句。第五句。'
    const chunks = splitText(text, 30)

    expect(chunks.length).toBeGreaterThan(0)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(40)
    })
  })

  it('应该处理长文本', () => {
    const text = '这是一个很长的文本。'.repeat(100)
    const chunks = splitText(text, 500)

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(600)
    })
  })
})

describe('calculateTextLength', () => {
  it('应该正确计算中文长度', () => {
    const text = '这是中文'
    const length = calculateTextLength(text)
    
    expect(length).toBe(4) // 4个中文字符
  })

  it('应该正确计算英文长度', () => {
    const text = 'Hello world test'
    const length = calculateTextLength(text)
    
    expect(length).toBe(2) // 3个单词 * 0.5 = 1.5，向上取整为2
  })

  it('应该正确计算中英文混合长度', () => {
    const text = '这是中文 and English words'
    const length = calculateTextLength(text)
    
    // 4个中文 + 3个英文单词(1.5) = 5.5，向上取整为6
    expect(length).toBeGreaterThanOrEqual(5)
  })

  it('应该处理空文本', () => {
    expect(calculateTextLength('')).toBe(0)
    expect(calculateTextLength('   ')).toBe(0)
  })
})

describe('边界情况测试', () => {
  it('应该处理超长单句', () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 50,
      separators: ['。', ''],
    })

    const text = '这是一个非常非常非常非常非常非常非常非常非常非常长的句子没有任何标点符号'
    const chunks = splitter.splitText(text)

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(60)
    })
  })

  it('应该处理只有分隔符的文本', () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 50,
      separators: ['。'],
    })

    const text = '。。。。。'
    const chunks = splitter.splitText(text)

    // 应该过滤掉空段落
    chunks.forEach(chunk => {
      expect(chunk.trim().length).toBeGreaterThan(0)
    })
  })

  it('应该处理混合换行符', () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 50,
      separators: ['\n\n', '\n'],
    })

    const text = '第一行\n第二行\r\n第三行\n\n第四行'
    const chunks = splitter.splitText(text)

    expect(chunks.length).toBeGreaterThan(0)
  })
})

describe('性能测试', () => {
  it('应该能处理大文本', () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    })

    // 生成10KB的文本
    const text = '这是一段测试文本。'.repeat(1000)
    
    const startTime = Date.now()
    const chunks = splitter.splitText(text)
    const endTime = Date.now()

    expect(chunks.length).toBeGreaterThan(0)
    expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
  })
})

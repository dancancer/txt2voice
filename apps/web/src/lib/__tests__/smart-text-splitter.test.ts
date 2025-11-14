/**
 * 智能文本分段器测试
 */

import { SmartTextSplitter, splitTextSmartly, calculateSmartLength, validateSegmentQuality } from '../smart-text-splitter'

describe('SmartTextSplitter', () => {
  let splitter: SmartTextSplitter

  beforeEach(() => {
    splitter = new SmartTextSplitter({
      targetLength: 500,
      maxLength: 600,
      minLength: 400,
      tolerance: 100,
    })
  })

  describe('基本分割功能', () => {
    it('应该正确分割短文本', () => {
      const text = '这是一个短文本，不需要分段。'
      const segments = splitter.split(text)

      expect(segments).toHaveLength(1)
      expect(segments[0].content).toBe(text)
      expect(segments[0].length).toBeLessThanOrEqual(600)
    })

    it('应该正确分割长文本', () => {
      const text = '这是一个很长的文本。' + '这是第二句话。' + '这是第三句话。'.repeat(100)
      const segments = splitter.split(text)

      expect(segments.length).toBeGreaterThan(1)
      segments.forEach((segment, index) => {
        if (index === segments.length - 1) return
        expect(segment.content.length).toBeLessThanOrEqual(600)
        expect(segment.content.length).toBeGreaterThanOrEqual(400)
      })
    })
  })

  describe('句子边界保护', () => {
    it('应该在句子边界分割', () => {
      const text = '第一句话。第二句话！第三句话？第四句话；第五句话：'
      const segments = splitTextSmartly(text, { targetLength: 30, maxLength: 50, minLength: 10 })

      segments.forEach((segment, index) => {
        if (index === segments.length - 1) return // 最后一个段落可能不是完整句子

        // 检查是否在句子结束符处分割
        const endsWithSentenceBoundary = /[。！？；：]\s*$/.test(segment.content)
        if (segment.metadata?.breakReason === 'sentence_boundary') {
          expect(endsWithSentenceBoundary).toBe(true)
        }
      })
    })

    it('应该尽量避免在句子中间分割', () => {
      const text = '这是一个很长的句子，包含很多内容，但是不应该在中间被截断。然后是第二个句子。'
      const segments = splitTextSmartly(text, { targetLength: 20, maxLength: 30, minLength: 10 })

      const forcedSegments = segments.filter(s => s.metadata?.breakReason === 'forced')
      expect(forcedSegments.length).toBeLessThan(segments.length)
    })
  })

  describe('长度控制', () => {
    it('所有段落都不应超过最大长度', () => {
      const text = '测试内容。'.repeat(200)
      const segments = splitter.split(text)

      segments.slice(0, -1).forEach(segment => {
        expect(segment.content.length).toBeLessThanOrEqual(600)
      })
    })

    it('大部分段落应该在容差范围内', () => {
      const text = '测试段落内容。'.repeat(150)
      const segments = splitter.split(text)
      const nonLastSegments = segments.slice(0, -1)

      const inRangeSegments = nonLastSegments.filter(s =>
        s.length >= 400 && s.length <= 600
      )

      const denominator = nonLastSegments.length || 1
      expect(inRangeSegments.length / denominator).toBeGreaterThan(0.7)
    })
  })

  describe('智能长度计算', () => {
    it('应该正确计算中文文本长度', () => {
      const chineseText = '这是中文文本测试'
      expect(calculateSmartLength(chineseText)).toBe(8)
    })

    it('应该正确计算英文文本长度', () => {
      const englishText = 'This is English test'
      // 4个英文单词，每个计0.5，应该等于2
      expect(calculateSmartLength(englishText)).toBe(2)
    })

    it('应该正确计算混合文本长度', () => {
      const mixedText = '这是中文 and English'
      // 中文4个字符 + 英文2个单词(计1) = 5
      expect(calculateSmartLength(mixedText)).toBe(5)
    })
  })

  describe('分段质量验证', () => {
    it('应该正确验证良好的分段', () => {
      const text = '第一句话。第二句话。第三句话。'.repeat(20)
      const segments = splitter.split(text)

      const validation = validateSegmentQuality(segments)

      expect(validation.valid).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.stats.totalSegments).toBe(segments.length)
    })

    it('应该检测到分段问题', () => {
      // 创建故意有问题的情况
      const segments = [
        { content: '短', length: 2, order: 0 }, // 太短
        { content: '正常长度', length: 4, order: 1 },
        { content: '这是一个非常非常长的段落，绝对超过了最大长度限制。'.repeat(10), length: 1500, order: 2 }, // 太长
      ]

      const validation = validateSegmentQuality(segments)

      expect(validation.valid).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
    })
  })

  describe('边界情况处理', () => {
    it('应该处理空文本', () => {
      const segments = splitter.split('')
      expect(segments).toHaveLength(0)
    })

    it('应该处理只有空白字符的文本', () => {
      const segments = splitter.split('   \n\t   ')
      expect(segments).toHaveLength(0)
    })

    it('应该处理标点符号', () => {
      const text = '第一段。。！？？\n\n第二段。！？'
      const segments = splitter.split(text)

      expect(segments.length).toBeGreaterThan(0)
      segments.forEach(segment => {
        expect(segment.content.trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('实际使用场景测试', () => {
    it('应该正确处理小说文本', () => {
      const novelText = `
第一章 开始

这是小说的开头。主人公张三走在街上，看到了许多有趣的事情。

"你好，"他说，"今天天气真好。"

"是啊，"李四回答，"我们一起去公园吧。"

于是他们一起走向公园。公园里有很多花，有红色的、黄色的、蓝色的。张三感到非常开心。

突然，天空中传来一声巨响。他们抬头一看，发现是一架飞机。

"那是什么？"张三好奇地问。

"好像是军用飞机，"李四说，"平时很少看到。"

他们继续走着，讨论着刚才看到的飞机。不知不觉中，他们已经走到了公园门口。

公园门口有一个告示牌，上面写着："今日开放时间：8:00-18:00"。

"还好没有关门，"张三松了一口气，"我们可以好好玩了。"
      `.repeat(3).trim()

      const segments = splitter.split(novelText)

      const validation = validateSegmentQuality(segments)

      expect(segments.length).toBeGreaterThan(1)
      expect(validation.valid).toBe(true)

      segments.slice(0, -1).forEach(segment => {
        expect(segment.content.length).toBeLessThanOrEqual(600)
        expect(segment.content.length).toBeGreaterThanOrEqual(400)
      })
    })

    it('应该正确处理对话密集文本', () => {
      const dialogueText = `
"你好，"张三说。
"你好，"李四回答。
"今天天气真好。"
"是啊，很适合出去走走。"
"你想去哪里？"
"去公园怎么样？"
"好主意！我们走吧。"
"等等，我先准备一下。"
"需要我帮忙吗？"
"不用，我很快就准备好了。"
"好的，我等你。"
"好了，我们走吧。"
      `.trim()

      const segments = splitter.split(dialogueText)

      // 对话密集的文本可能会产生更多短段落，但都应该在合理范围内
      segments.slice(0, -1).forEach(segment => {
        expect(segment.content.length).toBeLessThanOrEqual(600)
      })
    })
  })
})

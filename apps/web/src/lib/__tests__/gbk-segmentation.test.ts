// 一旦我被更新，请更新我的开头注释
// input: GBK 样本文本/分段窗口
// output: 编码与分段契约断言
// pos: 单元测试
/**
 * @jest-environment node
 */

import iconv from 'iconv-lite'
import { processFileContent, segmentText } from '@/lib/text-processor'
import { segmentText as segmentTextFromModule } from '@/lib/text-processing/segmentation/segmenter'

const buildGbkSampleText = (): string => {
  const sentence = '张三沿着老街慢慢往前走，路边摊贩的吆喝声和自行车铃声交织在一起。'
  return sentence.repeat(30)
}

describe('GBK 文本分段', () => {
  it('内联 GBK 样本文本的非末段保持在 500±100 字范围内', () => {
    const sourceText = buildGbkSampleText()
    const buffer = iconv.encode(sourceText, 'gbk')
    const segmentOptions = {
      maxSegmentLength: 600,
      minSegmentLength: 400,
      preserveFormatting: true,
    }

    const processed = processFileContent(buffer, 'test.txt', { preserveFormatting: true })
    const segments = segmentText(processed.content, segmentOptions)

    expect(processed.encoding).toBe('gbk')
    expect(segments.length).toBeGreaterThan(1)

    const nonLastSegments = segments.slice(0, -1)
    const oversized = nonLastSegments.filter((segment) => segment.content.length > 600)
    const undersized = nonLastSegments.filter((segment) => segment.content.length < 400)

    if (oversized.length > 0 || undersized.length > 0) {
      console.error('Segments outside 500±100 range:', {
        oversized: oversized.map(seg => ({
          order: seg.order,
          length: seg.content.length,
          preview: seg.content.slice(0, 50),
        })),
        undersized: undersized.map(seg => ({
          order: seg.order,
          length: seg.content.length,
          preview: seg.content.slice(0, 50),
        })),
      })
    }

    expect(oversized).toHaveLength(0)
    expect(undersized).toHaveLength(0)
  })

  it('facade 与新分段模块对同一文本给出相同分段结果', () => {
    const sourceText = buildGbkSampleText()
    const options = {
      maxSegmentLength: 600,
      minSegmentLength: 400,
      preserveFormatting: true,
    }

    const facadeSegments = segmentText(sourceText, options)
    const moduleSegments = segmentTextFromModule(sourceText, options)

    expect(moduleSegments).toEqual(facadeSegments)
  })
})

/**
 * @jest-environment node
 */

import { readFileSync } from 'fs'
import path from 'path'
import { processFileContent, segmentText } from '@/lib/text-processor'

describe('GBK 文本分段', () => {
  it('docs/test.txt 每段不超过500字符', () => {
    const repoRoot = path.resolve(__dirname, '../../../../../')
    const filePath = path.join(repoRoot, 'docs', 'test.txt')
    const buffer = readFileSync(filePath)

    const processed = processFileContent(buffer, 'test.txt', { preserveFormatting: true })
    const segments = segmentText(processed.content, { useSmartSplitter: true })

    expect(segments.length).toBeGreaterThan(0)

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
})

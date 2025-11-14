/**
 * 调试测试文件
 */

import { SmartTextSplitter, calculateSmartLength } from './smart-text-splitter'

// 创建一个简单的测试
const testText = '这是一个很长的文本。' + '这是第二句话。' + '这是第三句话。'.repeat(50)

console.log('原始文本长度:', calculateSmartLength(testText))
console.log('原始文本片段:', testText.substring(0, 100) + '...')

const splitter = new SmartTextSplitter({
  targetLength: 500,
  maxLength: 600,
  minLength: 400,
  tolerance: 100,
})

console.log('开始分割...')
const segments = splitter.split(testText)

console.log('分割结果:')
segments.forEach((segment, index) => {
  console.log(`段落 ${index}:`)
  console.log(`  长度: ${segment.length}`)
  console.log(`  内容: ${segment.content.substring(0, 100)}...`)
  console.log(`  元数据:`, segment.metadata)
})

console.log(`总段落数: ${segments.length}`)

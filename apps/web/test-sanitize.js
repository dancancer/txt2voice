/**
 * 测试文本清理功能
 */

// 模拟清理函数
function sanitizeContent(content) {
  return content
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .normalize('NFC')
}

// 测试用例
const testCases = [
  {
    name: 'NULL字符',
    input: 'Hello\x00World',
    expected: 'HelloWorld'
  },
  {
    name: '控制字符',
    input: 'Hello\x01\x02\x03World',
    expected: 'HelloWorld'
  },
  {
    name: '保留换行和制表符',
    input: 'Hello\n\tWorld',
    expected: 'Hello\n\tWorld'
  },
  {
    name: 'DEL字符',
    input: 'Hello\x7FWorld',
    expected: 'HelloWorld'
  },
  {
    name: '混合特殊字符',
    input: 'Line1\nLine2\x00\x01\tLine3',
    expected: 'Line1\nLine2\tLine3'
  },
  {
    name: 'Unicode规范化',
    input: 'café', // 组合字符
    expected: 'café' // 预组合字符
  }
]

console.log('测试文本清理功能\n')

let passed = 0
let failed = 0

testCases.forEach(({ name, input, expected }) => {
  const result = sanitizeContent(input)
  const success = result === expected
  
  if (success) {
    passed++
    console.log(`✅ ${name}`)
  } else {
    failed++
    console.log(`❌ ${name}`)
    console.log(`   输入: ${JSON.stringify(input)}`)
    console.log(`   期望: ${JSON.stringify(expected)}`)
    console.log(`   实际: ${JSON.stringify(result)}`)
  }
})

console.log(`\n总计: ${testCases.length} 个测试`)
console.log(`通过: ${passed}`)
console.log(`失败: ${failed}`)

// 测试实际的问题场景
console.log('\n\n测试实际问题场景:')
const problematicText = '这是一段包含\x00特殊字符的文本\x01\x02'
console.log('原始文本:', JSON.stringify(problematicText))
console.log('清理后:', JSON.stringify(sanitizeContent(problematicText)))
console.log('长度变化:', problematicText.length, '->', sanitizeContent(problematicText).length)

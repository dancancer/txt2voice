// 一旦我被更新，请更新我的开头注释
// input: 原始文本
// output: 智能长度/有效长度
// pos: smart text splitter shared
/**
 * 智能长度计算工具
 */

export function calculateSmartLength(text: string): number {
  const cleanText = text.replace(/\s+/g, ' ').trim()
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length
  const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length
  const numbers = (cleanText.match(/\d+/g) || []).length

  return chineseChars + Math.ceil(englishWords * 0.5) + numbers
}

export function measureEffectiveLength(text: string): number {
  const trimmedLength = text.trim().length
  return Math.max(calculateSmartLength(text), trimmedLength)
}

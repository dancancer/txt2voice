// 一旦我被更新，请更新我的开头注释
// input: 文本/引号栈更新器
// output: 句子边界切分结果
// pos: smart text splitter shared
/**
 * 句子边界扫描工具
 */

import type { SentenceInfo } from './types'

const CLOSING_QUOTE_PATTERN = /["”’））》」】]/
const SENTENCE_TERMINATOR_PATTERN = /[。！？；.!?…]/

interface SentenceBoundaryOptions {
  updateQuoteStack: (quoteStack: string[], char: string) => void
}

function isSentenceTerminator(char: string): boolean {
  return SENTENCE_TERMINATOR_PATTERN.test(char)
}

export function splitIntoSentenceInfos(
  text: string,
  { updateQuoteStack }: SentenceBoundaryOptions
): SentenceInfo[] {
  const sentences: SentenceInfo[] = []
  let buffer = ''
  let sentenceStart = 0
  let capturing = false
  const quoteStack: string[] = []
  let pendingQuotedTerminator = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]

    if (!capturing) {
      sentenceStart = index
      capturing = true
    }

    buffer += char

    const wasInsideQuote = quoteStack.length > 0
    updateQuoteStack(quoteStack, char)

    const closedQuotedTerminator =
      pendingQuotedTerminator &&
      wasInsideQuote &&
      quoteStack.length === 0 &&
      CLOSING_QUOTE_PATTERN.test(char)

    if (isSentenceTerminator(char) && quoteStack.length > 0) {
      pendingQuotedTerminator = true
      continue
    }

    if (!isSentenceTerminator(char) && !closedQuotedTerminator) {
      continue
    }

    while (index + 1 < text.length && isSentenceTerminator(text[index + 1])) {
      buffer += text[++index]
    }

    while (index + 1 < text.length && CLOSING_QUOTE_PATTERN.test(text[index + 1])) {
      buffer += text[++index]
      updateQuoteStack(quoteStack, text[index])
    }

    const sentenceText = buffer.trim()
    if (sentenceText.length > 0) {
      sentences.push({
        text: sentenceText,
        start: sentenceStart,
        end: index + 1,
      })
    }

    buffer = ''
    capturing = false
    pendingQuotedTerminator = false
  }

  if (buffer.trim().length > 0) {
    sentences.push({
      text: buffer.trim(),
      start: sentenceStart,
      end: text.length,
    })
  }

  return sentences
}

export function splitIntoSentences(
  text: string,
  { updateQuoteStack }: SentenceBoundaryOptions
): string[] {
  const sentences: string[] = []
  let buffer = ''
  const quoteStack: string[] = []
  let pendingQuotedTerminator = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    buffer += char

    const wasInsideQuote = quoteStack.length > 0
    updateQuoteStack(quoteStack, char)

    const closedQuotedTerminator =
      pendingQuotedTerminator &&
      wasInsideQuote &&
      quoteStack.length === 0 &&
      CLOSING_QUOTE_PATTERN.test(char)

    if (isSentenceTerminator(char) && quoteStack.length > 0) {
      pendingQuotedTerminator = true
      continue
    }

    if (!isSentenceTerminator(char) && !closedQuotedTerminator) {
      continue
    }

    while (index + 1 < text.length && isSentenceTerminator(text[index + 1])) {
      buffer += text[++index]
    }

    while (index + 1 < text.length && CLOSING_QUOTE_PATTERN.test(text[index + 1])) {
      buffer += text[++index]
      updateQuoteStack(quoteStack, text[index])
    }

    const sentence = buffer.trim()
    if (sentence.length > 0) {
      sentences.push(sentence)
    }

    buffer = ''
    pendingQuotedTerminator = false
  }

  if (buffer.trim().length > 0) {
    sentences.push(buffer.trim())
  }

  return sentences
}

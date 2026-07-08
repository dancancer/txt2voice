// 一旦我被更新，请更新我的开头注释
// input: 原始 segment 文本/对白边界常量
// output: refinement 切片工具
// pos: script production helper
/**
 * failed segment refinement 切片阶段
 */

import {
  DIALOGUE_CLOSING_QUOTE_CHARS,
  DIALOGUE_QUOTE_PAIRS,
  updateDialogueQuoteStack,
} from "@/lib/dialogue-quote-tracker";
import type { ContentSlice, QuoteSpan } from "./types";
import { SENTENCE_BOUNDARY_CHARS } from "./types";

export const trimSlice = (content: string, start: number, end: number) => {
  let nextStart = start;
  let nextEnd = end;

  while (nextStart < nextEnd && /\s/.test(content[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(content[nextEnd - 1])) {
    nextEnd -= 1;
  }

  return {
    start: nextStart,
    end: nextEnd,
    content: content.slice(nextStart, nextEnd),
  };
};

export const splitBySentenceBoundaries = (content: string) => {
  const slices: ContentSlice[] = [];
  let cursor = 0;
  const quoteStack: string[] = [];

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const wasInsideQuote = quoteStack.length > 0;
    updateDialogueQuoteStack(quoteStack, current);

    if (
      wasInsideQuote ||
      quoteStack.length > 0 ||
      !SENTENCE_BOUNDARY_CHARS.has(current)
    ) {
      continue;
    }

    let end = index + 1;
    while (
      end < content.length &&
      DIALOGUE_CLOSING_QUOTE_CHARS.has(content[end])
    ) {
      end += 1;
    }

    const slice = trimSlice(content, cursor, end);
    if (slice.content.length > 0) {
      slices.push(slice);
    }
    cursor = end;
  }

  const trailing = trimSlice(content, cursor, content.length);
  if (trailing.content.length > 0) {
    slices.push(trailing);
  }

  return slices;
};

export const splitByQuoteBoundaries = (content: string) => {
  const slices: ContentSlice[] = [];
  let cursor = 0;

  for (let index = 1; index < content.length; index += 1) {
    const previous = content[index - 1];
    const current = content[index];

    if (!DIALOGUE_CLOSING_QUOTE_CHARS.has(previous) || /\s/.test(current)) {
      continue;
    }

    const slice = trimSlice(content, cursor, index);
    if (slice.content.length > 0) {
      slices.push(slice);
    }
    cursor = index;
  }

  const trailing = trimSlice(content, cursor, content.length);
  if (trailing.content.length > 0) {
    slices.push(trailing);
  }

  return slices;
};

export const findQuotedSpans = (content: string): QuoteSpan[] => {
  const spans: QuoteSpan[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    let bestSpan: QuoteSpan | null = null;

    for (const { open, close } of DIALOGUE_QUOTE_PAIRS) {
      const start = content.indexOf(open, cursor);
      if (start < 0) {
        continue;
      }

      const closeIndex = content.indexOf(close, start + open.length);
      if (closeIndex < 0) {
        continue;
      }

      const candidate = {
        start,
        end: closeIndex + close.length,
      };

      if (!bestSpan || candidate.start < bestSpan.start) {
        bestSpan = candidate;
      }
    }

    if (!bestSpan) {
      break;
    }

    spans.push(bestSpan);
    cursor = bestSpan.end;
  }

  return spans;
};

export const buildNonQuotedFragments = (content: string, spans: QuoteSpan[]) => {
  const fragments: string[] = [];
  let cursor = 0;

  for (const span of spans) {
    const fragment = content.slice(cursor, span.start).trim();
    if (fragment) {
      fragments.push(fragment);
    }
    cursor = span.end;
  }

  const trailing = content.slice(cursor).trim();
  if (trailing) {
    fragments.push(trailing);
  }

  return fragments;
};

export function isPureQuotedSlice(content: string) {
  const trimmed = content.trim();
  const spans = findQuotedSpans(trimmed);
  return (
    spans.length === 1 &&
    spans[0].start === 0 &&
    spans[0].end === trimmed.length
  );
}

export const splitPureQuotedSlice = (slice: ContentSlice) => {
  const spans = findQuotedSpans(slice.content);
  if (spans.length !== 1) {
    return [slice];
  }

  const [span] = spans;
  if (span.start !== 0 || span.end !== slice.content.trim().length) {
    return [slice];
  }

  const body = slice.content.slice(span.start + 1, span.end - 1);
  const boundaries: number[] = [];

  for (let index = 0; index < body.length; index += 1) {
    if (SENTENCE_BOUNDARY_CHARS.has(body[index])) {
      boundaries.push(index + 1);
    }
  }

  if (boundaries.length <= 1) {
    return [slice];
  }

  const pieces: ContentSlice[] = [];
  let cursor = 0;

  boundaries.forEach((boundary, boundaryIndex) => {
    const isFirst = boundaryIndex === 0;
    const isLast = boundaryIndex === boundaries.length - 1;
    const localStart = isFirst ? span.start : span.start + 1 + cursor;
    const localEnd = isLast ? span.end : span.start + 1 + boundary;
    const trimmed = trimSlice(slice.content, localStart, localEnd);
    if (trimmed.content.length > 0) {
      pieces.push({
        start: slice.start + trimmed.start,
        end: slice.start + trimmed.end,
        content: trimmed.content,
      });
    }
    cursor = boundary;
  });

  return pieces.length > 1 ? pieces : [slice];
};

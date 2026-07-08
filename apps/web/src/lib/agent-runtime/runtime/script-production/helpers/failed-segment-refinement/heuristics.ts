// 一旦我被更新，请更新我的开头注释
// input: refinement 切片/对白归因启发式
// output: refinement 语义判断工具
// pos: script production helper
/**
 * failed segment refinement 语义启发式
 */

import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeGenericDaoAttribution,
  PUNCTUATION_ONLY_PATTERN,
} from "../dialogue-attribution-heuristics";
import {
  LEADING_AND_TRAILING_QUOTE_PATTERN,
  LEADING_QUOTE_PATTERN,
  SENTENCE_BOUNDARY_CHARS,
} from "./types";
import type { ContentSlice, QuoteSpan } from "./types";
import {
  buildNonQuotedFragments,
  findQuotedSpans,
  isPureQuotedSlice,
  splitPureQuotedSlice,
  trimSlice,
} from "./slices";

const isAttributionFragment = (value: string) => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

  return (
    hasSpeechAttributionCue(value) ||
    looksLikeGenericDaoAttribution(value) ||
    PUNCTUATION_ONLY_PATTERN.test(value)
  );
};

export const hasAttributionContext = (value: string) => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

  return (
    hasSpeechAttributionCue(value) ||
    looksLikeGenericDaoAttribution(value)
  );
};

export const hasReportReadingContext = (value: string) => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

  return hasReportReadingCue(value);
};

export const hasExplicitSpeechAttribution = (value: string) => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

  return (
    hasSpeechAttributionCue(value) ||
    looksLikeGenericDaoAttribution(value)
  );
};

export const isBareSpeakerLabel = (value: string) => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

  return /^[\p{Script=Han}A-Za-z0-9_]{1,6}[：:]\s*$/u.test(value.trim());
};

const stripOuterQuotes = (value: string) => {
  const matched = value.match(LEADING_AND_TRAILING_QUOTE_PATTERN);
  return matched ? matched[1].trim() : value.trim();
};

const countSentenceBoundaries = (value: string) =>
  Array.from(value).filter((char) => SENTENCE_BOUNDARY_CHARS.has(char)).length;

const isLikelyReportQuoteSlice = (value: string) => {
  if (!isPureQuotedSlice(value)) {
    return false;
  }

  return stripOuterQuotes(value).length >= 10;
};

export const isLongMultiSentenceQuoteRun = (value: string) => {
  const spans = findQuotedSpans(value);
  if (spans.length >= 2) {
    return true;
  }

  if (!isPureQuotedSlice(value)) {
    return false;
  }

  return countSentenceBoundaries(stripOuterQuotes(value)) >= 2;
};

const shouldKeepQuotedSentenceAsWhole = (content: string, spans: QuoteSpan[]) => {
  if (spans.length === 0) {
    return true;
  }

  if (
    spans.length === 1 &&
    spans[0].start === 0 &&
    spans[0].end === content.trim().length
  ) {
    return true;
  }

  const fragments = buildNonQuotedFragments(content, spans);
  if (fragments.length === 0) {
    return true;
  }

  let hasAttribution = false;

  for (const fragment of fragments) {
    if (isDisplayTextCue(fragment)) {
      return false;
    }

    if (isAttributionFragment(fragment)) {
      hasAttribution = true;
      continue;
    }

    return false;
  }

  return hasAttribution;
};

const splitLeadingQuotedAttributionSlice = (slice: ContentSlice) => {
  const spans = findQuotedSpans(slice.content);
  if (spans.length !== 1 || spans[0].start !== 0) {
    return [slice];
  }

  const [span] = spans;
  const trimmedLength = slice.content.trim().length;
  if (span.end >= trimmedLength) {
    return [slice];
  }

  const leadingQuote = trimSlice(slice.content, span.start, span.end);
  const trailingAttribution = trimSlice(
    slice.content,
    span.end,
    slice.content.length
  );

  if (
    leadingQuote.content.length === 0 ||
    trailingAttribution.content.length === 0 ||
    PUNCTUATION_ONLY_PATTERN.test(trailingAttribution.content) ||
    !isAttributionFragment(trailingAttribution.content)
  ) {
    return [slice];
  }

  return [
    {
      start: slice.start + leadingQuote.start,
      end: slice.start + leadingQuote.end,
      content: leadingQuote.content,
    },
    {
      start: slice.start + trailingAttribution.start,
      end: slice.start + trailingAttribution.end,
      content: trailingAttribution.content,
    },
  ];
};

export const splitQuotedSentence = (slice: ContentSlice) => {
  const spans = findQuotedSpans(slice.content);
  if (spans.length === 0) {
    return [slice];
  }

  if (shouldKeepQuotedSentenceAsWhole(slice.content, spans)) {
    const pureQuotedSlices = splitPureQuotedSlice(slice);
    if (
      pureQuotedSlices.length > 1 ||
      pureQuotedSlices[0].content !== slice.content
    ) {
      return pureQuotedSlices;
    }

    return splitLeadingQuotedAttributionSlice(slice);
  }

  const pieces: ContentSlice[] = [];
  let cursor = 0;

  for (const span of spans) {
    const prefix = trimSlice(slice.content, cursor, span.start);
    if (prefix.content.length > 0) {
      pieces.push({
        start: slice.start + prefix.start,
        end: slice.start + prefix.end,
        content: prefix.content,
      });
    }

    const quote = trimSlice(slice.content, span.start, span.end);
    if (quote.content.length > 0) {
      pieces.push({
        start: slice.start + quote.start,
        end: slice.start + quote.end,
        content: quote.content,
      });
    }

    cursor = span.end;
  }

  const trailing = trimSlice(slice.content, cursor, slice.content.length);
  if (trailing.content.length > 0) {
    pieces.push({
      start: slice.start + trailing.start,
      end: slice.start + trailing.end,
      content: trailing.content,
    });
  }

  return pieces.length > 0 ? pieces : [slice];
};

export const reportQuoteHeuristics = {
  isLikelyReportQuoteSlice,
  LEADING_QUOTE_PATTERN,
  isPureQuotedSlice,
};

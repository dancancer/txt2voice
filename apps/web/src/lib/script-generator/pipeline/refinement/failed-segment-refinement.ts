export interface FailedSegmentRefinementInput {
  segment: {
    id: string;
    chapterId?: string | null;
    orderIndex?: number;
    content: string;
  };
  failure: {
    errorCode?: string;
    issueCodes?: string[];
    coverageRatio?: number | null;
  };
}

export interface RefinedSegmentSlice {
  id: string;
  parentSegmentId: string;
  chapterId: string | null;
  orderIndex: number;
  content: string;
  offsetStart: number;
  offsetEnd: number;
}

const TARGET_ISSUE_CODES = new Set([
  "TEXT_SOURCE_MISMATCH",
  "NON_WHITESPACE_GAP",
  "SOURCE_NOT_FOUND",
]);

const SENTENCE_BOUNDARY_CHARS = new Set([
  "。",
  "！",
  "？",
  "；",
  "!",
  "?",
  "…",
]);

const CLOSING_QUOTE_CHARS = new Set(['"', "”", "」", "』", "’"]);
const ATTRIBUTION_TOKEN_PATTERN =
  /(说道|说着|说完|说|问道|问|回答|答道|答|应道|应|回应|回道|回|喊道|喊|叫道|叫|吼道|吼|嚷道|嚷|嘀咕|嘟囔|喃喃|低声说|轻声说|低声道|轻声道|笑道|哭道|提醒|解释|告诉|补充|反问|脱口而出|承认)/;
const GENERIC_DAO_PATTERN = /[^，。！？；：,:]{0,12}道(?:[：:,，。\s]|$)/;
const DISPLAY_TEXT_PATTERN =
  /(写着|写道|写有|写明|标着|标明|贴着|贴有|印着|印有|显示着|显示|注明|题着)/;
const PUNCTUATION_ONLY_PATTERN = /^[，。！？；：,:、…—\-\s]+$/;

const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: "“", close: "”" },
  { open: '"', close: '"' },
  { open: "「", close: "」" },
  { open: "『", close: "』" },
  { open: "‘", close: "’" },
  { open: "'", close: "'" },
];

interface QuoteSpan {
  start: number;
  end: number;
}

const trimSlice = (content: string, start: number, end: number) => {
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

const splitBySentenceBoundaries = (content: string) => {
  const slices: Array<{ start: number; end: number; content: string }> = [];
  let cursor = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (!SENTENCE_BOUNDARY_CHARS.has(content[index])) {
      continue;
    }

    let end = index + 1;
    while (end < content.length && CLOSING_QUOTE_CHARS.has(content[end])) {
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

const splitByQuoteBoundaries = (content: string) => {
  const slices: Array<{ start: number; end: number; content: string }> = [];
  let cursor = 0;

  for (let index = 1; index < content.length; index += 1) {
    const previous = content[index - 1];
    const current = content[index];

    if (!CLOSING_QUOTE_CHARS.has(previous) || /\s/.test(current)) {
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

const findQuotedSpans = (content: string): QuoteSpan[] => {
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

const buildNonQuotedFragments = (content: string, spans: QuoteSpan[]) => {
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

const isAttributionFragment = (value: string) => {
  if (!value || DISPLAY_TEXT_PATTERN.test(value)) {
    return false;
  }

  return (
    ATTRIBUTION_TOKEN_PATTERN.test(value) ||
    GENERIC_DAO_PATTERN.test(value) ||
    PUNCTUATION_ONLY_PATTERN.test(value)
  );
};

const shouldKeepQuotedSentenceAsWhole = (content: string, spans: QuoteSpan[]) => {
  if (spans.length === 0) {
    return true;
  }

  if (spans.length === 1 && spans[0].start === 0 && spans[0].end === content.trim().length) {
    return true;
  }

  const fragments = buildNonQuotedFragments(content, spans);
  if (fragments.length === 0) {
    return true;
  }

  let hasAttribution = false;

  for (const fragment of fragments) {
    if (DISPLAY_TEXT_PATTERN.test(fragment)) {
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

const splitQuotedSentence = (slice: { start: number; end: number; content: string }) => {
  const spans = findQuotedSpans(slice.content);
  if (spans.length === 0 || shouldKeepQuotedSentenceAsWhole(slice.content, spans)) {
    return [slice];
  }

  const pieces: Array<{ start: number; end: number; content: string }> = [];
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

export const shouldRefineSegmentFailure = (failure: {
  errorCode?: string;
  issueCodes?: string[];
  coverageRatio?: number | null;
}) => {
  if (failure.errorCode !== "SCRIPT_VALIDATION_FAILED") {
    return false;
  }

  const issueCodes = Array.isArray(failure.issueCodes) ? failure.issueCodes : [];
  if (!issueCodes.some((code) => TARGET_ISSUE_CODES.has(code))) {
    return false;
  }

  if (
    typeof failure.coverageRatio === "number" &&
    Number.isFinite(failure.coverageRatio) &&
    failure.coverageRatio >= 0.99
  ) {
    return false;
  }

  return true;
};

export const refineFailedSegment = (
  input: FailedSegmentRefinementInput
): RefinedSegmentSlice[] => {
  const { segment, failure } = input;

  if (!shouldRefineSegmentFailure(failure)) {
    return [];
  }

  const bySentence = splitBySentenceBoundaries(segment.content);
  const rawSlices = bySentence
    .flatMap((slice) => splitQuotedSentence(slice));
  const fallbackSlices =
    rawSlices.length > 1 ? rawSlices : splitByQuoteBoundaries(segment.content);

  if (fallbackSlices.length <= 1) {
    return [];
  }

  return fallbackSlices.map((slice, index) => ({
    id: `${segment.id}::refined-${index + 1}`,
    parentSegmentId: segment.id,
    chapterId: segment.chapterId ?? null,
    orderIndex:
      typeof segment.orderIndex === "number" && Number.isFinite(segment.orderIndex)
        ? segment.orderIndex
        : -1,
    content: slice.content,
    offsetStart: slice.start,
    offsetEnd: slice.end,
  }));
};

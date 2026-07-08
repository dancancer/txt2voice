// 一旦我被更新，请更新我的开头注释
// input: draft line/sourceText/quoted text
// output: script draft normalizer 辅助函数
// pos: script production helper
import { resolveScriptLineText } from "./segment-script-validator";
import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeColonAttribution,
  looksLikeGenericDaoAttribution,
} from "./dialogue-attribution-heuristics";
import type { SegmentScriptDraftLine } from "../../../context";

export const normalizeComparableText = (value: string): string =>
  value
    .replace(/\s+/g, "")
    .replace(/[“”‘’]/g, '"')
    .replace(/[「」『』]/g, '"');
export const DIALOGUE_OPENING_QUOTES = /^["“”‘’'「」『』]+/;
const DIALOGUE_CLOSING_QUOTES = /["“”‘’'「」『』]+$/;
const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: "“", close: "”" },
  { open: '"', close: '"' },
  { open: "「", close: "」" },
  { open: "『", close: "』" },
  { open: "‘", close: "’" },
  { open: "'", close: "'" },
];
const PUNCTUATION_ONLY_PATTERN = /^[，。！？；：,:、…—\-\s]+$/;
const SENTENCE_BOUNDARY_CHARS = new Set(["。", "！", "？", "；", "!", "?", "…"]);

interface QuotedSpan {
  body: string;
  start: number;
  end: number;
}

export const hasWeakAttributionCue = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || isDisplayTextCue(trimmed)) {
    return false;
  }

  return (
    hasSpeechAttributionCue(trimmed) ||
    hasReportReadingCue(trimmed) ||
    looksLikeColonAttribution(trimmed) ||
    looksLikeGenericDaoAttribution(trimmed)
  );
};

export const stripBoundaryQuoteFragments = (value: string): string =>
  value
    .trim()
    .replace(DIALOGUE_OPENING_QUOTES, "")
    .replace(DIALOGUE_CLOSING_QUOTES, "")
    .trim();

export const normalizeLine = (
  line: SegmentScriptDraftLine
): SegmentScriptDraftLine => ({
  ...line,
  id: line.id.trim(),
  sourceText: line.sourceText.trim(),
  text: line.text.trim(),
  speaker: line.speaker.trim() || "未知",
});

export const normalizePureQuotedLeafSource = (params: {
  segmentText: string;
  line: SegmentScriptDraftLine;
}): SegmentScriptDraftLine => {
  const segmentText = params.segmentText.trim();
  const dialogueExpected = resolveScriptLineText({
    sourceText: segmentText,
    speaker: "未知",
  });
  const narrationExpected = resolveScriptLineText({
    sourceText: segmentText,
    speaker: "旁白",
  });

  if (
    normalizeComparableText(dialogueExpected) ===
      normalizeComparableText(narrationExpected) ||
    normalizeComparableText(params.line.text) !==
      normalizeComparableText(dialogueExpected)
  ) {
    return params.line;
  }

  const comparableSource = normalizeComparableText(params.line.sourceText);
  const comparableDialogue = normalizeComparableText(dialogueExpected);
  const comparableSegment = normalizeComparableText(segmentText);

  if (
    comparableSource !== comparableDialogue &&
    comparableSource !== comparableSegment
  ) {
    return params.line;
  }

  return {
    ...params.line,
    sourceText: segmentText,
  };
};

export const normalizeNarrationDialogueBoundary = (
  line: SegmentScriptDraftLine
): SegmentScriptDraftLine => {
  if (line.speaker !== "旁白") {
    return line;
  }

  const dialogueExpected = resolveScriptLineText({
    sourceText: line.sourceText,
    speaker: "未知",
  });
  const narrationExpected = resolveScriptLineText({
    sourceText: line.sourceText,
    speaker: "旁白",
  });

  if (
    normalizeComparableText(line.text) ===
      normalizeComparableText(dialogueExpected) &&
    normalizeComparableText(line.text) !==
      normalizeComparableText(narrationExpected)
  ) {
    return {
      ...line,
      speaker: "未知",
    };
  }

  const comparableText = normalizeComparableText(line.text);
  const comparableDialogue = normalizeComparableText(dialogueExpected);
  const comparableNarration = normalizeComparableText(narrationExpected);
  const boundaryStrippedSource = stripBoundaryQuoteFragments(line.sourceText);
  const comparableBoundaryStripped = normalizeComparableText(boundaryStrippedSource);

  if (
    comparableBoundaryStripped !== comparableNarration &&
    comparableText === comparableBoundaryStripped &&
    comparableText !== comparableDialogue &&
    comparableDialogue !== comparableNarration
  ) {
    return {
      ...line,
      text: dialogueExpected,
      speaker: "未知",
    };
  }

  return line;
};

export const normalizeUnknownNarrationBoundary = (
  line: SegmentScriptDraftLine
): SegmentScriptDraftLine => {
  if (line.speaker !== "未知") {
    return line;
  }

  const normalizedSource = stripBoundaryQuoteFragments(line.sourceText);
  if (!normalizedSource || !hasWeakAttributionCue(normalizedSource)) {
    return line;
  }

  if (
    normalizeComparableText(line.text) !==
    normalizeComparableText(normalizedSource)
  ) {
    return line;
  }

  return {
    ...line,
    sourceText: normalizedSource,
    text: normalizedSource,
    speaker: "旁白",
  };
};

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

export const findQuotedSpans = (value: string): QuotedSpan[] => {
  const spans: QuotedSpan[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    let bestSpan: QuotedSpan | null = null;

    for (const { open, close } of DIALOGUE_QUOTE_PAIRS) {
      const start = value.indexOf(open, cursor);
      if (start < 0) {
        continue;
      }

      const endIndex = value.indexOf(close, start + open.length);
      if (endIndex < 0) {
        continue;
      }

      const body = value.slice(start + open.length, endIndex).trim();
      if (!body) {
        continue;
      }

      const candidate: QuotedSpan = {
        body,
        start,
        end: endIndex + close.length,
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

const splitBySentenceBoundaries = (content: string) => {
  const slices: Array<{ content: string }> = [];
  let cursor = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (!SENTENCE_BOUNDARY_CHARS.has(content[index])) {
      continue;
    }

    const slice = trimSlice(content, cursor, index + 1);
    if (slice.content.length > 0) {
      slices.push({ content: slice.content });
    }
    cursor = index + 1;
  }

  const trailing = trimSlice(content, cursor, content.length);
  if (trailing.content.length > 0) {
    slices.push({ content: trailing.content });
  }

  return slices.length > 0 ? slices : [{ content: content.trim() }];
};

const buildNarrationVariants = (params: {
  line: SegmentScriptDraftLine;
  sourceText: string;
}): SegmentScriptDraftLine[] => {
  return splitBySentenceBoundaries(params.sourceText)
    .filter((slice) => slice.content.length > 0)
    .map((slice, index) => ({
      ...params.line,
      id: `${params.line.id}::narration-${index + 1}`,
      sourceText: slice.content,
      text: slice.content,
      speaker: "旁白",
      orderInSegment: params.line.orderInSegment,
    }));
};

export const splitMixedDialogueLine = (
  line: SegmentScriptDraftLine
): SegmentScriptDraftLine[] | null => {
  if (line.speaker === "旁白") {
    return null;
  }

  const spans = findQuotedSpans(line.sourceText);
  if (spans.length !== 1) {
    return null;
  }

  const [span] = spans;
  if (
    normalizeComparableText(line.text) !== normalizeComparableText(span.body)
  ) {
    return null;
  }

  const prefix = trimSlice(line.sourceText, 0, span.start);
  const quote = trimSlice(line.sourceText, span.start, span.end);
  const suffix = trimSlice(line.sourceText, span.end, line.sourceText.length);
  const variants: SegmentScriptDraftLine[] = [];

  if (prefix.content.length > 0 && !PUNCTUATION_ONLY_PATTERN.test(prefix.content)) {
    variants.push(...buildNarrationVariants({ line, sourceText: prefix.content }));
  }

  variants.push({
    ...line,
    id: `${line.id}::dialogue-1`,
    sourceText: quote.content,
    text: resolveScriptLineText({
      sourceText: quote.content,
      speaker: line.speaker || "未知",
    }),
    orderInSegment: line.orderInSegment,
  });

  if (suffix.content.length > 0 && !PUNCTUATION_ONLY_PATTERN.test(suffix.content)) {
    variants.push(
      ...buildNarrationVariants({
        line: {
          ...line,
          id: `${line.id}::tail`,
          speaker: "旁白",
        },
        sourceText: suffix.content,
      })
    );
  }

  return variants.length > 1 ? variants : null;
};

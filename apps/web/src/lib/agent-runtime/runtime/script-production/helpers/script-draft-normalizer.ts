import { resolveScriptLineText } from "./segment-script-validator";
import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeColonAttribution,
  looksLikeGenericDaoAttribution,
} from "./dialogue-attribution-heuristics";
import type { SegmentScriptDraft, SegmentScriptDraftLine } from "../../../context";

const normalizeComparableText = (value: string): string =>
  value
    .replace(/\s+/g, "")
    .replace(/[“”‘’]/g, '"')
    .replace(/[「」『』]/g, '"');
const DIALOGUE_OPENING_QUOTES = /^["“”‘’'「」『』]+/;
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

const hasWeakAttributionCue = (value: string): boolean => {
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

const stripBoundaryQuoteFragments = (value: string): string => {
  return value
    .trim()
    .replace(DIALOGUE_OPENING_QUOTES, "")
    .replace(DIALOGUE_CLOSING_QUOTES, "")
    .trim();
};

const normalizeLine = (line: SegmentScriptDraftLine): SegmentScriptDraftLine => ({
  ...line,
  id: line.id.trim(),
  sourceText: line.sourceText.trim(),
  text: line.text.trim(),
  speaker: line.speaker.trim() || "未知",
});

const normalizePureQuotedLeafSource = (params: {
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

const normalizeNarrationDialogueBoundary = (
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

const normalizeUnknownNarrationBoundary = (
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

const findQuotedSpans = (value: string): QuotedSpan[] => {
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

const splitMixedDialogueLine = (
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

const normalizeAdjacentMalformedQuoteShell = (
  lines: SegmentScriptDraftLine[]
): SegmentScriptDraftLine[] => {
  return lines.map((line, index) => {
    const nextLine = lines[index + 1];

    if (!nextLine || line.speaker !== "旁白" || nextLine.speaker === "旁白") {
      return line;
    }

    const nextDialogueText = nextLine.text.trim();
    if (!nextDialogueText) {
      return line;
    }

    const comparableResolved = normalizeComparableText(
      resolveScriptLineText({
        sourceText: line.sourceText,
        speaker: nextLine.speaker || "未知",
      })
    );

    if (comparableResolved !== normalizeComparableText(nextDialogueText)) {
      return line;
    }

    const dialogueAnchor = nextLine.sourceText.trim() || nextDialogueText;
    const anchorIndex =
      line.sourceText.lastIndexOf(dialogueAnchor) >= 0
        ? line.sourceText.lastIndexOf(dialogueAnchor)
        : line.sourceText.lastIndexOf(nextDialogueText);

    if (anchorIndex <= 0) {
      return line;
    }

    const normalizedPrefix = stripBoundaryQuoteFragments(
      line.sourceText.slice(0, anchorIndex)
    );

    if (
      !normalizedPrefix ||
      normalizeComparableText(line.text) !==
        normalizeComparableText(normalizedPrefix)
    ) {
      return line;
    }

    return {
      ...line,
      sourceText: normalizedPrefix,
      text: normalizedPrefix,
    };
  });
};

const hasMalformedOpeningQuote = (value: string): boolean => {
  const trimmed = value.trim();
  if (!DIALOGUE_OPENING_QUOTES.test(trimmed)) {
    return false;
  }

  return findQuotedSpans(trimmed).length === 0;
};

const isContinuationStopLine = (
  line: SegmentScriptDraftLine,
  runSpeaker: string
): boolean => {
  const normalizedSource = stripBoundaryQuoteFragments(line.sourceText);
  const normalizedText = line.text.trim();
  const comparableSource = normalizeComparableText(normalizedSource);
  const comparableText = normalizeComparableText(normalizedText);

  if (
    line.speaker !== "旁白" &&
    line.speaker !== "未知" &&
    line.speaker !== runSpeaker
  ) {
    return true;
  }

  if (isDisplayTextCue(normalizedSource) || isDisplayTextCue(normalizedText)) {
    return true;
  }

  if (hasWeakAttributionCue(normalizedSource) || hasWeakAttributionCue(normalizedText)) {
    return true;
  }

  if (
    hasMalformedOpeningQuote(line.sourceText) &&
    comparableSource === comparableText
  ) {
    return true;
  }

  return false;
};

const mergeDialogueContinuationRuns = (
  lines: SegmentScriptDraftLine[]
): SegmentScriptDraftLine[] => {
  const merged: SegmentScriptDraftLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    if (!hasMalformedOpeningQuote(current.sourceText) || current.speaker === "旁白") {
      merged.push(current);
      continue;
    }

    let combined = { ...current };
    let consumedAny = false;

    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (isContinuationStopLine(next, combined.speaker)) {
        break;
      }

      consumedAny = true;
      index += 1;
      combined = {
        ...combined,
        sourceText: `${combined.sourceText}${next.sourceText}`,
        text: `${combined.text}${next.text}`,
      };
    }

    merged.push(consumedAny ? combined : current);
  }

  return merged;
};

export const normalizeSegmentScriptDraft = (params: {
  segmentText: string;
  draft: SegmentScriptDraft;
}): SegmentScriptDraft => {
  let lines = params.draft.lines.map((line) => normalizeLine(line));

  if (lines.length === 1) {
    lines = [
      normalizePureQuotedLeafSource({
        segmentText: params.segmentText,
        line: lines[0],
      }),
    ];
  }

  lines = lines.flatMap((line) => splitMixedDialogueLine(line) || [line]);
  lines = normalizeAdjacentMalformedQuoteShell(lines);
  lines = mergeDialogueContinuationRuns(lines);
  lines = lines.map((line) => normalizeNarrationDialogueBoundary(line));
  lines = lines.map((line) => normalizeUnknownNarrationBoundary(line));
  lines = lines.map((line, index) => ({
    ...line,
    orderInSegment: index,
  }));

  return {
    ...params.draft,
    lines,
  };
};

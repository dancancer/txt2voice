import {
  DIALOGUE_QUOTE_CHAR_SET,
  DIALOGUE_QUOTE_PAIRS,
  MAX_STRUCTURAL_ATTRIBUTION_FRAGMENT_LENGTH,
  MIN_MULTI_QUOTE_BODY_RATIO,
  MIN_SINGLE_QUOTE_BODY_RATIO,
  PUNCTUATION_ONLY_PATTERN,
  QUOTE_CHAR_PATTERN,
  SENTENCE_BOUNDARY_PATTERN,
  SHORT_REPLY_PATTERN,
} from "./segment-script-validator-constants";
import type {
  BoundaryFragment,
  QuotedSpan,
} from "./segment-script-validator-types";
import { normalizeComparableText, stripBoundaryQuotes } from "./segment-script-validator-text";
import { isIgnorableCoverageGap } from "./segment-script-validator-gap";
import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeColonAttribution,
  looksLikeGenericDaoAttribution,
} from "./dialogue-attribution-heuristics";

export const findQuotedSpans = (value: string): QuotedSpan[] => {
  const spans: QuotedSpan[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    let bestSpan: QuotedSpan | null = null;

    for (const { open, close } of DIALOGUE_QUOTE_PAIRS) {
      const start = value.indexOf(open, cursor);
      if (start < 0) continue;

      const endIndex = value.indexOf(close, start + open.length);
      if (endIndex < 0) continue;

      const body = value.slice(start + open.length, endIndex).trim();
      if (!body) continue;

      const candidate: QuotedSpan = {
        body,
        start,
        end: endIndex + close.length,
      };

      if (!bestSpan || candidate.start < bestSpan.start) {
        bestSpan = candidate;
      }
    }

    if (!bestSpan) break;
    spans.push(bestSpan);
    cursor = bestSpan.end;
  }

  return spans;
};

const isPureQuotedText = (value: string): boolean => {
  const trimmed = value.trim();
  const spans = findQuotedSpans(trimmed);
  if (spans.length !== 1) {
    return false;
  }
  const [span] = spans;
  return span.start === 0 && span.end === trimmed.length;
};

export const isBoundaryQuoteFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const hasLeadingQuote = /^["“‘'「『]+/.test(trimmed);
  const hasTrailingQuote = /["”’'」』]+$/.test(trimmed);
  if (hasLeadingQuote === hasTrailingQuote) {
    return false;
  }

  return findQuotedSpans(trimmed).length === 0;
};

const countSentenceBoundaries = (value: string): number => {
  return value.match(SENTENCE_BOUNDARY_PATTERN)?.length || 0;
};

const isSentenceBoundaryChar = (value: string): boolean =>
  SENTENCE_BOUNDARY_PATTERN.test(value);

const hasSubstantiveDetachedContext = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length > 0 && !PUNCTUATION_ONLY_PATTERN.test(trimmed);
};

const extractTrailingBoundaryFragment = (value: string): BoundaryFragment => {
  const trimmed = value.trim();
  if (!trimmed) return { edge: "", detached: "" };

  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    if (!isSentenceBoundaryChar(trimmed[index])) continue;
    const edge = trimmed.slice(index + 1).trim();
    if (!edge) return { edge: trimmed, detached: "" };
    return { edge, detached: trimmed.slice(0, index + 1).trim() };
  }

  return { edge: trimmed, detached: "" };
};

const extractLeadingBoundaryFragment = (value: string): BoundaryFragment => {
  const trimmed = value.trim();
  if (!trimmed) return { edge: "", detached: "" };

  for (let index = 0; index < trimmed.length; index += 1) {
    if (!isSentenceBoundaryChar(trimmed[index])) continue;
    const edge = trimmed.slice(0, index + 1).trim();
    const detached = trimmed.slice(index + 1).trim();
    if (!detached) return { edge: trimmed, detached: "" };
    return { edge, detached };
  }

  return { edge: trimmed, detached: "" };
};

const hasInteriorSentenceBoundary = (value: string): boolean => {
  return /[。！？；!?…](?=\S)/.test(value.trim());
};

const isStructurallyCompactFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || PUNCTUATION_ONLY_PATTERN.test(trimmed)) return true;
  if (isDisplayTextCue(trimmed) || findQuotedSpans(trimmed).length > 0) return false;
  if (
    normalizeComparableText(trimmed).length >
    MAX_STRUCTURAL_ATTRIBUTION_FRAGMENT_LENGTH
  ) {
    return false;
  }
  if (countSentenceBoundaries(trimmed) > 1) return false;
  return !hasInteriorSentenceBoundary(trimmed);
};

const hasWeakAttributionCue = (value: string): boolean => {
  if (!value || isDisplayTextCue(value)) return false;

  const trimmed = value.trim();
  return (
    hasSpeechAttributionCue(trimmed) ||
    hasReportReadingCue(trimmed) ||
    looksLikeColonAttribution(trimmed) ||
    looksLikeGenericDaoAttribution(trimmed)
  );
};

const quotedBodyRatio = (sourceText: string, spans: QuotedSpan[]): number => {
  const sourceLength = normalizeComparableText(sourceText).length;
  if (sourceLength === 0) return 0;

  const quotedLength = spans.reduce(
    (total, span) => total + normalizeComparableText(span.body).length,
    0
  );

  return quotedLength / sourceLength;
};

const isAttributedDialogueSpan = (sourceText: string, span: QuotedSpan): boolean => {
  const prefix = sourceText.slice(0, span.start).trim();
  const suffix = sourceText.slice(span.end).trim();
  const prefixBoundary = extractTrailingBoundaryFragment(prefix);
  const suffixBoundary = extractLeadingBoundaryFragment(suffix);
  const edgeFragments = [prefixBoundary.edge, suffixBoundary.edge].filter(
    (fragment) => fragment.length > 0
  );

  if (edgeFragments.length === 0) return false;
  if (
    [prefix, suffix].some((fragment) => fragment.length > 0 && isDisplayTextCue(fragment))
  ) {
    return false;
  }
  if (
    hasSubstantiveDetachedContext(prefixBoundary.detached) ||
    hasSubstantiveDetachedContext(suffixBoundary.detached)
  ) {
    return false;
  }
  if (edgeFragments.some((fragment) => hasWeakAttributionCue(fragment))) {
    return true;
  }
  return (
    edgeFragments.every((fragment) => isStructurallyCompactFragment(fragment)) &&
    quotedBodyRatio(sourceText, [span]) >= MIN_SINGLE_QUOTE_BODY_RATIO
  );
};

const buildNonQuotedFragments = (
  sourceText: string,
  spans: QuotedSpan[]
): string[] => {
  const fragments: string[] = [];
  let cursor = 0;

  for (const span of spans) {
    const fragment = sourceText.slice(cursor, span.start).trim();
    if (fragment) fragments.push(fragment);
    cursor = span.end;
  }

  const trailingFragment = sourceText.slice(cursor).trim();
  if (trailingFragment) fragments.push(trailingFragment);
  return fragments;
};

const isAttributedDialogueSequence = (
  sourceText: string,
  spans: QuotedSpan[]
): boolean => {
  const fragments = buildNonQuotedFragments(sourceText, spans);
  if (fragments.length === 0) return false;

  let hasAttribution = false;
  for (const fragment of fragments) {
    if (isDisplayTextCue(fragment)) return false;
    if (hasWeakAttributionCue(fragment)) {
      hasAttribution = true;
      continue;
    }
    if (PUNCTUATION_ONLY_PATTERN.test(fragment)) continue;
    if (!isStructurallyCompactFragment(fragment)) return false;
  }

  return hasAttribution || quotedBodyRatio(sourceText, spans) >= MIN_MULTI_QUOTE_BODY_RATIO;
};

export const isAttributedDialogueQuotedText = (sourceText: string): boolean => {
  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) return false;
  if (spans.length === 1) return isAttributedDialogueSpan(sourceText, spans[0]);
  return isAttributedDialogueSequence(sourceText, spans);
};

const listQuoteBoundaryIndexes = (value: string): number[] => {
  const indexes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (DIALOGUE_QUOTE_CHAR_SET.has(value[index])) {
      indexes.push(index);
    }
  }
  return indexes;
};

const normalizeMalformedPrefixContext = (value: string): string => {
  return stripBoundaryQuotes(value).trim();
};

const scoreMalformedDialoguePrefix = (value: string): number | null => {
  const normalized = normalizeMalformedPrefixContext(value);
  if (!normalized) return 1;

  const boundary = extractTrailingBoundaryFragment(normalized);
  const edge = normalizeMalformedPrefixContext(boundary.edge);
  const detached = normalizeMalformedPrefixContext(boundary.detached);

  if (!edge || isDisplayTextCue(edge) || hasSubstantiveDetachedContext(detached)) {
    return null;
  }

  if (
    hasWeakAttributionCue(edge) ||
    looksLikeColonAttribution(edge) ||
    /[：:]$/.test(edge)
  ) {
    return 4;
  }

  if (isStructurallyCompactFragment(edge)) {
    return 2;
  }

  return null;
};

const resolveMalformedDialogueText = (sourceText: string): string | null => {
  const trimmed = sourceText.trim();
  if (!trimmed) return null;

  const quoteIndexes = listQuoteBoundaryIndexes(trimmed);
  if (quoteIndexes.length === 0) return null;

  let bestCandidate = "";
  let bestScore = -1;

  for (const quoteIndex of quoteIndexes) {
    const prefix = trimmed.slice(0, quoteIndex).trim();
    const suffix = trimmed.slice(quoteIndex + 1).trim();

    if (suffix) {
      const afterQuote = suffix.replace(/^[，、；：,:]+/, "").trim();
      const prefixScore = scoreMalformedDialoguePrefix(prefix);
      if (afterQuote && prefixScore !== null) {
        let score = prefixScore;
        if (!QUOTE_CHAR_PATTERN.test(afterQuote)) {
          score += 2;
        }
        if (
          score > bestScore ||
          (score === bestScore && afterQuote.length > bestCandidate.length)
        ) {
          bestCandidate = afterQuote;
          bestScore = score;
        }
      }
    }

    if (
      prefix &&
      (suffix.length === 0 ||
        PUNCTUATION_ONLY_PATTERN.test(suffix) ||
        /^[，、；：,:]+$/.test(suffix))
    ) {
      const beforeQuote = prefix.replace(/^[，、；：,:]+|[，、；：,:]+$/g, "").trim();
      const score = QUOTE_CHAR_PATTERN.test(beforeQuote) ? 0 : 2;
      if (
        score > bestScore ||
        (score === bestScore && beforeQuote.length > bestCandidate.length)
      ) {
        bestCandidate = beforeQuote;
        bestScore = score;
      }
    }
  }

  return bestCandidate || null;
};

const resolveDialogueText = (sourceText: string): string => {
  if (isPureQuotedText(sourceText)) {
    return sourceText
      .trim()
      .replace(/^["“‘'「『]+/, "")
      .replace(/["”’'」』]+$/, "")
      .replace(/^[，、；：,:]+/, "")
      .trim();
  }

  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) {
    const malformed = resolveMalformedDialogueText(sourceText);
    if (malformed) return malformed;
    if (isBoundaryQuoteFragment(sourceText)) return stripBoundaryQuotes(sourceText);
    return sourceText.trim();
  }

  if (spans.length === 1) {
    const [span] = spans;
    if (!isAttributedDialogueSpan(sourceText, span)) {
      return sourceText.trim();
    }
    return span.body;
  }

  if (!isAttributedDialogueSequence(sourceText, spans)) {
    return sourceText.trim();
  }

  return spans.map((span) => span.body).join("");
};

export const resolveExpectedText = (sourceText: string, speaker: string): string => {
  if (speaker === "旁白") {
    return sourceText.trim();
  }
  return resolveDialogueText(sourceText);
};

export const isLikelySpeechQuotedText = (value: string): boolean => {
  if (!isPureQuotedText(value)) {
    return false;
  }

  const body = stripBoundaryQuotes(value)
    .replace(/[，。！？；：,.!?…]+$/, "")
    .trim();

  if (!body) return false;
  return SHORT_REPLY_PATTERN.test(body);
};

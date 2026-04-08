import { normalizeNarrationText } from "./narration-text-normalizer";
import {
  hasReportReadingCue,
  hasSpeechAttributionCue,
  isDisplayTextCue,
  looksLikeColonAttribution,
  looksLikeGenericDaoAttribution,
  PUNCTUATION_ONLY_PATTERN,
} from "./dialogue-attribution-heuristics";

type RawScriptSentence = {
  text?: unknown;
  sourceText?: unknown;
  speaker?: unknown;
};

export type SegmentScriptValidationIssueCode =
  | "EMPTY_DIALOGUES"
  | "MISSING_SOURCE_TEXT"
  | "EMPTY_TEXT"
  | "TEXT_SOURCE_MISMATCH"
  | "SOURCE_NOT_FOUND"
  | "NON_WHITESPACE_GAP"
  | "QUOTED_NARRATION"
  | "LOW_COVERAGE";

export interface SegmentScriptValidationIssue {
  code: SegmentScriptValidationIssueCode;
  message: string;
  index?: number;
  preview?: string;
}

export interface ValidatedScriptSentence {
  text: string;
  sourceText: string;
  speaker: string;
  sourceStart: number;
  sourceEnd: number;
  resolvedText: string;
}

export interface SegmentScriptValidationResult {
  valid: boolean;
  issues: SegmentScriptValidationIssue[];
  coverageRatio: number;
  lines: ValidatedScriptSentence[];
}

interface QuotedSpan {
  body: string;
  start: number;
  end: number;
}

interface BoundaryFragment {
  edge: string;
  detached: string;
}

const DIALOGUE_OPENING_QUOTES = /^["“‘'「『]+/;
const DIALOGUE_CLOSING_QUOTES = /["”’'」』]+$/;
const MIN_COVERAGE_RATIO = 0.98;
const TRAILING_SPEECH_PUNCTUATION = /[，。！？；：,.!?…]+$/;
const SENTENCE_BOUNDARY_PATTERN = /[。！？；!?…]/g;
const MAX_STRUCTURAL_ATTRIBUTION_FRAGMENT_LENGTH = 32;
const MIN_SINGLE_QUOTE_BODY_RATIO = 0.35;
const MIN_MULTI_QUOTE_BODY_RATIO = 0.3;
const SHORT_REPLY_PATTERN =
  /^(?:嗯+|哦+|啊+|呀+|哎+|唉+|哈+|欸+|诶+|好+|行+|对|是|不|没|别|来|去|走|成|可|嗯嗯|好的|可以|不行|不要|不会|不是|知道|明白|当然|走吧|来吧|等等?|站住|闭嘴)$/;
const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: '“', close: '”' },
  { open: '"', close: '"' },
  { open: '「', close: '」' },
  { open: '『', close: '』' },
  { open: '‘', close: '’' },
  { open: "'", close: "'" },
];
const DIALOGUE_QUOTE_CHAR_SET = new Set(
  DIALOGUE_QUOTE_PAIRS.flatMap(({ open, close }) => [open, close])
);
const QUOTE_CHAR_PATTERN = /[“”「」『』‘’"']/;
const GAP_QUOTE_CHAR_PATTERN = /[“”「」『』‘’"']/;
const NARRATION_ACTION_CUE_PATTERN =
  /(心知|看出|解释|故作|接过|低头|望去|皱起|抬起头|点点头|翻出|抬手|扶额|转身|走去|看着|瞧见|沉下脸|伸手|起身|摇摇头|皱眉)/;
const DANGLING_DIALOGUE_PUNCTUATION = /^[，、；：,:]+|[，、；：,:]+$/g;
const AD_NOISE_LINK_PATTERN =
  /(https?:\/\/|www\.|[a-z0-9-]{2,}\.(?:com|cn|cc|net|xyz)\b|点(?:com|cn|cc|net))/i;
const AD_NOISE_KEYWORDS = [
  "下载",
  "约炮",
  "平台",
  "直播",
  "同城交友",
  "纯原生",
  "app",
  "ＡＰＰ",
  "福利",
  "最新地址",
];

const asTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeComparableText = (value: string): string => {
  return value
    .replace(/\s+/g, "")
    .replace(/[“”‘’]/g, '"')
    .replace(/[「」『』]/g, '"');
};

const stripBoundaryQuotes = (value: string): string => {
  return value
    .trim()
    .replace(DIALOGUE_OPENING_QUOTES, "")
    .replace(DIALOGUE_CLOSING_QUOTES, "")
    .trim();
};

const stripLeadingDialoguePunctuation = (value: string): string => {
  return value.replace(/^[，、；：,:]+/, "").trim();
};

const stripDanglingDialoguePunctuation = (value: string): string => {
  return value.replace(DANGLING_DIALOGUE_PUNCTUATION, "").trim();
};

const previewText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
};

const isIgnorableCoverageGap = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || !GAP_QUOTE_CHAR_PATTERN.test(trimmed)) {
    return isLikelyAdNoiseFragment(trimmed);
  }

  const remainder = trimmed
    .replace(/[“”「」『』‘’"'\s]/g, "")
    .replace(/[，。！？；：,:、…—-]/g, "");

  if (remainder.length === 0) {
    return true;
  }

  return isLikelyAdNoiseFragment(trimmed);
};

const countAdNoiseKeywordHits = (value: string): number => {
  const lowercase = value.toLowerCase();
  return AD_NOISE_KEYWORDS.reduce((total, keyword) => {
    return lowercase.includes(keyword.toLowerCase()) ? total + 1 : total;
  }, 0);
};

const isLikelyAdNoiseFragment = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 24) {
    return false;
  }

  const hasDecorativePrefix =
    /^[-=－—_*~\s]{3,}/.test(normalized) || /[【】\[\]]/.test(normalized);
  const hasLinkCue = AD_NOISE_LINK_PATTERN.test(normalized);
  const keywordHits = countAdNoiseKeywordHits(normalized);

  if (hasLinkCue && keywordHits >= 1) {
    return true;
  }

  if (hasDecorativePrefix && keywordHits >= 2) {
    return true;
  }

  return false;
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

const findQuotedSpan = (value: string): QuotedSpan | null => {
  return findQuotedSpans(value)[0] || null;
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

const isBoundaryQuoteFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const hasLeadingQuote = DIALOGUE_OPENING_QUOTES.test(trimmed);
  const hasTrailingQuote = DIALOGUE_CLOSING_QUOTES.test(trimmed);

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
  if (!trimmed) {
    return { edge: "", detached: "" };
  }

  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    if (!isSentenceBoundaryChar(trimmed[index])) {
      continue;
    }

    const edge = trimmed.slice(index + 1).trim();
    if (!edge) {
      return { edge: trimmed, detached: "" };
    }

    return {
      edge,
      detached: trimmed.slice(0, index + 1).trim(),
    };
  }

  return { edge: trimmed, detached: "" };
};

const extractLeadingBoundaryFragment = (value: string): BoundaryFragment => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { edge: "", detached: "" };
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    if (!isSentenceBoundaryChar(trimmed[index])) {
      continue;
    }

    const edge = trimmed.slice(0, index + 1).trim();
    const detached = trimmed.slice(index + 1).trim();

    if (!detached) {
      return { edge: trimmed, detached: "" };
    }

    return {
      edge,
      detached,
    };
  }

  return { edge: trimmed, detached: "" };
};

const hasInteriorSentenceBoundary = (value: string): boolean => {
  return /[。！？；!?…](?=\S)/.test(value.trim());
};

const isStructurallyCompactFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || PUNCTUATION_ONLY_PATTERN.test(trimmed)) {
    return true;
  }

  if (isDisplayTextCue(trimmed) || findQuotedSpans(trimmed).length > 0) {
    return false;
  }

  if (
    normalizeComparableText(trimmed).length >
    MAX_STRUCTURAL_ATTRIBUTION_FRAGMENT_LENGTH
  ) {
    return false;
  }

  if (countSentenceBoundaries(trimmed) > 1) {
    return false;
  }

  return !hasInteriorSentenceBoundary(trimmed);
};

const hasWeakAttributionCue = (value: string): boolean => {
  if (!value || isDisplayTextCue(value)) {
    return false;
  }

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
  if (sourceLength === 0) {
    return 0;
  }

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

  if (edgeFragments.length === 0) {
    return false;
  }

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
    if (fragment) {
      fragments.push(fragment);
    }
    cursor = span.end;
  }

  const trailingFragment = sourceText.slice(cursor).trim();
  if (trailingFragment) {
    fragments.push(trailingFragment);
  }

  return fragments;
};

const isAttributedDialogueSequence = (
  sourceText: string,
  spans: QuotedSpan[]
): boolean => {
  const fragments = buildNonQuotedFragments(sourceText, spans);
  if (fragments.length === 0) {
    return false;
  }

  let hasAttribution = false;

  for (const fragment of fragments) {
    if (isDisplayTextCue(fragment)) {
      return false;
    }

    if (hasWeakAttributionCue(fragment)) {
      hasAttribution = true;
      continue;
    }

    if (PUNCTUATION_ONLY_PATTERN.test(fragment)) {
      continue;
    }

    if (!isStructurallyCompactFragment(fragment)) {
      return false;
    }
  }

  return (
    hasAttribution ||
    quotedBodyRatio(sourceText, spans) >= MIN_MULTI_QUOTE_BODY_RATIO
  );
};

const isAttributedDialogueQuotedText = (sourceText: string): boolean => {
  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) {
    return false;
  }

  if (spans.length === 1) {
    return isAttributedDialogueSpan(sourceText, spans[0]);
  }

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
  if (!normalized) {
    return 1;
  }

  const boundary = extractTrailingBoundaryFragment(normalized);
  const edge = normalizeMalformedPrefixContext(boundary.edge);
  const detached = normalizeMalformedPrefixContext(boundary.detached);

  if (
    !edge ||
    isDisplayTextCue(edge) ||
    hasSubstantiveDetachedContext(detached)
  ) {
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
  if (!trimmed) {
    return null;
  }

  const quoteIndexes = listQuoteBoundaryIndexes(trimmed);
  if (quoteIndexes.length === 0) {
    return null;
  }

  let bestCandidate = "";
  let bestScore = -1;

  for (const quoteIndex of quoteIndexes) {
    const prefix = trimmed.slice(0, quoteIndex).trim();
    const suffix = trimmed.slice(quoteIndex + 1).trim();

    if (suffix) {
      const afterQuote = stripLeadingDialoguePunctuation(suffix);
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
      const beforeQuote = stripDanglingDialoguePunctuation(prefix);
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
    return stripLeadingDialoguePunctuation(stripBoundaryQuotes(sourceText));
  }

  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) {
    const malformed = resolveMalformedDialogueText(sourceText);
    if (malformed) {
      return malformed;
    }

    if (isBoundaryQuoteFragment(sourceText)) {
      return stripBoundaryQuotes(sourceText);
    }

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

const resolveExpectedText = (sourceText: string, speaker: string): string => {
  if (speaker === "旁白") {
    return sourceText.trim();
  }

  return resolveDialogueText(sourceText);
};

const isLikelySpeechQuotedText = (value: string): boolean => {
  if (!isPureQuotedText(value)) {
    return false;
  }

  const body = stripBoundaryQuotes(value)
    .replace(TRAILING_SPEECH_PUNCTUATION, "")
    .trim();

  if (!body) {
    return false;
  }

  return SHORT_REPLY_PATTERN.test(body);
};

const isLikelyNarrationBoundaryFragment = (value: string): boolean => {
  if (!isBoundaryQuoteFragment(value)) {
    return false;
  }

  const body = stripBoundaryQuotes(value);
  if (!body || isDisplayTextCue(body) || !NARRATION_ACTION_CUE_PATTERN.test(body)) {
    return false;
  }

  if (hasWeakAttributionCue(body) && !looksLikeColonAttribution(body)) {
    return false;
  }

  return true;
};

const buildIssue = (
  code: SegmentScriptValidationIssueCode,
  message: string,
  index?: number,
  preview?: string
): SegmentScriptValidationIssue => ({
  code,
  message,
  index,
  preview,
});

export function validateSegmentScript(params: {
  segmentContent: string;
  scriptSentences: RawScriptSentence[];
}): SegmentScriptValidationResult {
  const { segmentContent, scriptSentences } = params;
  const issues: SegmentScriptValidationIssue[] = [];
  const lines: ValidatedScriptSentence[] = [];

  if (!Array.isArray(scriptSentences) || scriptSentences.length === 0) {
    issues.push(buildIssue("EMPTY_DIALOGUES", "LLM 未返回任何台本句子"));
    return {
      valid: false,
      issues,
      coverageRatio: 0,
      lines,
    };
  }

  let cursor = 0;
  let coveredLength = 0;

  scriptSentences.forEach((sentence, index) => {
    const sourceText = asTrimmedString(sentence.sourceText);
    const speaker = asTrimmedString(sentence.speaker) || "未知";
    const rawText = asTrimmedString(sentence.text) || sourceText;
    const text =
      speaker === "旁白"
        ? normalizeNarrationText({
            sourceText,
            text: rawText,
          })
        : rawText;
    let hasLineIssue = false;

    if (!sourceText) {
      issues.push(
        buildIssue("MISSING_SOURCE_TEXT", "缺少可回溯的 sourceText", index)
      );
      return;
    }

    if (!text) {
      issues.push(buildIssue("EMPTY_TEXT", "台本句子文本为空", index));
      return;
    }

    const expectedText = resolveExpectedText(sourceText, speaker);
    const comparableText = normalizeComparableText(text);
    const comparableExpected = normalizeComparableText(expectedText);

    if (!comparableExpected) {
      issues.push(buildIssue("EMPTY_TEXT", "sourceText 只有空白或引号", index));
      return;
    }

    const start = segmentContent.indexOf(sourceText, cursor);
    if (start < 0) {
      issues.push(
        buildIssue(
          "SOURCE_NOT_FOUND",
          "sourceText 无法按顺序映射回原文，疑似重抽或漏抽",
          index,
          previewText(sourceText)
        )
      );
      return;
    }

    const gap = segmentContent.slice(cursor, start);
    if (/\S/.test(gap)) {
      if (isIgnorableCoverageGap(gap)) {
        coveredLength += normalizeComparableText(gap).length;
      } else {
        issues.push(
          buildIssue(
            "NON_WHITESPACE_GAP",
            "原文中存在未覆盖内容，疑似漏抽",
            index,
            previewText(gap)
          )
        );
        hasLineIssue = true;
      }
    }

    const end = start + sourceText.length;
    cursor = end;
    coveredLength += normalizeComparableText(sourceText).length;

    if (comparableText !== comparableExpected) {
      issues.push(
        buildIssue(
          "TEXT_SOURCE_MISMATCH",
          "text 与 sourceText 不一致，疑似改写或边界漂移",
          index,
          previewText(sourceText)
        )
      );
      hasLineIssue = true;
    }

    if (
      !hasLineIssue &&
      speaker === "旁白" &&
      (isLikelySpeechQuotedText(sourceText) ||
        isAttributedDialogueQuotedText(sourceText) ||
        (isBoundaryQuoteFragment(sourceText) &&
          !isLikelyNarrationBoundaryFragment(sourceText)))
    ) {
      issues.push(
        buildIssue(
          "QUOTED_NARRATION",
          "旁白句直接承载整段引号对白，疑似对白/旁白混抽",
          index,
          previewText(sourceText)
        )
      );
      hasLineIssue = true;
    }

    if (hasLineIssue) {
      return;
    }

    lines.push({
      text,
      sourceText,
      speaker,
      sourceStart: start,
      sourceEnd: end,
      resolvedText: expectedText,
    });
  });

  const trailingGap = segmentContent.slice(cursor);
  if (/\S/.test(trailingGap)) {
    if (isIgnorableCoverageGap(trailingGap)) {
      coveredLength += normalizeComparableText(trailingGap).length;
    } else {
      issues.push(
        buildIssue(
          "NON_WHITESPACE_GAP",
          "原文尾部存在未覆盖内容，疑似截断",
          undefined,
          previewText(trailingGap)
        )
      );
    }
  }

  const expectedLength = normalizeComparableText(segmentContent).length;
  const coverageRatio = expectedLength > 0 ? coveredLength / expectedLength : 0;

  if (coverageRatio < MIN_COVERAGE_RATIO) {
    issues.push(
      buildIssue(
        "LOW_COVERAGE",
        `原文覆盖率过低: ${(coverageRatio * 100).toFixed(1)}%`
      )
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    coverageRatio,
    lines,
  };
}

export function formatSegmentValidationError(
  result: SegmentScriptValidationResult
): string {
  const issueSummary = result.issues
    .slice(0, 3)
    .map((issue) => issue.message)
    .join("；");

  const suffix =
    result.issues.length > 3 ? `；另有 ${result.issues.length - 3} 个问题` : "";

  return `段落台本校验失败：${issueSummary}${suffix}`;
}

export function resolveScriptLineText(params: {
  sourceText: string;
  speaker: string;
}): string {
  const { sourceText, speaker } = params;
  return resolveExpectedText(sourceText, speaker);
}

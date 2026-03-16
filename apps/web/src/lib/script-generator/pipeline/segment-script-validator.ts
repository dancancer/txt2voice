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

const DIALOGUE_OPENING_QUOTES = /^["“‘'「『]+/;
const DIALOGUE_CLOSING_QUOTES = /["”’'」』]+$/;
const MIN_COVERAGE_RATIO = 0.98;
const TRAILING_SPEECH_PUNCTUATION = /[，。！？；：,.!?…]+$/;
const PUNCTUATION_ONLY_PATTERN = /^[，。！？；：,:、…—\-\s]+$/;
const SHORT_REPLY_PATTERN =
  /^(?:嗯+|哦+|啊+|呀+|哎+|唉+|哈+|欸+|诶+|好+|行+|对|是|不|没|别|来|去|走|成|可|嗯嗯|好的|可以|不行|不要|不会|不是|知道|明白|当然|走吧|来吧|等等?|站住|闭嘴)$/;
const ATTRIBUTION_TOKEN_PATTERN =
  /(说道|说着|说完|说|问道|问|回答|答道|答|应道|应|回应|回道|回|喊道|喊|叫道|叫|吼道|吼|嚷道|嚷|嘀咕|嘟囔|喃喃|低声说|轻声说|低声道|轻声道|笑道|哭道|提醒|解释|告诉|补充|反问|脱口而出|承认)/;
const DISPLAY_TEXT_PATTERN =
  /(写着|写道|写有|写明|标着|标明|贴着|贴有|印着|印有|显示着|显示|注明|题着)/;
const GENERIC_DAO_PATTERN = /[^，。！？；：,:]{0,12}道(?:[：:,，。\s]|$)/;
const COLON_ATTRIBUTION_PATTERN = /[：:]\s*$/;
const DIALOGUE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: '“', close: '”' },
  { open: '"', close: '"' },
  { open: '「', close: '」' },
  { open: '『', close: '』' },
  { open: '‘', close: '’' },
  { open: "'", close: "'" },
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

const previewText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
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

const looksLikeGenericDaoAttribution = (value: string): boolean => {
  if (!value || DISPLAY_TEXT_PATTERN.test(value)) {
    return false;
  }

  return GENERIC_DAO_PATTERN.test(value.trim());
};

const looksLikeColonAttribution = (value: string): boolean => {
  if (!value || DISPLAY_TEXT_PATTERN.test(value)) {
    return false;
  }

  return COLON_ATTRIBUTION_PATTERN.test(value.trim());
};

const isAttributedDialogueSpan = (sourceText: string, span: QuotedSpan): boolean => {
  const prefix = sourceText.slice(0, span.start).trim();
  const suffix = sourceText.slice(span.end).trim();

  if (!prefix && !suffix) {
    return false;
  }

  if (DISPLAY_TEXT_PATTERN.test(prefix) || DISPLAY_TEXT_PATTERN.test(suffix)) {
    return false;
  }

  return (
    ATTRIBUTION_TOKEN_PATTERN.test(prefix) ||
    ATTRIBUTION_TOKEN_PATTERN.test(suffix) ||
    looksLikeColonAttribution(prefix) ||
    looksLikeColonAttribution(suffix) ||
    looksLikeGenericDaoAttribution(prefix) ||
    looksLikeGenericDaoAttribution(suffix)
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
    if (DISPLAY_TEXT_PATTERN.test(fragment)) {
      return false;
    }

    if (
      ATTRIBUTION_TOKEN_PATTERN.test(fragment) ||
      looksLikeColonAttribution(fragment) ||
      looksLikeGenericDaoAttribution(fragment)
    ) {
      hasAttribution = true;
      continue;
    }

    if (PUNCTUATION_ONLY_PATTERN.test(fragment)) {
      continue;
    }

    return false;
  }

  return hasAttribution;
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

const resolveDialogueText = (sourceText: string): string => {
  if (isPureQuotedText(sourceText)) {
    return stripBoundaryQuotes(sourceText);
  }

  const spans = findQuotedSpans(sourceText);
  if (spans.length === 0) {
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
    const text = asTrimmedString(sentence.text) || sourceText;

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

    if (comparableText !== comparableExpected) {
      issues.push(
        buildIssue(
          "TEXT_SOURCE_MISMATCH",
          "text 与 sourceText 不一致，疑似改写或边界漂移",
          index,
          previewText(sourceText)
        )
      );
      return;
    }

    if (
      speaker === "旁白" &&
      (isLikelySpeechQuotedText(sourceText) ||
        isAttributedDialogueQuotedText(sourceText))
    ) {
      issues.push(
        buildIssue(
          "QUOTED_NARRATION",
          "旁白句直接承载整段引号对白，疑似对白/旁白混抽",
          index,
          previewText(sourceText)
        )
      );
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
      issues.push(
        buildIssue(
          "NON_WHITESPACE_GAP",
          "原文中存在未覆盖内容，疑似漏抽",
          index,
          previewText(gap)
        )
      );
      return;
    }

    const end = start + sourceText.length;
    cursor = end;
    coveredLength += normalizeComparableText(sourceText).length;

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
    issues.push(
      buildIssue(
        "NON_WHITESPACE_GAP",
        "原文尾部存在未覆盖内容，疑似截断",
        undefined,
        previewText(trailingGap)
      )
    );
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

import { normalizeNarrationText } from "./narration-text-normalizer";
import {
  MIN_COVERAGE_RATIO,
  NARRATION_ACTION_CUE_PATTERN,
} from "./segment-script-validator-constants";
import type {
  RawScriptSentence,
  SegmentScriptValidationIssue,
  SegmentScriptValidationIssueCode,
  SegmentScriptValidationResult,
  ValidatedScriptSentence,
} from "./segment-script-validator-types";
import {
  asTrimmedString,
  normalizeComparableText,
  previewText,
} from "./segment-script-validator-text";
import {
  isAttributedDialogueQuotedText,
  isBoundaryQuoteFragment,
  isLikelySpeechQuotedText,
  resolveExpectedText,
} from "./segment-script-validator-quotes";
import { isIgnorableCoverageGap } from "./segment-script-validator-gap";
import { isDisplayTextCue } from "./dialogue-attribution-heuristics";

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

const isLikelyNarrationBoundaryFragment = (value: string): boolean => {
  if (!isBoundaryQuoteFragment(value)) {
    return false;
  }

  const body = value
    .trim()
    .replace(/^["“‘'「『]+/, "")
    .replace(/["”’'」』]+$/, "")
    .trim();

  if (!body || isDisplayTextCue(body) || !NARRATION_ACTION_CUE_PATTERN.test(body)) {
    return false;
  }

  return true;
};

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
      issues.push(buildIssue("MISSING_SOURCE_TEXT", "缺少可回溯的 sourceText", index));
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

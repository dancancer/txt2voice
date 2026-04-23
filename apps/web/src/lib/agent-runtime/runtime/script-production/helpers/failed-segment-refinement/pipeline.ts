// 一旦我被更新，请更新我的开头注释
// input: refinement 输入/切片与启发式阶段结果
// output: refinement 主流程
// pos: script production helper
/**
 * failed segment refinement 主流水线
 */

import { looksLikeColonAttribution } from "../dialogue-attribution-heuristics";
import {
  hasAttributionContext,
  hasExplicitSpeechAttribution,
  hasReportReadingContext,
  isBareSpeakerLabel,
  isLongMultiSentenceQuoteRun,
  reportQuoteHeuristics,
  splitQuotedSentence,
} from "./heuristics";
import { splitByQuoteBoundaries, splitBySentenceBoundaries } from "./slices";
import {
  ContentSlice,
  FailedSegmentRefinementInput,
  RefinedSegmentSlice,
  TARGET_ISSUE_CODES,
  QUOTE_CHAR_PATTERN,
} from "./types";

const mergeAdjacentNarrationSlices = (
  sourceContent: string,
  slices: ContentSlice[]
) => {
  const merged: ContentSlice[] = [];

  for (const slice of slices) {
    const last = merged[merged.length - 1];
    if (
      last &&
      !QUOTE_CHAR_PATTERN.test(last.content) &&
      !QUOTE_CHAR_PATTERN.test(slice.content) &&
      !hasAttributionContext(last.content) &&
      !hasAttributionContext(slice.content) &&
      !hasReportReadingContext(last.content) &&
      !hasReportReadingContext(slice.content) &&
      !looksLikeColonAttribution(last.content) &&
      !looksLikeColonAttribution(slice.content)
    ) {
      last.content = sourceContent.slice(last.start, slice.end);
      last.end = slice.end;
      continue;
    }

    merged.push({ ...slice });
  }

  return merged;
};

const mergeAttributedQuoteRuns = (slices: ContentSlice[]) => {
  const merged: ContentSlice[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const current = slices[index];
    if (
      !QUOTE_CHAR_PATTERN.test(current.content) &&
      hasAttributionContext(current.content)
    ) {
      let combinedContent = current.content;
      let end = current.end;
      let mergedAnyQuote = false;
      let quoteRunLength = 0;

      while (
        index + 1 < slices.length &&
        reportQuoteHeuristics.isPureQuotedSlice(slices[index + 1].content)
      ) {
        index += 1;
        combinedContent += slices[index].content;
        end = slices[index].end;
        mergedAnyQuote = true;
        quoteRunLength += 1;
      }

      if (mergedAnyQuote && quoteRunLength >= 2) {
        merged.push({
          start: current.start,
          end,
          content: combinedContent,
        });
        continue;
      }

      if (mergedAnyQuote) {
        index -= quoteRunLength;
      }
    }

    merged.push({ ...current });
  }

  return merged;
};

const mergeAttributedContextSlices = (
  sourceContent: string,
  slices: ContentSlice[]
) => {
  const merged: ContentSlice[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const current = { ...slices[index] };
    const next = slices[index + 1];

    if (!next) {
      merged.push(current);
      continue;
    }

    if (
      hasReportReadingContext(current.content) &&
      reportQuoteHeuristics.LEADING_QUOTE_PATTERN.test(next.content) &&
      (
        hasReportReadingContext(next.content) ||
        reportQuoteHeuristics.isLikelyReportQuoteSlice(next.content) ||
        isLongMultiSentenceQuoteRun(next.content)
      )
    ) {
      current.end = next.end;
      current.content = sourceContent.slice(current.start, current.end);
      index += 1;

      while (index + 1 < slices.length) {
        const following = slices[index + 1];
        if (
          !(
            (reportQuoteHeuristics.LEADING_QUOTE_PATTERN.test(following.content) &&
              (hasReportReadingContext(following.content) ||
                reportQuoteHeuristics.isLikelyReportQuoteSlice(following.content) ||
                isLongMultiSentenceQuoteRun(following.content))) ||
            (hasReportReadingContext(following.content) &&
              QUOTE_CHAR_PATTERN.test(following.content))
          )
        ) {
          break;
        }

        index += 1;
        current.end = following.end;
        current.content = sourceContent.slice(current.start, current.end);
      }
    }

    merged.push(current);
  }

  return merged;
};

const mergeReportContinuationRuns = (
  sourceContent: string,
  slices: ContentSlice[]
) => {
  const merged: ContentSlice[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const current = { ...slices[index] };

    if (
      !(
        hasReportReadingContext(current.content) &&
        QUOTE_CHAR_PATTERN.test(current.content)
      )
    ) {
      merged.push(current);
      continue;
    }

    while (index + 1 < slices.length) {
      const following = slices[index + 1];
      const shouldMergeFollowing =
        reportQuoteHeuristics.isLikelyReportQuoteSlice(following.content) ||
        (hasReportReadingContext(following.content) &&
          QUOTE_CHAR_PATTERN.test(following.content));

      if (!shouldMergeFollowing) {
        break;
      }

      index += 1;
      current.end = following.end;
      current.content = sourceContent.slice(current.start, current.end);
    }

    merged.push(current);
  }

  return merged;
};

const mergeImplicitActionAttributionWithFollowingQuote = (
  sourceContent: string,
  slices: ContentSlice[]
) => {
  const merged: ContentSlice[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const current = { ...slices[index] };
    const next = slices[index + 1];

    if (
      next &&
      !QUOTE_CHAR_PATTERN.test(current.content) &&
      looksLikeColonAttribution(current.content) &&
      !isBareSpeakerLabel(current.content) &&
      !hasExplicitSpeechAttribution(current.content) &&
      reportQuoteHeuristics.isPureQuotedSlice(next.content)
    ) {
      current.end = next.end;
      current.content = sourceContent.slice(current.start, current.end);
      index += 1;
    }

    merged.push(current);
  }

  return merged;
};

const mergeInterQuoteNarrationWithFollowingQuote = (
  sourceContent: string,
  slices: ContentSlice[]
) => {
  const merged: ContentSlice[] = [];

  for (let index = 0; index < slices.length; index += 1) {
    const current = { ...slices[index] };
    const previous = merged[merged.length - 1];
    const next = slices[index + 1];

    if (
      previous &&
      next &&
      reportQuoteHeuristics.isPureQuotedSlice(previous.content) &&
      !QUOTE_CHAR_PATTERN.test(current.content) &&
      !isBareSpeakerLabel(current.content) &&
      !hasExplicitSpeechAttribution(current.content) &&
      !hasReportReadingContext(current.content) &&
      current.content.length <= 80 &&
      isLongMultiSentenceQuoteRun(next.content)
    ) {
      current.end = next.end;
      current.content = sourceContent.slice(current.start, current.end);
      index += 1;
    }

    merged.push(current);
  }

  return merged;
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

  const shouldRefineHighCoverageMismatch = issueCodes.some(
    (code) =>
      code === "TEXT_SOURCE_MISMATCH" ||
      code === "SOURCE_NOT_FOUND" ||
      code === "QUOTED_NARRATION"
  );

  if (
    typeof failure.coverageRatio === "number" &&
    Number.isFinite(failure.coverageRatio) &&
    failure.coverageRatio >= 0.99 &&
    !shouldRefineHighCoverageMismatch
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
  const rawSlices = mergeAttributedContextSlices(
    segment.content,
    mergeAttributedQuoteRuns(
      mergeAdjacentNarrationSlices(
        segment.content,
        bySentence.flatMap((slice) => splitQuotedSentence(slice))
      )
    )
  );
  const normalizedSlices = mergeInterQuoteNarrationWithFollowingQuote(
    segment.content,
    mergeImplicitActionAttributionWithFollowingQuote(
      segment.content,
      mergeReportContinuationRuns(segment.content, rawSlices)
    )
  );
  const fallbackSlices =
    normalizedSlices.length > 1
      ? normalizedSlices
      : splitByQuoteBoundaries(segment.content);

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

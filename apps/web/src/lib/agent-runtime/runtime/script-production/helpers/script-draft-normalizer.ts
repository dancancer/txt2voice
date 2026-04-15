import type { SegmentScriptDraft, SegmentScriptDraftLine } from "../../../context";
import {
  DIALOGUE_OPENING_QUOTES,
  findQuotedSpans,
  hasWeakAttributionCue,
  normalizeComparableText,
  normalizeLine,
  normalizeNarrationDialogueBoundary,
  normalizePureQuotedLeafSource,
  normalizeUnknownNarrationBoundary,
  stripBoundaryQuoteFragments,
  splitMixedDialogueLine,
} from "./script-draft-normalizer-helpers";
import { resolveScriptLineText } from "./segment-script-validator";
import { isDisplayTextCue } from "./dialogue-attribution-heuristics";

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

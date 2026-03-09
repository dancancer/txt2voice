import { CONFIG } from "./constants";

export interface TextSegmentationRiskProfile {
  sentenceCount: number;
  quoteCount: number;
  quoteRatio: number;
  dialogueLineCount: number;
  preferredMaxSegmentLength: number;
  preferredMinSegmentLength: number;
  reasons: string[];
}

const DOUBLE_QUOTE_CHARS = new Set(["\"", "“", "”", "「", "」", "『", "』"]);
const SINGLE_QUOTE_PAIRS: Array<{ open: string; close: string }> = [
  { open: "‘", close: "’" },
  { open: "'", close: "'" },
];
const QUOTE_BOUNDARY_PATTERN = /[\s([{<>,.!?;:，。！？；：、]/;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const countMatches = (content: string, pattern: RegExp): number => {
  return (content.match(pattern) || []).length;
};

const isBoundaryChar = (value: string | undefined): boolean => {
  if (!value) {
    return true;
  }

  return QUOTE_BOUNDARY_PATTERN.test(value);
};

const looksLikeSingleQuotedDialogueBody = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.length === 1 && /^[A-Za-z0-9]$/.test(trimmed)) {
    return false;
  }

  if (/^\d{2,4}s$/i.test(trimmed)) {
    return false;
  }

  return /[A-Za-z\u4e00-\u9fff]/.test(trimmed);
};

const countSingleQuotedDialogueMarks = (content: string): number => {
  let count = 0;

  for (const { open, close } of SINGLE_QUOTE_PAIRS) {
    let cursor = 0;

    while (cursor < content.length) {
      const start = content.indexOf(open, cursor);
      if (start < 0) {
        break;
      }

      const previous = content[start - 1];
      if (!isBoundaryChar(previous)) {
        cursor = start + open.length;
        continue;
      }

      const end = content.indexOf(close, start + open.length);
      if (end < 0) {
        break;
      }

      const next = content[end + close.length];
      const body = content.slice(start + open.length, end);

      if (isBoundaryChar(next) && looksLikeSingleQuotedDialogueBody(body)) {
        count += 2;
        cursor = end + close.length;
        continue;
      }

      cursor = start + open.length;
    }
  }

  return count;
};

const countDialogueQuotes = (content: string): number => {
  let count = 0;

  for (const char of content) {
    if (DOUBLE_QUOTE_CHARS.has(char)) {
      count += 1;
    }
  }

  return count + countSingleQuotedDialogueMarks(content);
};

const containsDialogueQuote = (content: string): boolean => {
  return countDialogueQuotes(content) > 0;
};

export function resolveTextSegmentationRiskProfile(
  content: string,
  options: {
    maxSegmentLength?: number;
    minSegmentLength?: number;
  } = {}
): TextSegmentationRiskProfile {
  const baseMax =
    options.maxSegmentLength || CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH;
  const baseMin =
    options.minSegmentLength || CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH;
  const normalized = content.trim();

  if (!normalized) {
    return {
      sentenceCount: 0,
      quoteCount: 0,
      quoteRatio: 0,
      dialogueLineCount: 0,
      preferredMaxSegmentLength: baseMax,
      preferredMinSegmentLength: baseMin,
      reasons: ["empty"],
    };
  }

  const sentenceCount = Math.max(countMatches(normalized, /[。！？；.!?…]/g), 1);
  const quoteCount = countDialogueQuotes(normalized);
  const dialogueLineCount = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => containsDialogueQuote(line)).length;
  const quoteRatio = quoteCount / Math.max(normalized.length, 1);

  let preferredMaxSegmentLength = baseMax;
  let preferredMinSegmentLength = baseMin;
  const reasons: string[] = [];

  if (quoteRatio >= 0.08 || dialogueLineCount >= 4) {
    preferredMaxSegmentLength = Math.min(
      preferredMaxSegmentLength,
      Math.max(260, Math.round(baseMax * 0.6))
    );
    preferredMinSegmentLength = Math.min(
      preferredMinSegmentLength,
      Math.max(120, Math.round(baseMin * 0.5))
    );
    reasons.push("dialogue_dense");
  }

  if (sentenceCount >= 12 && quoteRatio >= 0.04) {
    preferredMaxSegmentLength = Math.min(
      preferredMaxSegmentLength,
      Math.max(300, Math.round(baseMax * 0.75))
    );
    preferredMinSegmentLength = Math.min(
      preferredMinSegmentLength,
      Math.max(160, Math.round(baseMin * 0.6))
    );
    reasons.push("mixed_dense_scene");
  }

  if (sentenceCount >= 18) {
    preferredMaxSegmentLength = Math.min(
      preferredMaxSegmentLength,
      Math.max(320, Math.round(baseMax * 0.8))
    );
    preferredMinSegmentLength = Math.min(
      preferredMinSegmentLength,
      Math.max(180, Math.round(baseMin * 0.7))
    );
    reasons.push("multi_sentence");
  }

  const normalizedMax = clamp(preferredMaxSegmentLength, 220, baseMax);
  const normalizedMin = clamp(
    Math.min(preferredMinSegmentLength, normalizedMax - 40),
    80,
    Math.max(80, normalizedMax - 40)
  );

  return {
    sentenceCount,
    quoteCount,
    quoteRatio,
    dialogueLineCount,
    preferredMaxSegmentLength: normalizedMax,
    preferredMinSegmentLength: normalizedMin,
    reasons: reasons.length > 0 ? reasons : ["default"],
  };
}

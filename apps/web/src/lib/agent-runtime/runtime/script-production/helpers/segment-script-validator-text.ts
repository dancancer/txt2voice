import {
  DIALOGUE_CLOSING_QUOTES,
  DIALOGUE_OPENING_QUOTES,
} from "./segment-script-validator-constants";

export const asTrimmedString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

export const normalizeComparableText = (value: string): string => {
  return value
    .replace(/\s+/g, "")
    .replace(/[“”‘’]/g, '"')
    .replace(/[「」『』]/g, '"');
};

export const stripBoundaryQuotes = (value: string): string => {
  return value
    .trim()
    .replace(DIALOGUE_OPENING_QUOTES, "")
    .replace(DIALOGUE_CLOSING_QUOTES, "")
    .trim();
};

export const stripLeadingDialoguePunctuation = (value: string): string => {
  return value.replace(/^[，、；：,:]+/, "").trim();
};

export const stripDanglingDialoguePunctuation = (value: string): string => {
  return value.replace(/^[，、；：,:]+|[，、；：,:]+$/g, "").trim();
};

export const previewText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
};

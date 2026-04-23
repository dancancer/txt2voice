import {
  AD_NOISE_KEYWORDS,
  AD_NOISE_LINK_PATTERN,
  GAP_QUOTE_CHAR_PATTERN,
} from "./segment-script-validator-constants";

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

  if (hasLinkCue && keywordHits >= 1) return true;
  if (hasDecorativePrefix && keywordHits >= 2) return true;
  return false;
};

export const isIgnorableCoverageGap = (value: string): boolean => {
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

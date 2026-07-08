const NARRATION_WRAPPER_PAIRS = [
  { open: "（", close: "）" },
  { open: "(", close: ")" },
];

const normalizeComparableNarrationText = (value: string): string =>
  value.replace(/\s+/g, "");

const stripBalancedNarrationWrappers = (value: string): string => {
  let current = value.trim();

  while (current.length > 0) {
    const matchedPair = NARRATION_WRAPPER_PAIRS.find(
      ({ open, close }) =>
        current.startsWith(open) &&
        current.endsWith(close) &&
        current.length > open.length + close.length
    );

    if (!matchedPair) {
      return current;
    }

    current = current
      .slice(matchedPair.open.length, current.length - matchedPair.close.length)
      .trim();
  }

  return value.trim();
};

export const normalizeNarrationText = (params: {
  sourceText: string;
  text: string;
}): string => {
  const sourceText = params.sourceText.trim();
  const text = params.text.trim();

  if (!sourceText || !text) {
    return text;
  }

  const unwrapped = stripBalancedNarrationWrappers(text);
  if (
    normalizeComparableNarrationText(unwrapped) ===
    normalizeComparableNarrationText(sourceText)
  ) {
    return sourceText;
  }

  return text;
};

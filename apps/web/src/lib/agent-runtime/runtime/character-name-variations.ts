const unique = (values: string[]): string[] => [...new Set(values)];

export const generateCommonCharacterNameVariations = (name: string): string[] => {
  const canonicalName = name.trim();
  if (!canonicalName) {
    return [];
  }

  const variations: string[] = [];

  if (
    canonicalName.includes("先生") ||
    canonicalName.includes("小姐") ||
    canonicalName.includes("女士")
  ) {
    variations.push(canonicalName.replace(/先生|小姐|女士/g, ""));
  }

  return unique(
    variations
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== canonicalName)
  );
};

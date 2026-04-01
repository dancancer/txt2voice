export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function toFiniteNumber(
  value: unknown,
  fallback: number | null
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function normalizeNumber(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePitch(value: unknown): number {
  const parsed = normalizeNumber(value, 0);
  if (parsed >= 0.5 && parsed <= 2) {
    return (parsed - 1) * 20;
  }

  return parsed;
}

export function normalizeStrength(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clamp(parsed, 0, 100);
}

export function resolveStyleFromTone(
  tone: string,
  availableStyles: string[]
): string | undefined {
  if (!tone || !Array.isArray(availableStyles) || availableStyles.length === 0) {
    return undefined;
  }

  const normalizedTone = tone.toLowerCase();
  const matched = availableStyles.find((style) =>
    normalizedTone.includes(style.toLowerCase())
  );
  if (matched) {
    return matched;
  }

  const toneStyleMap: Array<{ keywords: string[]; styleHints: string[] }> = [
    { keywords: ["平静", "冷静", "calm"], styleHints: ["calm", "neutral", "gentle"] },
    { keywords: ["激动", "兴奋", "cheerful"], styleHints: ["cheerful", "excited"] },
    { keywords: ["悲伤", "伤心", "sad"], styleHints: ["sad", "melancholic"] },
    { keywords: ["愤怒", "生气", "angry"], styleHints: ["angry", "serious"] },
    { keywords: ["温柔", "柔和", "gentle"], styleHints: ["gentle", "friendly"] },
    { keywords: ["严肃", "庄重", "serious"], styleHints: ["serious", "narrative"] },
  ];

  for (const mapping of toneStyleMap) {
    if (!mapping.keywords.some((keyword) => normalizedTone.includes(keyword))) {
      continue;
    }

    const style = mapping.styleHints.find((hint) =>
      availableStyles.some(
        (candidate) => candidate.toLowerCase() === hint.toLowerCase()
      )
    );
    if (style) {
      return style;
    }
  }

  return undefined;
}

export function estimateAudioDuration(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const chineseDuration = chineseChars / 3.5;
  const englishDuration = englishWords / 2.5;
  const totalSeconds = chineseDuration + englishDuration || 0.5;

  return Number(totalSeconds.toFixed(2));
}

export function resolveAudioDurationSeconds(
  text: string,
  reportedDuration?: number
): number {
  const durationSeconds =
    typeof reportedDuration === "number" && reportedDuration > 0
      ? reportedDuration
      : estimateAudioDuration(text);

  return Number(Math.min(durationSeconds, 999.99).toFixed(2));
}

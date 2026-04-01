import type { DetectedChapterSlice } from "../types";

const CHAPTER_HEADING_PATTERNS = [
  "#{1,6}\\s+.+",
  "第[零一二三四五六七八九十百千万两\\d]+[章节卷篇回部][^\\n]*",
  "第\\s*\\d+\\s*(?:章|节)[^\\n]*",
  "Chapter\\s+\\d+[^\\n]*",
  "CHAPTER\\s+\\d+[^\\n]*",
  "Section\\s+\\d+[^\\n]*",
  "Part\\s+\\d+[^\\n]*",
];

const CHAPTER_HEADING_REGEX = new RegExp(
  `^(?:${CHAPTER_HEADING_PATTERNS.join("|")})\\s*$`,
  "gmi"
);

function generateFallbackTitle(order: number): string {
  return `第${order + 1}章`;
}

function normalizeChapterTitle(rawTitle: string, fallbackIndex: number): string {
  if (!rawTitle) {
    return generateFallbackTitle(fallbackIndex);
  }

  const cleaned = rawTitle
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[\s\-:：、.]+/, "")
    .replace(/[\s\-:：、.]+$/, "")
    .trim();

  return cleaned || generateFallbackTitle(fallbackIndex);
}

/**
 * ============================================
 * 章节检测
 * ============================================
 */
export function splitContentIntoChapters(content: string): DetectedChapterSlice[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const matches = Array.from(normalized.matchAll(CHAPTER_HEADING_REGEX));
  const slices: DetectedChapterSlice[] = [];
  let chapterCounter = 0;

  const pushSlice = (params: {
    title?: string;
    rawTitle?: string;
    heading?: string;
    body: string;
    detectionMethod: DetectedChapterSlice["detectionMethod"];
    isFallback?: boolean;
    preserveEmpty?: boolean;
  }) => {
    const trimmedBody = params.body ? params.body.trim() : "";
    if (!trimmedBody && !params.preserveEmpty) {
      return;
    }

    const title = (params.title || params.rawTitle || "").trim();
    const finalTitle = title || generateFallbackTitle(chapterCounter);
    slices.push({
      index: chapterCounter,
      title: finalTitle,
      rawTitle: params.rawTitle || title || finalTitle,
      heading: params.heading,
      body: trimmedBody,
      detectionMethod: params.detectionMethod,
      isFallback: params.isFallback ?? false,
    });
    chapterCounter += 1;
  };

  if (matches.length === 0) {
    pushSlice({
      title: generateFallbackTitle(0),
      body: normalized,
      detectionMethod: "fallback",
      isFallback: true,
      preserveEmpty: true,
    });
    return slices;
  }

  const firstMatchIndex = matches[0]?.index ?? 0;
  if (firstMatchIndex > 0) {
    const prefixContent = normalized.slice(0, firstMatchIndex);
    if (prefixContent.trim().length > 0) {
      pushSlice({
        title: "序章",
        rawTitle: "序章",
        heading: "序章",
        body: prefixContent,
        detectionMethod: "preface",
        isFallback: true,
        preserveEmpty: true,
      });
    }
  }

  matches.forEach((match, index) => {
    const headingLine = match[0].trim();
    const headingEnd = (match.index ?? 0) + match[0].length;
    const nextStart = matches[index + 1]?.index ?? normalized.length;
    const body = normalized.slice(headingEnd, nextStart);

    pushSlice({
      title: normalizeChapterTitle(headingLine, chapterCounter),
      rawTitle: headingLine,
      heading: headingLine,
      body,
      detectionMethod: "detected",
      preserveEmpty: true,
    });
  });

  return slices;
}

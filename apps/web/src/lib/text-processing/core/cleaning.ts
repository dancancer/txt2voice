import type { TextProcessingOptions } from "../types";

/**
 * ============================================
 * 文本清洗与基础统计
 * ============================================
 */
export function cleanText(
  text: string,
  options: TextProcessingOptions = {}
): string {
  const { preserveFormatting = true } = options;

  let cleaned = text;
  cleaned = cleaned.replace(/^\uFEFF/, "");
  cleaned = cleaned.replace(/\0/g, "");
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (!preserveFormatting) {
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    cleaned = cleaned.replace(/[ \t]+/g, " ");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.trim();
  } else {
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  return cleaned.normalize("NFC");
}

export function detectFileFormat(
  filename: string,
  content: string
): "txt" | "md" {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (extension === ".md") {
    return "md";
  }

  const markdownPatterns = [
    /^#{1,6}\s+/m,
    /\*\*.*?\*\*/,
    /\*.*?\*/,
    /\[.*?\]\(.*?\)/,
    /^[-*+]\s+/m,
    /^\d+\.\s+/m,
    /```[\s\S]*?```/,
  ];

  for (const pattern of markdownPatterns) {
    if (pattern.test(content)) {
      return "md";
    }
  }

  return "txt";
}

export function countWords(text: string): number {
  const normalizedText = text
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1");

  const chineseChars = (
    normalizedText.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []
  ).length;
  const englishWords = (normalizedText.match(/[a-zA-Z]+/g) || []).length;

  return chineseChars + englishWords;
}

import { logger } from "../../logger";

/**
 * ============================================
 * 内容落库清洗
 * ============================================
 */
export function sanitizeContent(content: string): string {
  const originalLength = content.length;
  const cleaned = content
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .normalize("NFC");

  const removedCount = originalLength - cleaned.length;
  if (removedCount > 0) {
    logger.debug("Sanitized content", {
      originalLength,
      cleanedLength: cleaned.length,
      removedCount,
      preview: `${content.slice(0, 50)}...`,
    });
  }

  return cleaned;
}

import { Prisma } from "@/generated/prisma";

import { countWords } from "../core/cleaning";
import { sanitizeContent } from "./content-sanitizer";
import type { TextSegmentData } from "../types";

/**
 * ============================================
 * 记录构建
 * ============================================
 */
export function createTextSegmentRecords(
  bookId: string,
  segments: TextSegmentData[]
): Prisma.TextSegmentCreateManyInput[] {
  let currentPosition = 0;

  return segments.map((segment, index) => {
    const sanitizedContent = sanitizeContent(segment.content);
    const startPosition = currentPosition;
    const endPosition = currentPosition + sanitizedContent.length;
    currentPosition = endPosition;

    return {
      bookId,
      segmentIndex: index,
      startPosition,
      endPosition,
      content: sanitizedContent,
      wordCount: segment.wordCount ?? countWords(sanitizedContent),
      segmentType: segment.type,
      orderIndex: segment.order,
      metadata: (segment.metadata || {}) as Prisma.InputJsonValue,
      status: "pending",
    };
  });
}

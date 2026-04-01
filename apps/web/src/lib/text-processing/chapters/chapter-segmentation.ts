import { randomUUID } from "crypto";

import { Prisma } from "@/generated/prisma";

import { CONFIG } from "../../constants";
import { FileProcessingError } from "../../error-handler";
import { resolveTextSegmentationRiskProfile } from "../../text-segmentation-profile";
import { countWords } from "../core/cleaning";
import { segmentText } from "../segmentation/segmenter";
import { sanitizeContent } from "../persistence/content-sanitizer";
import { splitContentIntoChapters } from "./chapter-detection";
import type {
  ChapterSegmentBuildResult,
  TextProcessingOptions,
} from "../types";

/**
 * ============================================
 * 章节切分与记录构建
 * ============================================
 */
export function createChapterSegmentRecords(
  bookId: string,
  content: string,
  options: TextProcessingOptions = {}
): ChapterSegmentBuildResult {
  const chapterSlices = splitContentIntoChapters(content);

  if (chapterSlices.length === 0) {
    throw new FileProcessingError("未检测到有效章节", "CORRUPTED_FILE", {
      message: "请确认文本内容是否包含章节信息",
    });
  }

  const chapterRecords: Prisma.ChapterCreateManyInput[] = [];
  const segmentRecords: Prisma.TextSegmentCreateManyInput[] = [];
  const segmentTypeStats: Record<string, number> = {};
  const baseMaxSegmentLength =
    options.maxSegmentLength || CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH;
  const baseMinSegmentLength =
    options.minSegmentLength || CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH;

  let globalSegmentIndex = 0;
  let globalPosition = 0;
  let totalWordCount = 0;

  for (const slice of chapterSlices) {
    const chapterId = randomUUID();
    const chapterStartPosition = globalPosition;
    const riskProfile = resolveTextSegmentationRiskProfile(slice.body, {
      maxSegmentLength: baseMaxSegmentLength,
      minSegmentLength: baseMinSegmentLength,
    });
    const chapterSegments = segmentText(slice.body, {
      ...options,
      maxSegmentLength: riskProfile.preferredMaxSegmentLength,
      minSegmentLength: riskProfile.preferredMinSegmentLength,
    });

    let chapterWordCount = 0;
    let chapterCharacterCount = 0;
    let chapterOrderIndex = 0;

    for (const segment of chapterSegments) {
      const sanitizedContent = sanitizeContent(segment.content);
      if (!sanitizedContent.length) {
        continue;
      }

      const wordCount = segment.wordCount ?? countWords(sanitizedContent);
      segmentRecords.push({
        bookId,
        chapterId,
        segmentIndex: globalSegmentIndex,
        startPosition: globalPosition,
        endPosition: globalPosition + sanitizedContent.length,
        content: sanitizedContent,
        wordCount,
        segmentType: segment.type,
        orderIndex: globalSegmentIndex,
        chapterOrderIndex,
        metadata: {
          ...(segment.metadata || {}),
          chapterIndex: slice.index,
          chapterTitle: slice.title,
          chapterOrderIndex,
          segmentationRiskReasons: riskProfile.reasons,
          segmentationQuoteRatio: Number(riskProfile.quoteRatio.toFixed(4)),
          segmentationSentenceCount: riskProfile.sentenceCount,
          segmentationTargetMaxLength: riskProfile.preferredMaxSegmentLength,
          segmentationTargetMinLength: riskProfile.preferredMinSegmentLength,
        } as Prisma.InputJsonValue,
        status: "pending",
      });

      segmentTypeStats[segment.type] = (segmentTypeStats[segment.type] || 0) + 1;
      globalSegmentIndex += 1;
      chapterOrderIndex += 1;
      globalPosition += sanitizedContent.length;
      chapterWordCount += wordCount;
      chapterCharacterCount += sanitizedContent.length;
      totalWordCount += wordCount;
    }

    chapterRecords.push({
      id: chapterId,
      bookId,
      chapterIndex: slice.index,
      title: slice.title,
      rawTitle: slice.rawTitle,
      startPosition: chapterStartPosition,
      endPosition: globalPosition,
      wordCount: chapterWordCount,
      characterCount: chapterCharacterCount,
      totalSegments: chapterOrderIndex,
      status: chapterOrderIndex > 0 ? "processed" : "pending",
      metadata: {
        heading: slice.heading,
        detectionMethod: slice.detectionMethod,
        isFallback: slice.isFallback,
        segmentationRiskReasons: riskProfile.reasons,
        segmentationQuoteRatio: Number(riskProfile.quoteRatio.toFixed(4)),
        segmentationSentenceCount: riskProfile.sentenceCount,
        segmentationDialogueLineCount: riskProfile.dialogueLineCount,
        segmentationTargetMaxLength: riskProfile.preferredMaxSegmentLength,
        segmentationTargetMinLength: riskProfile.preferredMinSegmentLength,
      } as Prisma.InputJsonValue,
    });
  }

  if (segmentRecords.length === 0) {
    throw new FileProcessingError("文本分割失败", "CORRUPTED_FILE", {
      message: "章节内没有可用的文本内容",
    });
  }

  return {
    chapterRecords,
    segmentRecords,
    statistics: {
      totalChapters: chapterRecords.length,
      totalSegments: segmentRecords.length,
      totalWords: totalWordCount,
      avgWordsPerSegment:
        segmentRecords.length > 0
          ? Math.round(totalWordCount / segmentRecords.length)
          : 0,
      segmentTypes: segmentTypeStats,
    },
  };
}

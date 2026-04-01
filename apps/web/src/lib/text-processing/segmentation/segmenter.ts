import { CONFIG } from "../../constants";
import { logger } from "../../logger";
import { calculateTextLength, smartSplitText } from "../../text-splitter";
import {
  SmartTextSplitter,
  validateSegmentQuality,
} from "../../smart-text-splitter";
import { countWords } from "../core/cleaning";
import { detectContentType } from "./content-type";
import { detectSegmentType } from "./segment-classification";
import type { TextProcessingOptions, TextSegmentData } from "../types";

/**
 * ============================================
 * 文本分段
 * ============================================
 */
export function segmentText(
  content: string,
  options: TextProcessingOptions = {}
): TextSegmentData[] {
  const {
    maxSegmentLength = CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH,
    minSegmentLength = CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH,
    useSmartSplitter = true,
  } = options;

  logger.info("Starting text segmentation", {
    contentLength: content.length,
    maxSegmentLength,
    minSegmentLength,
    useSmartSplitter,
  });

  const segments = useSmartSplitter
    ? segmentWithSmartSplitter(content, options)
    : segmentWithTraditionalSplitter(content, options);

  logger.info("Text segmentation completed", {
    totalSegments: segments.length,
    avgSegmentLength:
      segments.length > 0
        ? Math.round(
            segments.reduce((sum, segment) => sum + segment.content.length, 0) /
              segments.length
          )
        : 0,
    method: useSmartSplitter ? "smart_splitter" : "traditional",
  });

  return segments;
}

function segmentWithSmartSplitter(
  content: string,
  options: TextProcessingOptions
): TextSegmentData[] {
  const {
    maxSegmentLength = CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH,
    minSegmentLength = CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH,
  } = options;
  const targetLength = Math.min(
    Math.max(
      Math.round((maxSegmentLength + minSegmentLength) / 2),
      minSegmentLength
    ),
    maxSegmentLength
  );
  const tolerance = Math.max(
    40,
    Math.round((maxSegmentLength - minSegmentLength) / 2)
  );

  const splitter = new SmartTextSplitter({
    targetLength,
    maxLength: maxSegmentLength,
    minLength: minSegmentLength,
    tolerance,
    preferSentenceBoundary: true,
  });

  const smartSegments = splitter.split(content);
  const validation = validateSegmentQuality(smartSegments, {
    targetLength,
    maxLength: maxSegmentLength,
    minLength: minSegmentLength,
    tolerance,
  });

  if (!validation.valid) {
    logger.warn("Segment quality issues detected", {
      issues: validation.issues,
      stats: validation.stats,
    });
  }

  logger.info("Smart splitting quality stats", validation.stats);

  return smartSegments.map((smartSegment) => {
    const cleanedContent = smartSegment.content.trim();

    return {
      order: smartSegment.order,
      content: cleanedContent,
      wordCount: countWords(cleanedContent),
      type: detectSegmentType(cleanedContent),
      metadata: {
        characterCount: cleanedContent.length,
        smartLength: smartSegment.length,
        breakReason: smartSegment.metadata?.breakReason,
        hasDialogue: /[""「」].*?[""「」]/.test(cleanedContent),
        hasDescription: /[，。！？；：]/.test(cleanedContent),
        splitMethod: "smart_splitter",
        ...smartSegment.metadata,
      },
    };
  });
}

function segmentWithTraditionalSplitter(
  content: string,
  options: TextProcessingOptions
): TextSegmentData[] {
  const {
    maxSegmentLength = CONFIG.TEXT_PROCESSING.MAX_SEGMENT_LENGTH,
    minSegmentLength = CONFIG.TEXT_PROCESSING.MIN_SEGMENT_LENGTH,
  } = options;

  const contentType = detectContentType(content);
  logger.debug("Content type detected", { contentType });

  const chunks = smartSplitText(content, {
    contentType,
    chunkSize: maxSegmentLength,
    chunkOverlap: Math.floor(maxSegmentLength * 0.05),
  });

  const segments: TextSegmentData[] = [];
  let segmentOrder = 0;

  for (const chunk of chunks) {
    const length = calculateTextLength(chunk);

    if (length >= minSegmentLength) {
      segments.push(createTextSegment(chunk, segmentOrder++));
      continue;
    }

    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const mergedContent = `${lastSegment.content}\n\n${chunk}`;
      const mergedLength = calculateTextLength(mergedContent);

      if (mergedLength <= maxSegmentLength * 1.2) {
        lastSegment.content = mergedContent;
        lastSegment.wordCount = countWords(mergedContent);
        lastSegment.metadata = {
          ...lastSegment.metadata,
          characterCount: mergedContent.length,
          merged: true,
        };
      } else {
        segments.push(createTextSegment(chunk, segmentOrder++));
      }
    } else {
      segments.push(createTextSegment(chunk, segmentOrder++));
    }
  }

  return segments;
}

function createTextSegment(content: string, order: number): TextSegmentData {
  const cleanedContent = content.trim();

  return {
    order,
    content: cleanedContent,
    wordCount: countWords(cleanedContent),
    type: detectSegmentType(cleanedContent),
    metadata: {
      characterCount: cleanedContent.length,
      hasDialogue: /[""「」].*?[""「」]/.test(cleanedContent),
      hasDescription: /[，。！？；：]/.test(cleanedContent),
    },
  };
}

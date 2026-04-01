// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import * as iconv from "iconv-lite";

import { FileProcessingError } from "./error-handler";
import { logger } from "./logger";
import { detectEncoding } from "./text-processing/core/encoding";
import {
  cleanText,
  countWords,
  detectFileFormat,
} from "./text-processing/core/cleaning";
import { createChapterSegmentRecords } from "./text-processing/chapters/chapter-segmentation";
import { createTextSegmentRecords } from "./text-processing/persistence/record-builders";
import { segmentText } from "./text-processing/segmentation/segmenter";
import type {
  ChapterSegmentBuildResult,
  ProcessedText,
  TextProcessingOptions,
  TextSegmentData,
} from "./text-processing/types";

export type {
  ChapterSegmentBuildResult,
  ProcessedText,
  TextProcessingOptions,
  TextSegmentData,
} from "./text-processing/types";

export {
  cleanText,
  countWords,
  createChapterSegmentRecords,
  createTextSegmentRecords,
  detectEncoding,
  detectFileFormat,
  segmentText,
};

/**
 * ============================================
 * 文件内容处理 facade
 * ============================================
 */
export function processFileContent(
  buffer: Buffer,
  filename: string,
  options: TextProcessingOptions = {}
): ProcessedText {
  const encoding = options.encoding || detectEncoding(buffer);

  logger.info("Processing file content", {
    filename,
    encoding,
    bufferSize: buffer.length,
  });

  const content =
    encoding === "gbk" || encoding === "gb2312" || encoding === "big5"
      ? iconv.decode(buffer, encoding)
      : buffer.toString(encoding as BufferEncoding);

  const detectedFormat = detectFileFormat(filename, content);
  const cleanedContent = cleanText(content, options);

  if (!cleanedContent.trim()) {
    throw new FileProcessingError("文件内容为空", "CORRUPTED_FILE", {
      message: "文件不包含任何有效文本内容",
    });
  }

  const characterCount = cleanedContent.length;
  const wordCount = countWords(cleanedContent);

  logger.info("File content processed", {
    encoding,
    detectedFormat,
    characterCount,
    wordCount,
  });

  return {
    content: cleanedContent,
    wordCount,
    characterCount,
    encoding,
    detectedFormat,
  };
}

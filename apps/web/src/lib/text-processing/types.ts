import { Prisma } from "@/generated/prisma";

export interface TextProcessingOptions {
  maxSegmentLength?: number;
  minSegmentLength?: number;
  preserveFormatting?: boolean;
  encoding?: BufferEncoding;
  useSmartSplitter?: boolean;
}

export interface ProcessedText {
  content: string;
  wordCount: number;
  characterCount: number;
  encoding: string;
  detectedFormat: "txt" | "md";
}

export interface TextSegmentData {
  order: number;
  content: string;
  wordCount: number;
  type: "paragraph" | "dialogue" | "scene" | "chapter";
  metadata?: Record<string, any>;
}

export interface DetectedChapterSlice {
  index: number;
  title: string;
  rawTitle?: string;
  heading?: string;
  body: string;
  detectionMethod: "detected" | "preface" | "fallback";
  isFallback: boolean;
}

export interface ChapterSegmentBuildResult {
  chapterRecords: Prisma.ChapterCreateManyInput[];
  segmentRecords: Prisma.TextSegmentCreateManyInput[];
  statistics: {
    totalChapters: number;
    totalSegments: number;
    totalWords: number;
    avgWordsPerSegment: number;
    segmentTypes: Record<string, number>;
  };
}

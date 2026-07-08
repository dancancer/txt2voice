// 一旦我被更新，请更新我的开头注释
// input: refinement 失败上下文/对白符号常量
// output: refinement 共享类型与常量
// pos: script production helper
/**
 * failed segment refinement 共享定义
 */

export interface FailedSegmentRefinementInput {
  segment: {
    id: string;
    chapterId?: string | null;
    orderIndex?: number;
    content: string;
  };
  failure: {
    errorCode?: string;
    issueCodes?: string[];
    coverageRatio?: number | null;
  };
}

export interface RefinedSegmentSlice {
  id: string;
  parentSegmentId: string;
  chapterId: string | null;
  orderIndex: number;
  content: string;
  offsetStart: number;
  offsetEnd: number;
}

export interface QuoteSpan {
  start: number;
  end: number;
}

export interface ContentSlice {
  start: number;
  end: number;
  content: string;
}

export const TARGET_ISSUE_CODES = new Set([
  "TEXT_SOURCE_MISMATCH",
  "NON_WHITESPACE_GAP",
  "SOURCE_NOT_FOUND",
  "QUOTED_NARRATION",
]);

export const SENTENCE_BOUNDARY_CHARS = new Set([
  "。",
  "！",
  "？",
  "；",
  "!",
  "?",
  "…",
]);

export const QUOTE_CHAR_PATTERN = /[“”「」『』‘’"']/;
export const LEADING_QUOTE_PATTERN = /^\s*[“「『‘"']/;
export const LEADING_AND_TRAILING_QUOTE_PATTERN =
  /^\s*[“「『‘"']([\s\S]*?)[”」』’"']\s*$/;

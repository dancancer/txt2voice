// 一旦我被更新，请更新我的开头注释
// input: URLSearchParams
// output: 核心 SLO 告警查询参数
// pos: S32 告警参数解析
import { ValidationError } from "@/lib/error-handler";
import { parseBookSloMetricsQuery } from "@/lib/slo-metrics/query";
import type {
  SloAlertQuery,
  SloAlertScanQuery,
  SloAlertScheduleQuery,
} from "@/lib/slo-alerts/types";

const DEFAULT_PIPELINE_SUCCESS_RATE_MIN = 0.95;
const DEFAULT_CHAPTER_CONSISTENCY_FAIL_RATE_MAX = 0.03;
const DEFAULT_SCAN_MAX_BOOKS = 50;
const MAX_SCAN_MAX_BOOKS = 200;

const parseRatio = ({
  raw,
  field,
  fallback,
}: {
  raw: string | null;
  field: string;
  fallback: number | null;
}): number | null => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError(`${field} 必须是 0-1 之间的数字`);
  }
  return Number(value);
};

const parseNonNegative = ({
  raw,
  field,
  fallback,
}: {
  raw: string | null;
  field: string;
  fallback: number | null;
}): number | null => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} 必须是非负数字`);
  }
  return Number(value);
};

const parseBoolean = ({
  raw,
  field,
  fallback,
}: {
  raw: string | null;
  field: string;
  fallback: boolean;
}): boolean => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  throw new ValidationError(`${field} 仅支持 true/false`);
};

const parseMaxBooks = (raw: string | null): number => {
  if (raw === null || raw.trim().length === 0) {
    return DEFAULT_SCAN_MAX_BOOKS;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SCAN_MAX_BOOKS) {
    throw new ValidationError(`maxBooks 必须是 1-${MAX_SCAN_MAX_BOOKS} 的整数`);
  }
  return Number(value);
};

export const parseSloAlertQuery = (searchParams: URLSearchParams): SloAlertQuery => {
  const base = parseBookSloMetricsQuery(searchParams);
  return {
    ...base,
    pipelineSuccessRateMin: parseRatio({
      raw: searchParams.get("pipelineSuccessRateMin"),
      field: "pipelineSuccessRateMin",
      fallback: DEFAULT_PIPELINE_SUCCESS_RATE_MIN,
    })!,
    sentencePassRateFirstTryMin: parseRatio({
      raw: searchParams.get("sentencePassRateFirstTryMin"),
      field: "sentencePassRateFirstTryMin",
      fallback: null,
    }),
    avgRetryPerSentenceMax: parseNonNegative({
      raw: searchParams.get("avgRetryPerSentenceMax"),
      field: "avgRetryPerSentenceMax",
      fallback: null,
    }),
    manualReviewRatioMax: parseRatio({
      raw: searchParams.get("manualReviewRatioMax"),
      field: "manualReviewRatioMax",
      fallback: null,
    }),
    chapterConsistencyFailRateMax: parseRatio({
      raw: searchParams.get("chapterConsistencyFailRateMax"),
      field: "chapterConsistencyFailRateMax",
      fallback: DEFAULT_CHAPTER_CONSISTENCY_FAIL_RATE_MAX,
    })!,
  };
};

export const parseSloAlertScanQuery = (
  searchParams: URLSearchParams
): SloAlertScanQuery => {
  const base = parseSloAlertQuery(searchParams);
  return {
    ...base,
    autoResolveStale: parseBoolean({
      raw: searchParams.get("autoResolveStale"),
      field: "autoResolveStale",
      fallback: true,
    }),
  };
};

export const parseSloAlertScheduleQuery = (
  searchParams: URLSearchParams
): SloAlertScheduleQuery => {
  const base = parseSloAlertScanQuery(searchParams);
  return {
    ...base,
    maxBooks: parseMaxBooks(searchParams.get("maxBooks")),
  };
};

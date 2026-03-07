// 一旦我被更新，请更新我的开头注释
// input: URLSearchParams
// output: SLO 查询参数
// pos: S32 查询解析
import { ValidationError } from "@/lib/error-handler";
import type { BookSloMetricsQuery } from "@/lib/slo-metrics/types";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseWindowDays = (value: unknown): number => {
  if (value === undefined || value === null) {
    return DEFAULT_WINDOW_DAYS;
  }
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > MAX_WINDOW_DAYS) {
    throw new ValidationError(`days 必须是 1-${MAX_WINDOW_DAYS} 的整数`);
  }
  return Number(numeric);
};

export const normalizeSource = (value: string): string => value.trim().toLowerCase();

export const parseBookSloMetricsQuery = (
  searchParams: URLSearchParams
): BookSloMetricsQuery => {
  const windowDays = parseWindowDays(searchParams.get("days"));
  const sourceInput = asString(searchParams.get("source"));
  return {
    windowDays,
    source: sourceInput ? normalizeSource(sourceInput) : undefined,
  };
};

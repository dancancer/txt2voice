// 一旦我被更新，请更新我的开头注释
// input: 告警服务输入/数据库依赖
// output: 共享类型与工具函数
// pos: 质检派单告警事件共享模块
import { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import type {
  QcDispatchAlertCode,
  QcDispatchAlertQuery,
  QcDispatchAlertResult,
} from "@/lib/qc-dispatch-alert-service";
import type { QcDispatchAlertNotificationResult } from "@/lib/qc-dispatch-alert-notifier";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const DEFAULT_SCAN_MAX_BOOKS = 50;
export const MAX_SCAN_MAX_BOOKS = 200;

export type DispatchAlertEventStatus = "open" | "acked" | "resolved";
export const ACTIVE_ALERT_STATUSES: DispatchAlertEventStatus[] = ["open", "acked"];

export interface QcDispatchAlertScanQuery extends QcDispatchAlertQuery {
  autoResolveStale: boolean;
}

export interface QcDispatchAlertScanResult {
  bookId: string;
  scanAt: string;
  window: QcDispatchAlertResult["window"];
  filter: QcDispatchAlertResult["filter"];
  thresholds: QcDispatchAlertResult["thresholds"];
  snapshot: QcDispatchAlertResult["snapshot"];
  alerts: QcDispatchAlertResult["alerts"];
  mutation: {
    created: number;
    reopened: number;
    updated: number;
    autoResolved: number;
    activeCount: number;
  };
  notification: QcDispatchAlertNotificationResult;
}

export interface QcDispatchAlertEventListQuery {
  page: number;
  limit: number;
  status: "active" | "open" | "acked" | "resolved" | "all";
  source?: string;
  issueType?: string;
  alertCode?: string;
}

export interface QcDispatchAlertEventResolvePayload {
  action: "ack" | "resolve";
  note?: string;
  operator?: string;
}

export interface QcDispatchAlertScheduleQuery extends QcDispatchAlertScanQuery {
  maxBooks: number;
}

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeSource = (value: string): string => value.trim().toLowerCase();
export const normalizeIssueType = (value: string): string => value.trim().toUpperCase();

export const parsePositiveInteger = ({
  raw,
  field,
  fallback,
  max,
}: {
  raw: string | null;
  field: string;
  fallback: number;
  max: number;
}): number => {
  if (raw === null || raw.trim().length === 0) {
    return fallback;
  }

  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > max) {
    throw new ValidationError(`${field} 必须是 1-${max} 的整数`);
  }
  return Number(numeric);
};

export const parseBooleanWithDefault = ({
  raw,
  fallback,
  field,
}: {
  raw: string | null;
  fallback: boolean;
  field: string;
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

export const normalizeBookIds = (bookIds: string[]): string[] => {
  const set = new Set<string>();
  for (const raw of bookIds) {
    if (typeof raw !== "string") {
      continue;
    }
    const normalized = raw.trim();
    if (normalized.length === 0) {
      continue;
    }
    set.add(normalized);
  }
  return Array.from(set);
};

export const buildFingerprint = ({
  query,
  alertCode,
}: {
  query: QcDispatchAlertQuery;
  alertCode: QcDispatchAlertCode;
}): string => {
  return [
    `code:${alertCode}`,
    `days:${query.windowDays}`,
    `source:${query.source || "all"}`,
    `issue:${query.issueType || "all"}`,
  ].join("|");
};

export const buildEventSnapshot = (
  alertResult: QcDispatchAlertResult
): Prisma.InputJsonValue => {
  return {
    window: alertResult.window,
    filter: alertResult.filter,
    thresholds: alertResult.thresholds,
    snapshot: alertResult.snapshot,
  } as unknown as Prisma.InputJsonValue;
};

export const buildEventPayload = (
  values: Record<string, number>
): Prisma.InputJsonValue => {
  return values as Prisma.InputJsonValue;
};

export const buildEventWhere = ({
  bookId,
  source,
  issueType,
}: {
  bookId: string;
  source?: string;
  issueType?: string;
}) => ({
  bookId,
  source: source ?? null,
  issueType: issueType ?? null,
});

export const resolveTriggeredBy = (raw: string | undefined): string => {
  const normalized = asText(raw);
  return normalized || "system_scan";
};

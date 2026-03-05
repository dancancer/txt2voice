// 一旦我被更新，请更新我的开头注释
// input: URLSearchParams/请求体
// output: 标准化查询与生命周期参数
// pos: 质检派单告警事件参数解析
import { ValidationError } from "@/lib/error-handler";
import { parseQcDispatchAlertQuery } from "@/lib/qc-dispatch-alert-service";
import {
  ACTIVE_ALERT_STATUSES,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_SCAN_MAX_BOOKS,
  MAX_LIMIT,
  MAX_SCAN_MAX_BOOKS,
  asRecord,
  asText,
  normalizeIssueType,
  normalizeSource,
  parseBooleanWithDefault,
  parsePositiveInteger,
  type DispatchAlertEventStatus,
  type QcDispatchAlertEventListQuery,
  type QcDispatchAlertEventResolvePayload,
  type QcDispatchAlertScanQuery,
  type QcDispatchAlertScheduleQuery,
} from "@/lib/qc-dispatch-alert-event/types";

export const parseQcDispatchAlertScanQuery = (
  searchParams: URLSearchParams
): QcDispatchAlertScanQuery => {
  const base = parseQcDispatchAlertQuery(searchParams);
  const autoResolveStale = parseBooleanWithDefault({
    raw: searchParams.get("autoResolveStale"),
    fallback: true,
    field: "autoResolveStale",
  });
  return {
    ...base,
    autoResolveStale,
  };
};

export const parseQcDispatchAlertScheduleQuery = (
  searchParams: URLSearchParams
): QcDispatchAlertScheduleQuery => {
  const scanQuery = parseQcDispatchAlertScanQuery(searchParams);
  const maxBooks = parsePositiveInteger({
    raw: searchParams.get("maxBooks"),
    field: "maxBooks",
    fallback: DEFAULT_SCAN_MAX_BOOKS,
    max: MAX_SCAN_MAX_BOOKS,
  });

  return {
    ...scanQuery,
    maxBooks,
  };
};

export const parseQcDispatchAlertEventListQuery = (
  searchParams: URLSearchParams
): QcDispatchAlertEventListQuery => {
  const page = parsePositiveInteger({
    raw: searchParams.get("page"),
    field: "page",
    fallback: DEFAULT_PAGE,
    max: 10_000,
  });
  const limit = parsePositiveInteger({
    raw: searchParams.get("limit"),
    field: "limit",
    fallback: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });

  const rawStatus = (searchParams.get("status") || "active").trim().toLowerCase();
  const validStatuses = new Set(["active", "open", "acked", "resolved", "all"]);
  if (!validStatuses.has(rawStatus)) {
    throw new ValidationError("status 仅支持 active/open/acked/resolved/all");
  }

  const source = asText(searchParams.get("source") || undefined);
  const issueType = asText(searchParams.get("issueType") || undefined);
  const alertCode = asText(searchParams.get("alertCode") || undefined);

  return {
    page,
    limit,
    status: rawStatus as QcDispatchAlertEventListQuery["status"],
    source: source ? normalizeSource(source) : undefined,
    issueType: issueType ? normalizeIssueType(issueType) : undefined,
    alertCode: alertCode ? alertCode.toLowerCase() : undefined,
  };
};

export const parseQcDispatchAlertEventResolvePayload = (
  body: unknown
): QcDispatchAlertEventResolvePayload => {
  const record = asRecord(body) || {};
  const action = asText(record.action);

  if (action !== "ack" && action !== "resolve") {
    throw new ValidationError("action 仅支持 ack/resolve");
  }

  const note = asText(record.note);
  if (note && note.length > 500) {
    throw new ValidationError("note 长度不能超过 500");
  }

  const operator = asText(record.operator);
  if (operator && operator.length > 100) {
    throw new ValidationError("operator 长度不能超过 100");
  }

  return {
    action,
    note,
    operator,
  };
};

export const resolveStatusFilter = (
  status: QcDispatchAlertEventListQuery["status"]
): DispatchAlertEventStatus[] | undefined => {
  if (status === "all") {
    return undefined;
  }
  if (status === "active") {
    return ACTIVE_ALERT_STATUSES;
  }
  return [status];
};

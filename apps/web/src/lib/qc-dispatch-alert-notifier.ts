// 一旦我被更新，请更新我的开头注释
// input: 告警扫描结果/通知配置
// output: 通知投递结果
// pos: 质检派单告警通知服务
import type {
  QcDispatchAlertItem,
  QcDispatchAlertQuery,
  QcDispatchAlertResult,
} from "@/lib/qc-dispatch-alert-service";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface QcDispatchAlertNotificationEvent {
  id: string;
  code: string;
  severity: string;
  status: string;
  triggerCount: number;
}

export interface QcDispatchAlertNotificationResult {
  enabled: boolean;
  delivered: boolean;
  channel: "webhook" | "none";
  reason: string;
}

const parseTimeoutMs = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(numeric);
};

const buildPayload = ({
  bookId,
  query,
  alertResult,
  events,
  triggeredBy,
}: {
  bookId: string;
  query: QcDispatchAlertQuery;
  alertResult: QcDispatchAlertResult;
  events: QcDispatchAlertNotificationEvent[];
  triggeredBy: string;
}): Record<string, unknown> => ({
  type: "qc_dispatch_alert_scan",
  bookId,
  triggeredBy,
  generatedAt: new Date().toISOString(),
  filter: {
    days: query.windowDays,
    source: query.source || null,
    issueType: query.issueType || null,
  },
  totals: {
    activeAlerts: alertResult.alerts.length,
    notifiedEvents: events.length,
  },
  alerts: alertResult.alerts.map((item: QcDispatchAlertItem) => ({
    code: item.code,
    severity: item.severity,
    message: item.message,
    values: item.values,
  })),
  events,
  snapshot: alertResult.snapshot,
});

export const notifyQcDispatchAlertScan = async ({
  bookId,
  query,
  alertResult,
  events,
  triggeredBy,
}: {
  bookId: string;
  query: QcDispatchAlertQuery;
  alertResult: QcDispatchAlertResult;
  events: QcDispatchAlertNotificationEvent[];
  triggeredBy: string;
}): Promise<QcDispatchAlertNotificationResult> => {
  const webhookUrl = process.env.QC_DISPATCH_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      enabled: false,
      delivered: false,
      channel: "none",
      reason: "webhook_not_configured",
    };
  }

  if (events.length === 0) {
    return {
      enabled: true,
      delivered: false,
      channel: "webhook",
      reason: "no_new_events",
    };
  }

  const timeoutMs = parseTimeoutMs(process.env.QC_DISPATCH_ALERT_WEBHOOK_TIMEOUT_MS);
  const payload = buildPayload({
    bookId,
    query,
    alertResult,
    events,
    triggeredBy,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        enabled: true,
        delivered: false,
        channel: "webhook",
        reason: `webhook_status_${response.status}`,
      };
    }

    return {
      enabled: true,
      delivered: true,
      channel: "webhook",
      reason: "delivered",
    };
  } catch (error) {
    return {
      enabled: true,
      delivered: false,
      channel: "webhook",
      reason:
        error instanceof Error && error.message
          ? `webhook_error:${error.message}`
          : "webhook_error:unknown",
    };
  }
};

// 一旦我被更新，请更新我的开头注释
// input: 告警扫描结果/通知配置
// output: 通知投递结果
// pos: S32 告警通知服务
import type {
  SloAlertItem,
  SloAlertNotificationEvent,
  SloAlertNotificationResult,
  SloAlertQuery,
  SloAlertResult,
} from "@/lib/slo-alerts/types";

const DEFAULT_TIMEOUT_MS = 8_000;

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
  query: SloAlertQuery;
  alertResult: SloAlertResult;
  events: SloAlertNotificationEvent[];
  triggeredBy: string;
}): Record<string, unknown> => ({
  type: "slo_alert_scan",
  bookId,
  triggeredBy,
  generatedAt: new Date().toISOString(),
  filter: {
    days: query.windowDays,
    source: query.source || null,
  },
  totals: {
    activeAlerts: alertResult.alerts.length,
    notifiedEvents: events.length,
  },
  alerts: alertResult.alerts.map((item: SloAlertItem) => ({
    code: item.code,
    severity: item.severity,
    metricKey: item.metricKey,
    message: item.message,
    values: item.values,
  })),
  events,
  snapshot: alertResult.snapshot,
});

export const notifySloAlertScan = async ({
  bookId,
  query,
  alertResult,
  events,
  triggeredBy,
}: {
  bookId: string;
  query: SloAlertQuery;
  alertResult: SloAlertResult;
  events: SloAlertNotificationEvent[];
  triggeredBy: string;
}): Promise<SloAlertNotificationResult> => {
  const webhookUrl =
    process.env.SLO_ALERT_WEBHOOK_URL?.trim() ||
    process.env.QC_DISPATCH_ALERT_WEBHOOK_URL?.trim();
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

  const timeoutMs = parseTimeoutMs(
    process.env.SLO_ALERT_WEBHOOK_TIMEOUT_MS ||
      process.env.QC_DISPATCH_ALERT_WEBHOOK_TIMEOUT_MS
  );

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildPayload({
          bookId,
          query,
          alertResult,
          events,
          triggeredBy,
        })
      ),
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

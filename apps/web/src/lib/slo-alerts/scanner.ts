// 一旦我被更新，请更新我的开头注释
// input: 告警扫描参数/数据库依赖
// output: 单书与批量扫描结果
// pos: S32 告警扫描模块
import prisma, { Prisma } from "@/lib/prisma";
import { getBookSloAlerts } from "@/lib/slo-alerts/service";
import { notifySloAlertScan } from "@/lib/slo-alerts/notifier";
import type {
  SloAlertScheduleQuery,
  SloAlertScanQuery,
  SloAlertScanResult,
} from "@/lib/slo-alerts/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_ALERT_STATUSES = ["open", "acked"];
const SLO_EVENT_ISSUE_TYPE = "SLO";

const normalizeBookIds = (bookIds: string[]): string[] => {
  const set = new Set<string>();
  for (const raw of bookIds) {
    if (typeof raw !== "string") {
      continue;
    }
    const normalized = raw.trim();
    if (normalized.length > 0) {
      set.add(normalized);
    }
  }
  return Array.from(set);
};

const buildFingerprint = ({
  alertCode,
  windowDays,
  source,
}: {
  alertCode: string;
  windowDays: number;
  source?: string;
}): string => {
  return [
    "category:slo",
    `code:${alertCode}`,
    `days:${windowDays}`,
    `source:${source || "all"}`,
  ].join("|");
};

const buildSnapshot = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

const resolveTriggeredBy = (value?: string): string => {
  if (typeof value !== "string") {
    return "slo_scan";
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "slo_scan";
};

export const scanSloAlertsForBook = async ({
  bookId,
  query,
  triggeredBy,
}: {
  bookId: string;
  query: SloAlertScanQuery;
  triggeredBy?: string;
}): Promise<SloAlertScanResult> => {
  const resolvedTriggeredBy = resolveTriggeredBy(triggeredBy);
  const scanAt = new Date();
  const alertResult = await getBookSloAlerts({
    bookId,
    query,
  });

  const eventScopeWhere: Prisma.QcDispatchAlertEventWhereInput = {
    bookId,
    source: query.source ?? null,
    issueType: SLO_EVENT_ISSUE_TYPE,
  };

  const activeEvents = await prisma.qcDispatchAlertEvent.findMany({
    where: {
      ...eventScopeWhere,
      status: {
        in: ACTIVE_ALERT_STATUSES,
      },
    },
  });

  const activeByFingerprint = new Map(
    activeEvents.map((item) => [item.fingerprint, item])
  );

  const snapshot = buildSnapshot(alertResult);
  const seen = new Set<string>();
  let created = 0;
  let reopened = 0;
  let updated = 0;

  const notifiedEvents: Array<{
    id: string;
    code: string;
    severity: string;
    status: string;
    triggerCount: number;
  }> = [];

  for (const alert of alertResult.alerts) {
    const fingerprint = buildFingerprint({
      alertCode: alert.code,
      windowDays: query.windowDays,
      source: query.source,
    });
    seen.add(fingerprint);

    const current = activeByFingerprint.get(fingerprint);
    if (!current) {
      const createdEvent = await prisma.qcDispatchAlertEvent.create({
        data: {
          bookId,
          source: query.source ?? null,
          issueType: SLO_EVENT_ISSUE_TYPE,
          alertCode: alert.code,
          severity: alert.severity,
          status: "open",
          fingerprint,
          message: alert.message,
          recommendedAction: alert.recommendedAction,
          values: buildSnapshot(alert.values),
          snapshot,
          firstTriggeredAt: scanAt,
          lastTriggeredAt: scanAt,
          triggerCount: 1,
        },
      });
      created += 1;
      notifiedEvents.push({
        id: createdEvent.id,
        code: createdEvent.alertCode,
        severity: createdEvent.severity,
        status: createdEvent.status,
        triggerCount: createdEvent.triggerCount,
      });
      continue;
    }

    const shouldReopen = current.status === "acked";
    const data: Prisma.QcDispatchAlertEventUpdateInput = {
      severity: alert.severity,
      message: alert.message,
      recommendedAction: alert.recommendedAction,
      values: buildSnapshot(alert.values),
      snapshot,
      lastTriggeredAt: scanAt,
      triggerCount: {
        increment: 1,
      },
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    };

    if (shouldReopen) {
      data.status = "open";
      data.ackedAt = null;
      reopened += 1;
    } else {
      updated += 1;
    }

    const updatedEvent = await prisma.qcDispatchAlertEvent.update({
      where: { id: current.id },
      data,
    });
    notifiedEvents.push({
      id: updatedEvent.id,
      code: updatedEvent.alertCode,
      severity: updatedEvent.severity,
      status: updatedEvent.status,
      triggerCount: updatedEvent.triggerCount,
    });
  }

  let autoResolved = 0;
  if (query.autoResolveStale) {
    const staleIds = activeEvents
      .filter((item) => !seen.has(item.fingerprint))
      .map((item) => item.id);

    if (staleIds.length > 0) {
      const result = await prisma.qcDispatchAlertEvent.updateMany({
        where: {
          id: {
            in: staleIds,
          },
        },
        data: {
          status: "resolved",
          resolvedAt: scanAt,
          resolvedBy: resolvedTriggeredBy,
          resolutionNote: "auto_resolved_by_slo_scan",
        },
      });
      autoResolved = result.count;
    }
  }

  const activeCount = await prisma.qcDispatchAlertEvent.count({
    where: {
      ...eventScopeWhere,
      status: {
        in: ACTIVE_ALERT_STATUSES,
      },
    },
  });

  const notification = await notifySloAlertScan({
    bookId,
    query,
    alertResult,
    events: notifiedEvents,
    triggeredBy: resolvedTriggeredBy,
  });

  return {
    bookId,
    scanAt: scanAt.toISOString(),
    window: alertResult.window,
    filter: alertResult.filter,
    thresholds: alertResult.thresholds,
    snapshot: alertResult.snapshot,
    alerts: alertResult.alerts,
    mutation: {
      created,
      reopened,
      updated,
      autoResolved,
      activeCount,
    },
    notification,
  };
};

const findRecentBookIds = async ({
  windowDays,
  maxBooks,
}: {
  windowDays: number;
  maxBooks: number;
}): Promise<string[]> => {
  const since = new Date(Date.now() - windowDays * DAY_MS);
  const books = await prisma.book.findMany({
    where: {
      processingTasks: {
        some: {
          taskType: {
            in: ["QUALITY_CHECK", "AUTO_PIPELINE", "FINAL_ASSEMBLY", "MANUAL_REVIEW_SYNC"],
          },
          createdAt: {
            gte: since,
          },
        },
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: maxBooks,
  });

  return books.map((book) => book.id);
};

export const scanSloAlertsForBooks = async ({
  query,
  bookIds,
  triggeredBy,
}: {
  query: SloAlertScheduleQuery;
  bookIds?: string[];
  triggeredBy?: string;
}) => {
  const targetBookIds =
    bookIds && bookIds.length > 0
      ? normalizeBookIds(bookIds)
      : await findRecentBookIds({
          windowDays: query.windowDays,
          maxBooks: query.maxBooks,
        });

  const results: Array<
    | { bookId: string; ok: true; result: SloAlertScanResult }
    | { bookId: string; ok: false; error: string }
  > = [];

  for (const bookId of targetBookIds) {
    try {
      const result = await scanSloAlertsForBook({
        bookId,
        query,
        triggeredBy,
      });
      results.push({
        bookId,
        ok: true,
        result,
      });
    } catch (error) {
      results.push({
        bookId,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return {
    scanAt: new Date().toISOString(),
    query,
    targetBookCount: targetBookIds.length,
    successCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    results,
  };
};

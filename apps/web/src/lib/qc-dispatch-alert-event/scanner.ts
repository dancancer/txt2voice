// 一旦我被更新，请更新我的开头注释
// input: 告警扫描参数/数据库依赖
// output: 单书与批量扫描结果
// pos: 质检派单告警事件扫描模块
import prisma, { Prisma } from "@/lib/prisma";
import { getQcDispatchAlerts } from "@/lib/qc-dispatch-alert-service";
import { notifyQcDispatchAlertScan } from "@/lib/qc-dispatch-alert-notifier";
import {
  ACTIVE_ALERT_STATUSES,
  DAY_MS,
  buildEventPayload,
  buildEventSnapshot,
  buildEventWhere,
  buildFingerprint,
  normalizeBookIds,
  resolveTriggeredBy,
  type QcDispatchAlertScanQuery,
  type QcDispatchAlertScanResult,
  type QcDispatchAlertScheduleQuery,
} from "@/lib/qc-dispatch-alert-event/types";

export const scanQcDispatchAlertsForBook = async ({
  bookId,
  query,
  triggeredBy,
}: {
  bookId: string;
  query: QcDispatchAlertScanQuery;
  triggeredBy?: string;
}): Promise<QcDispatchAlertScanResult> => {
  const resolvedTriggeredBy = resolveTriggeredBy(triggeredBy);
  const scanAt = new Date();
  const alertResult = await getQcDispatchAlerts({
    bookId,
    query,
  });

  const eventScopeWhere = buildEventWhere({
    bookId,
    source: query.source,
    issueType: query.issueType,
  });

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

  const snapshot = buildEventSnapshot(alertResult);
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
      query,
      alertCode: alert.code,
    });
    seen.add(fingerprint);

    const current = activeByFingerprint.get(fingerprint);
    if (!current) {
      const createdEvent = await prisma.qcDispatchAlertEvent.create({
        data: {
          bookId,
          source: query.source ?? null,
          issueType: query.issueType ?? null,
          alertCode: alert.code,
          severity: alert.severity,
          status: "open",
          fingerprint,
          message: alert.message,
          recommendedAction: alert.recommendedAction,
          values: buildEventPayload(alert.values),
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
    const nextData: Prisma.QcDispatchAlertEventUpdateInput = {
      severity: alert.severity,
      message: alert.message,
      recommendedAction: alert.recommendedAction,
      values: buildEventPayload(alert.values),
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
      nextData.status = "open";
      nextData.ackedAt = null;
    }

    const updatedEvent = await prisma.qcDispatchAlertEvent.update({
      where: {
        id: current.id,
      },
      data: nextData,
    });

    if (shouldReopen) {
      reopened += 1;
      notifiedEvents.push({
        id: updatedEvent.id,
        code: updatedEvent.alertCode,
        severity: updatedEvent.severity,
        status: updatedEvent.status,
        triggerCount: updatedEvent.triggerCount,
      });
    } else {
      updated += 1;
    }
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
          status: {
            in: ACTIVE_ALERT_STATUSES,
          },
        },
        data: {
          status: "resolved",
          resolvedAt: scanAt,
          resolvedBy: resolvedTriggeredBy,
          resolutionNote: "auto_resolved_by_scan",
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

  const notification = await notifyQcDispatchAlertScan({
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
          taskType: "QUALITY_CHECK",
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

export const scanQcDispatchAlertsForBooks = async ({
  query,
  bookIds,
  triggeredBy,
}: {
  query: QcDispatchAlertScheduleQuery;
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
    | { bookId: string; ok: true; result: QcDispatchAlertScanResult }
    | { bookId: string; ok: false; error: string }
  > = [];

  for (const bookId of targetBookIds) {
    try {
      const result = await scanQcDispatchAlertsForBook({
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

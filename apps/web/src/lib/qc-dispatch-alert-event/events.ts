// 一旦我被更新，请更新我的开头注释
// input: 告警事件查询/生命周期请求
// output: 事件列表与状态变更结果
// pos: 质检派单告警事件查询模块
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { resolveStatusFilter } from "@/lib/qc-dispatch-alert-event/parsers";
import type {
  QcDispatchAlertEventListQuery,
  QcDispatchAlertEventResolvePayload,
} from "@/lib/qc-dispatch-alert-event/types";

export const listQcDispatchAlertEvents = async ({
  bookId,
  query,
}: {
  bookId: string;
  query: QcDispatchAlertEventListQuery;
}) => {
  const statuses = resolveStatusFilter(query.status);
  const skip = (query.page - 1) * query.limit;

  const baseWhere: Prisma.QcDispatchAlertEventWhereInput = {
    bookId,
  };

  if (query.source) {
    baseWhere.source = query.source;
  }
  if (query.issueType) {
    baseWhere.issueType = query.issueType;
  }
  if (query.alertCode) {
    baseWhere.alertCode = query.alertCode;
  }

  const where: Prisma.QcDispatchAlertEventWhereInput = {
    ...baseWhere,
  };

  if (statuses) {
    where.status = {
      in: statuses,
    };
  }

  const [rows, total, openCount, ackedCount, resolvedCount] = await Promise.all([
    prisma.qcDispatchAlertEvent.findMany({
      where,
      orderBy: [{ lastTriggeredAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.qcDispatchAlertEvent.count({ where }),
    prisma.qcDispatchAlertEvent.count({
      where: {
        ...baseWhere,
        status: "open",
      },
    }),
    prisma.qcDispatchAlertEvent.count({
      where: {
        ...baseWhere,
        status: "acked",
      },
    }),
    prisma.qcDispatchAlertEvent.count({
      where: {
        ...baseWhere,
        status: "resolved",
      },
    }),
  ]);

  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNext: query.page * query.limit < total,
      hasPrev: query.page > 1,
    },
    summary: {
      openCount,
      ackedCount,
      resolvedCount,
      totalCount: openCount + ackedCount + resolvedCount,
    },
  };
};

export const resolveQcDispatchAlertEvent = async ({
  bookId,
  eventId,
  payload,
}: {
  bookId: string;
  eventId: string;
  payload: QcDispatchAlertEventResolvePayload;
}) => {
  const current = await prisma.qcDispatchAlertEvent.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!current || current.bookId !== bookId) {
    throw new ValidationError("告警事件不存在");
  }

  if (payload.action === "ack" && current.status === "resolved") {
    throw new ValidationError("已 resolved 的告警不能再 ack");
  }

  const now = new Date();
  const operator = payload.operator || "manual_operator";

  const data: Prisma.QcDispatchAlertEventUpdateInput =
    payload.action === "ack"
      ? {
          status: "acked",
          ackedAt: now,
          resolutionNote: payload.note || "manual_ack",
          resolvedAt: null,
          resolvedBy: null,
        }
      : {
          status: "resolved",
          resolvedAt: now,
          resolvedBy: operator,
          resolutionNote: payload.note || "manual_resolved",
        };

  const updated = await prisma.qcDispatchAlertEvent.update({
    where: {
      id: current.id,
    },
    data,
  });

  return {
    item: updated,
  };
};

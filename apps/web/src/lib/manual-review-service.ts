// 一旦我被更新，请更新我的开头注释
// input: 复核查询参数/复核处理请求/数据库依赖
// output: 复核列表结果/复核处理结果
// pos: 人工复核服务
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  createPaginationResult,
  getPaginationFromSearch,
  parsePaginationParams,
} from "@/lib/pagination";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAudioGenerationJob } from "@/lib/task-queue";

export type ManualReviewStatus = "pending" | "reprocessing" | "resolved" | "rejected";
export type ManualReviewResolveAction = "approve" | "reject" | "regenerate";

export interface ManualReviewListQuery {
  page: number;
  limit: number;
  offset: number;
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  chapterId?: string;
  sentenceId?: string;
}

export interface ManualReviewResolvePayload {
  action: ManualReviewResolveAction;
  note?: string;
  assignedTo?: string;
  voiceProfileId?: string;
  provider?: string;
  autoMerge: boolean;
}

interface ResolveManualReviewInput {
  bookId: string;
  itemId: string;
  payload: ManualReviewResolvePayload;
}

interface FormattedManualReviewItem {
  id: string;
  bookId: string;
  chapterId: string | null;
  segmentId: string | null;
  sentenceId: string | null;
  audioFileId: string | null;
  issueType: string;
  priority: string;
  status: string;
  issueDetail: Prisma.JsonValue;
  assignedTo: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sentence: {
    id: string;
    text: string;
    roleType: string | null;
    emotionLabel: string | null;
    priority: string | null;
  } | null;
  audio: {
    id: string;
    fileName: string | null;
    duration: number | null;
    status: string;
    qualityScore: number | null;
    qualityVerdict: string | null;
    qualityStatus: string | null;
  } | null;
  latestQualityCheck: {
    id: string;
    verdict: string;
    score: number | null;
    hardFail: boolean;
    reasons: Prisma.JsonValue;
    detail: Prisma.JsonValue;
    createdAt: Date;
  } | null;
}

interface ManualReviewResolveResult {
  item: FormattedManualReviewItem;
  retryTask: {
    taskId: string;
    taskType: "AUDIO_GENERATION";
    status: string;
  } | null;
}

const REVIEW_STATUS_SET = new Set<ManualReviewStatus>([
  "pending",
  "reprocessing",
  "resolved",
  "rejected",
]);

const RESOLVE_ACTION_ALIAS: Record<string, ManualReviewResolveAction> = {
  approve: "approve",
  pass: "approve",
  通过: "approve",
  reject: "reject",
  dismissed: "reject",
  驳回: "reject",
  regenerate: "regenerate",
  retry: "regenerate",
  重生: "regenerate",
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return Number.isFinite(value.toNumber()) ? value.toNumber() : null;
};

const MANUAL_REVIEW_INCLUDE = {
  scriptSentence: {
    select: {
      id: true,
      text: true,
      roleType: true,
      emotionLabel: true,
      priority: true,
    },
  },
  audioFile: {
    select: {
      id: true,
      fileName: true,
      duration: true,
      status: true,
      qualityScore: true,
      qualityVerdict: true,
      qualityStatus: true,
    },
  },
  qualityCheckResult: {
    select: {
      id: true,
      verdict: true,
      score: true,
      hardFail: true,
      reasons: true,
      detail: true,
      createdAt: true,
    },
  },
} as const;

const formatManualReviewItem = (item: any): FormattedManualReviewItem => {
  return {
    id: item.id,
    bookId: item.bookId,
    chapterId: item.chapterId,
    segmentId: item.segmentId,
    sentenceId: item.sentenceId,
    audioFileId: item.audioFileId,
    issueType: item.issueType,
    priority: item.priority,
    status: item.status,
    issueDetail: item.issueDetail,
    assignedTo: item.assignedTo,
    resolutionType: item.resolutionType,
    resolutionNote: item.resolutionNote,
    resolvedAt: item.resolvedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    sentence: item.scriptSentence
      ? {
          id: item.scriptSentence.id,
          text: item.scriptSentence.text,
          roleType: item.scriptSentence.roleType,
          emotionLabel: item.scriptSentence.emotionLabel,
          priority: item.scriptSentence.priority,
        }
      : null,
    audio: item.audioFile
      ? {
          id: item.audioFile.id,
          fileName: item.audioFile.fileName,
          duration: toNumber(item.audioFile.duration),
          status: item.audioFile.status,
          qualityScore: toNumber(item.audioFile.qualityScore),
          qualityVerdict: item.audioFile.qualityVerdict,
          qualityStatus: item.audioFile.qualityStatus,
        }
      : null,
    latestQualityCheck: item.qualityCheckResult
      ? {
          id: item.qualityCheckResult.id,
          verdict: item.qualityCheckResult.verdict,
          score: toNumber(item.qualityCheckResult.score),
          hardFail: item.qualityCheckResult.hardFail,
          reasons: item.qualityCheckResult.reasons,
          detail: item.qualityCheckResult.detail,
          createdAt: item.qualityCheckResult.createdAt,
        }
      : null,
  };
};

const buildListWhere = (
  bookId: string,
  query: ManualReviewListQuery
): Prisma.ManualReviewItemWhereInput => {
  const where: Prisma.ManualReviewItemWhereInput = {
    bookId,
  };

  if (query.status) {
    where.status = query.status;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.issueType) {
    where.issueType = query.issueType;
  }
  if (query.chapterId) {
    where.chapterId = query.chapterId;
  }
  if (query.sentenceId) {
    where.sentenceId = query.sentenceId;
  }

  return where;
};

export const parseManualReviewQuery = (
  searchParams: URLSearchParams
): ManualReviewListQuery => {
  const { page, limit, offset } = parsePaginationParams(
    getPaginationFromSearch(searchParams)
  );

  const statusInput = asString(searchParams.get("status"))?.toLowerCase();
  let status: ManualReviewStatus | undefined = "pending";

  if (statusInput === "all") {
    status = undefined;
  } else if (statusInput) {
    if (!REVIEW_STATUS_SET.has(statusInput as ManualReviewStatus)) {
      throw new ValidationError(
        "status 仅支持 pending/reprocessing/resolved/rejected/all"
      );
    }
    status = statusInput as ManualReviewStatus;
  }

  return {
    page,
    limit,
    offset,
    status,
    priority: asString(searchParams.get("priority")),
    issueType: asString(searchParams.get("issueType")),
    chapterId: asString(searchParams.get("chapterId")),
    sentenceId: asString(searchParams.get("sentenceId")),
  };
};

export const parseManualReviewResolvePayload = (
  body: unknown
): ManualReviewResolvePayload => {
  const payload = asRecord(body);
  const actionInput = asString(payload?.action);
  const action =
    actionInput && RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()]
      ? RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()]
      : actionInput && RESOLVE_ACTION_ALIAS[actionInput]
        ? RESOLVE_ACTION_ALIAS[actionInput]
        : undefined;

  if (!action) {
    throw new ValidationError("action 必填，且仅支持 approve/reject/regenerate");
  }

  const note = asString(payload?.note);
  if (note && note.length > 1000) {
    throw new ValidationError("note 不能超过 1000 字符");
  }

  const assignedTo = asString(payload?.assignedTo);
  const voiceProfileId = asString(payload?.voiceProfileId);
  const provider = asString(payload?.provider);

  return {
    action,
    note,
    assignedTo,
    voiceProfileId,
    provider,
    autoMerge: payload?.autoMerge === true,
  };
};

const buildRegenerateNote = (note: string | undefined, taskId: string): string => {
  const marker = `retry_task:${taskId}`;
  if (!note) {
    return marker;
  }
  return `${note}\n${marker}`;
};

export const listManualReviewItems = async (
  bookId: string,
  query: ManualReviewListQuery
) => {
  const where = buildListWhere(bookId, query);
  const summaryWhere = { bookId };

  const [total, rows, pendingCount, reprocessingCount, resolvedCount, rejectedCount] =
    await Promise.all([
      prisma.manualReviewItem.count({ where }),
      prisma.manualReviewItem.findMany({
        where,
        include: MANUAL_REVIEW_INCLUDE,
        orderBy: [{ createdAt: "desc" }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.manualReviewItem.count({
        where: { ...summaryWhere, status: "pending" },
      }),
      prisma.manualReviewItem.count({
        where: { ...summaryWhere, status: "reprocessing" },
      }),
      prisma.manualReviewItem.count({
        where: { ...summaryWhere, status: "resolved" },
      }),
      prisma.manualReviewItem.count({
        where: { ...summaryWhere, status: "rejected" },
      }),
    ]);

  return {
    ...createPaginationResult(
      rows.map((item) => formatManualReviewItem(item)),
      total,
      query.page,
      query.limit
    ),
    summary: {
      pendingCount,
      reprocessingCount,
      resolvedCount,
      rejectedCount,
      total: pendingCount + reprocessingCount + resolvedCount + rejectedCount,
    },
  };
};

export const resolveManualReviewItem = async ({
  bookId,
  itemId,
  payload,
}: ResolveManualReviewInput): Promise<ManualReviewResolveResult> => {
  const item = await prisma.manualReviewItem.findUnique({
    where: { id: itemId },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (!item || item.bookId !== bookId) {
    throw new ValidationError("复核项不存在");
  }

  if (item.status !== "pending") {
    throw new ValidationError("仅 pending 状态的复核项支持处理");
  }

  if (payload.action === "approve" || payload.action === "reject") {
    const updated = await prisma.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: payload.action === "approve" ? "resolved" : "rejected",
        resolutionType: payload.action === "approve" ? "approved" : "rejected",
        resolutionNote: payload.note || null,
        assignedTo: payload.assignedTo ?? item.assignedTo,
        resolvedAt: new Date(),
      },
      include: MANUAL_REVIEW_INCLUDE,
    });

    return {
      item: formatManualReviewItem(updated),
      retryTask: null,
    };
  }

  if (!item.sentenceId) {
    throw new ValidationError("当前复核项缺少 sentenceId，无法触发重生");
  }

  const activeAudioTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
    },
    select: { id: true },
  });

  if (activeAudioTask) {
    throw new ValidationError("当前存在执行中的音频任务，请稍后重试");
  }

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
      progress: 0,
      totalItems: 1,
      taskData: {
        message: "人工复核触发音频重生",
        metadata: {
          source: "manual_review",
          manualReviewItemId: itemId,
          type: "single",
          scriptSentenceIds: [item.sentenceId],
          voiceProfileId: payload.voiceProfileId || null,
          autoMerge: payload.autoMerge,
          provider: payload.provider || null,
          skipExisting: false,
          overwriteExisting: true,
        },
      },
    },
  });

  try {
    await enqueueAudioGenerationJob({
      taskId: task.id,
      bookId,
      type: "single",
      scriptSentenceIds: [item.sentenceId],
      voiceProfileId: payload.voiceProfileId,
      autoMerge: payload.autoMerge,
      options: {
        provider: payload.provider,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
  } catch (queueError) {
    const message =
      queueError instanceof Error ? queueError.message : "人工复核重生任务入队失败";
    const failedTaskData = await mergeTaskData(task.id, {
      message: "人工复核重生任务入队失败",
      metadata: {
        queueError: message,
      },
    });

    await prisma.processingTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        taskData: failedTaskData,
      },
    });

    throw queueError;
  }

  const updated = await prisma.manualReviewItem.update({
    where: { id: itemId },
    data: {
      status: "reprocessing",
      resolutionType: "regenerate",
      resolutionNote: buildRegenerateNote(payload.note, task.id),
      assignedTo: payload.assignedTo ?? item.assignedTo,
      resolvedAt: null,
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  return {
    item: formatManualReviewItem(updated),
    retryTask: {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: task.status,
    },
  };
};

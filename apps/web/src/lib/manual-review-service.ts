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
import {
  cancelProcessingTaskJob,
  enqueueAudioGenerationJob,
  enqueueScriptGenerationJob,
} from "@/lib/task-queue";
import {
  buildScriptValidationDetailView,
  type ScriptValidationRecommendedAction,
  SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS,
  listScriptValidationSubtypesByRecommendedAction,
} from "@/lib/script-validation-detail";
import {
  resolveScriptValidationSubtype,
  SCRIPT_VALIDATION_ISSUE_TYPE,
} from "@/lib/script-validation-review";
import { resolveScriptGenerationOptions } from "@/lib/agent-runtime/runtime/script-production/options";
import {
  buildSegmentProcessingResultFromStructuredResult,
  persistSegmentProcessingResult,
} from "@/lib/agent-runtime/runtime/script-production/manual-review-processor";
import { hydrateManualReviewRuntimeDetails } from "@/lib/manual-review-runtime-recovery";

export type ManualReviewStatus = "pending" | "reprocessing" | "resolved" | "rejected";
export type ManualReviewResolveAction = "approve" | "reject" | "regenerate";

export interface ManualReviewListQuery {
  page: number;
  limit: number;
  offset: number;
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
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

export interface ManualReviewBatchResolvePayload extends ManualReviewResolvePayload {
  itemIds: string[];
}

export interface ManualReviewExportQuery {
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
  chapterId?: string;
  sentenceId?: string;
}

interface ManualReviewFilterOptions {
  status?: ManualReviewStatus;
  priority?: string;
  issueType?: string;
  scriptSubtype?: string;
  recommendedAction?: ScriptValidationRecommendedAction;
  chapterId?: string;
  sentenceId?: string;
}

interface ResolveManualReviewInput {
  bookId: string;
  itemId: string;
  payload: ManualReviewResolvePayload;
}

interface ResolveManualReviewBatchInput {
  bookId: string;
  payload: ManualReviewBatchResolvePayload;
}

interface RegenerateAllPendingManualReviewInput {
  bookId: string;
}

interface SaveManualReviewScriptEditInput {
  bookId: string;
  itemId: string;
  payload: {
    structuredResult: Record<string, unknown>;
  };
}

interface FormattedManualReviewItem {
  id: string;
  bookId: string;
  chapterId: string | null;
  segmentId: string | null;
  sentenceId: string | null;
  audioFileId: string | null;
  issueType: string;
  issueSubtype: string | null;
  recommendedAction: ScriptValidationRecommendedAction | null;
  recommendedActionLabel: string;
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

interface ManualReviewRetryTask {
  taskId: string;
  taskType: "AUDIO_GENERATION" | "SCRIPT_GENERATION";
  status: string;
}

interface ManualReviewResolveResult {
  item: FormattedManualReviewItem;
  retryTask: ManualReviewRetryTask | null;
}

interface ManualReviewBatchResolveResult {
  action: ManualReviewResolveAction;
  processedCount: number;
  items: FormattedManualReviewItem[];
  retryTask: ManualReviewRetryTask | null;
}

interface RegenerateAllPendingManualReviewResult {
  reviewItemCount: number;
  processedCount: number;
  scriptTask: ManualReviewRetryTask | null;
  audioTask: ManualReviewRetryTask | null;
  warnings?: string[];
}

const MAX_BATCH_RESOLVE_ITEMS = 200;
const MAX_EXPORT_ITEMS = 5000;

const REVIEW_STATUS_SET = new Set<ManualReviewStatus>([
  "pending",
  "reprocessing",
  "resolved",
  "rejected",
]);

const RECOMMENDED_ACTION_SET = new Set(
  SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS.map((item) => item.value)
);

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

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(normalized));
  }

  const single = asString(value);
  return single ? [single] : [];
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
  const issueSubtype =
    item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
      ? resolveScriptValidationSubtype(item.issueDetail)
      : null;
  const scriptDetail =
    item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
      ? buildScriptValidationDetailView({
          issueSubtype,
          issueDetail: item.issueDetail,
        })
      : null;

  return {
    id: item.id,
    bookId: item.bookId,
    chapterId: item.chapterId,
    segmentId: item.segmentId,
    sentenceId: item.sentenceId,
    audioFileId: item.audioFileId,
    issueType: item.issueType,
    issueSubtype,
    recommendedAction: scriptDetail?.recommendedAction || null,
    recommendedActionLabel: scriptDetail?.recommendedActionLabel || "",
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

const isStructuredScriptResult = (
  value: unknown
): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const buildListWhere = (
  bookId: string,
  query: ManualReviewFilterOptions
): Prisma.ManualReviewItemWhereInput => {
  const where: Prisma.ManualReviewItemWhereInput = {
    bookId,
  };
  const andClauses: Prisma.ManualReviewItemWhereInput[] = [];

  if (query.status) {
    where.status = query.status;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.issueType) {
    where.issueType = query.issueType;
  }
  if (query.issueType === SCRIPT_VALIDATION_ISSUE_TYPE && query.scriptSubtype) {
    andClauses.push({
      issueDetail: {
        path: ["scriptSubtype"],
        equals: query.scriptSubtype,
      } as Prisma.JsonFilter,
    });
  }
  if (query.issueType === SCRIPT_VALIDATION_ISSUE_TYPE && query.recommendedAction) {
    const subtypes = listScriptValidationSubtypesByRecommendedAction(
      query.recommendedAction
    );
    if (subtypes.length === 0) {
      andClauses.push({
        id: "__recommended_action_no_match__",
      });
    } else {
      andClauses.push({
        OR: subtypes.map((subtype) => ({
          issueDetail: {
            path: ["scriptSubtype"],
            equals: subtype,
          } as Prisma.JsonFilter,
        })),
      });
    }
  }
  if (query.chapterId) {
    where.chapterId = query.chapterId;
  }
  if (query.sentenceId) {
    where.sentenceId = query.sentenceId;
  }
  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return where;
};

const parseRecommendedActionFilter = (
  value: unknown
): ScriptValidationRecommendedAction | undefined => {
  const actionInput = asString(value)?.toLowerCase();
  if (!actionInput || actionInput === "all") {
    return undefined;
  }
  if (RECOMMENDED_ACTION_SET.has(actionInput as ScriptValidationRecommendedAction)) {
    return actionInput as ScriptValidationRecommendedAction;
  }
  throw new ValidationError(
    "recommendedAction 仅支持 approve/reject/regenerate/all"
  );
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
    scriptSubtype: asString(searchParams.get("scriptSubtype")),
    recommendedAction: parseRecommendedActionFilter(
      searchParams.get("recommendedAction")
    ),
    chapterId: asString(searchParams.get("chapterId")),
    sentenceId: asString(searchParams.get("sentenceId")),
  };
};

const parseResolveAction = (value: unknown): ManualReviewResolveAction | undefined => {
  const actionInput = asString(value);
  if (!actionInput) {
    return undefined;
  }

  if (RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()]) {
    return RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()];
  }

  return RESOLVE_ACTION_ALIAS[actionInput];
};

export const parseManualReviewResolvePayload = (
  body: unknown
): ManualReviewResolvePayload => {
  const payload = asRecord(body);
  const action = parseResolveAction(payload?.action);

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

export const parseManualReviewBatchResolvePayload = (
  body: unknown
): ManualReviewBatchResolvePayload => {
  const payload = asRecord(body);
  const singlePayload = parseManualReviewResolvePayload(payload);
  const itemIds = asStringArray(payload?.itemIds);

  if (itemIds.length === 0) {
    throw new ValidationError("itemIds 必填，且至少包含 1 个复核项");
  }
  if (itemIds.length > MAX_BATCH_RESOLVE_ITEMS) {
    throw new ValidationError(`itemIds 不能超过 ${MAX_BATCH_RESOLVE_ITEMS} 条`);
  }

  return {
    ...singlePayload,
    itemIds,
  };
};

export const parseManualReviewExportQuery = (
  searchParams: URLSearchParams
): ManualReviewExportQuery => {
  const statusInput = asString(searchParams.get("status"))?.toLowerCase();
  let status: ManualReviewStatus | undefined;

  if (statusInput === "all" || !statusInput) {
    status = undefined;
  } else if (REVIEW_STATUS_SET.has(statusInput as ManualReviewStatus)) {
    status = statusInput as ManualReviewStatus;
  } else {
    throw new ValidationError(
      "status 仅支持 pending/reprocessing/resolved/rejected/all"
    );
  }

  return {
    status,
    priority: asString(searchParams.get("priority")),
    issueType: asString(searchParams.get("issueType")),
    scriptSubtype: asString(searchParams.get("scriptSubtype")),
    recommendedAction: parseRecommendedActionFilter(
      searchParams.get("recommendedAction")
    ),
    chapterId: asString(searchParams.get("chapterId")),
    sentenceId: asString(searchParams.get("sentenceId")),
  };
};

const buildRegenerateNote = (note: string | undefined, taskId: string): string => {
  const marker = `retry_task:${taskId}`;
  if (!note) {
    return marker;
  }
  return `${note}\n${marker}`;
};

const buildBatchRegenerateNote = (
  note: string | undefined,
  taskId: string
): string => {
  const marker = `manual_review_batch_task:${taskId}`;
  if (!note) {
    return marker;
  }
  return `${note}\n${marker}`;
};

const buildAllPendingRegenerateNote = (taskId: string): string => {
  return `manual_review_bulk_pending_task:${taskId}`;
};

const toUniqueValues = (values: Array<string | null | undefined>): string[] => {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
};

const appendResolutionNote = (
  current: string | null | undefined,
  next: string
): string => {
  if (!current) {
    return next;
  }
  if (current.includes(next)) {
    return current;
  }
  return `${current}\n${next}`;
};

const resetPendingReviewItemState = async (itemIds: string[]): Promise<void> => {
  for (const itemId of itemIds) {
    await prisma.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: "pending",
        resolutionType: null,
        resolutionNote: null,
        resolvedAt: null,
      },
    });
  }
};

const markReprocessingReviewItems = async (params: {
  items: Array<{ id: string }>;
  resolutionType: string;
  resolutionNote: string;
}) => {
  for (const item of params.items) {
    await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "reprocessing",
        resolutionType: params.resolutionType,
        resolutionNote: params.resolutionNote,
        resolvedAt: null,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });
  }
};

const resolveUpdatedStatus = (
  action: ManualReviewResolveAction
): "resolved" | "rejected" => {
  return action === "approve" ? "resolved" : "rejected";
};

const resolveResolutionType = (action: ManualReviewResolveAction): string => {
  return action === "approve" ? "approved" : "rejected";
};

const ensureNoActiveAudioTask = async (bookId: string): Promise<void> => {
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
};

const ensureNoActiveScriptTask = async (bookId: string): Promise<void> => {
  const activeScriptTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: "SCRIPT_GENERATION",
      status: "processing",
    },
    select: { id: true },
  });

  if (activeScriptTask) {
    throw new ValidationError("当前存在执行中的台本任务，请稍后重试");
  }
};

const handleTaskEnqueueFailure = async ({
  taskId,
  queueError,
  message,
}: {
  taskId: string;
  queueError: unknown;
  message: string;
}) => {
  const errorMessage =
    queueError instanceof Error ? queueError.message : message;
  const failedTaskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      queueError: errorMessage,
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
      taskData: failedTaskData,
    },
  });
};

const handleScriptTaskEnqueueFailure = handleTaskEnqueueFailure;
const handleAudioTaskEnqueueFailure = handleTaskEnqueueFailure;

const markTaskRolledBack = async ({
  taskId,
  message,
}: {
  taskId: string;
  message: string;
}) => {
  const failedTaskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      compensation: "rolled_back_before_execution",
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: message,
      taskData: failedTaskData,
    },
  });
};

const toExportCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const getItemScore = (item: FormattedManualReviewItem): number | null => {
  if (item.latestQualityCheck?.score !== null && item.latestQualityCheck?.score !== undefined) {
    return item.latestQualityCheck.score;
  }
  if (item.audio?.qualityScore !== null && item.audio?.qualityScore !== undefined) {
    return item.audio.qualityScore;
  }
  return null;
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
  const hydratedRows = await hydrateManualReviewRuntimeDetails(rows);

  return {
    ...createPaginationResult(
      hydratedRows.map((item) => formatManualReviewItem(item)),
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

export const exportManualReviewItems = async (
  bookId: string,
  query: ManualReviewExportQuery
): Promise<FormattedManualReviewItem[]> => {
  const rows = await prisma.manualReviewItem.findMany({
    where: buildListWhere(bookId, query),
    include: MANUAL_REVIEW_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: MAX_EXPORT_ITEMS,
  });
  const hydratedRows = await hydrateManualReviewRuntimeDetails(rows);

  return hydratedRows.map((item) => formatManualReviewItem(item));
};

export const toManualReviewCsv = (items: FormattedManualReviewItem[]): string => {
  const headers = [
    "itemId",
    "status",
    "issueType",
    "issueSubtype",
    "issueSubtypeLabel",
    "priority",
    "chapterId",
    "sentenceId",
    "audioFileId",
    "score",
    "verdict",
    "recommendedAction",
    "scriptSummary",
    "scriptIssueMessages",
    "resolutionType",
    "resolutionNote",
    "assignedTo",
    "sentenceText",
    "createdAt",
    "updatedAt",
    "resolvedAt",
  ];

  const lines = [
    headers.join(","),
    ...items.map((item) => {
      const score = getItemScore(item);
      const scriptDetail =
        item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
          ? buildScriptValidationDetailView({
              issueSubtype: item.issueSubtype,
              issueDetail: item.issueDetail,
            })
          : null;
      return [
        toExportCell(item.id),
        toExportCell(item.status),
        toExportCell(item.issueType),
        toExportCell(item.issueSubtype),
        toExportCell(scriptDetail?.subtypeLabel || ""),
        toExportCell(item.priority),
        toExportCell(item.chapterId),
        toExportCell(item.sentenceId),
        toExportCell(item.audioFileId),
        toExportCell(score !== null ? score.toFixed(2) : ""),
        toExportCell(item.latestQualityCheck?.verdict || item.audio?.qualityVerdict || ""),
        toExportCell(scriptDetail?.recommendedActionLabel || ""),
        toExportCell(scriptDetail?.summary || ""),
        toExportCell((scriptDetail?.issueMessages || []).join(" | ")),
        toExportCell(item.resolutionType),
        toExportCell(item.resolutionNote),
        toExportCell(item.assignedTo),
        toExportCell(item.sentence?.text || ""),
        toExportCell(item.createdAt),
        toExportCell(item.updatedAt),
        toExportCell(item.resolvedAt),
      ].join(",");
    }),
  ];

  return lines.join("\n");
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
        status: resolveUpdatedStatus(payload.action),
        resolutionType: resolveResolutionType(payload.action),
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

  if (item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE) {
    if (!item.segmentId) {
      throw new ValidationError("当前脚本复核项缺少 segmentId，无法触发台本重跑");
    }

    await ensureNoActiveScriptTask(bookId);

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
        progress: 0,
        totalItems: 1,
        taskData: {
          message: "人工复核触发段落台本重跑",
          metadata: {
            source: "manual_review",
            manualReviewItemId: itemId,
            type: "segment",
            segmentIds: [item.segmentId],
            note: payload.note || null,
            regenerateSegments: true,
          },
        },
      },
    });

    try {
      await enqueueScriptGenerationJob({
        taskId: task.id,
        bookId,
        options: {},
        extraParams: {
          regenerateSegments: true,
          segmentIds: [item.segmentId],
        },
      });
    } catch (queueError) {
      await handleScriptTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核台本重跑任务入队失败",
      });
      throw queueError;
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });

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
        taskType: "SCRIPT_GENERATION",
        status: task.status,
      },
    };
  }

  if (!item.sentenceId) {
    throw new ValidationError("当前复核项缺少 sentenceId，无法触发重生");
  }

  await ensureNoActiveAudioTask(bookId);

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
    await handleTaskEnqueueFailure({
      taskId: task.id,
      queueError,
      message: "人工复核重生任务入队失败",
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

export const resolveManualReviewItemsInBatch = async ({
  bookId,
  payload,
}: ResolveManualReviewBatchInput): Promise<ManualReviewBatchResolveResult> => {
  const rows = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      id: {
        in: payload.itemIds,
      },
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const orderedItems = payload.itemIds
    .map((itemId) => rowMap.get(itemId))
    .filter((item): item is (typeof rows)[number] => Boolean(item));

  if (orderedItems.length !== payload.itemIds.length) {
    const missingItemIds = payload.itemIds.filter((itemId) => !rowMap.has(itemId));
    throw new ValidationError(`复核项不存在: ${missingItemIds.join(", ")}`);
  }

  const nonPendingItems = orderedItems.filter((item) => item.status !== "pending");
  if (nonPendingItems.length > 0) {
    throw new ValidationError("仅 pending 状态的复核项支持批量处理");
  }

  if (payload.action === "approve" || payload.action === "reject") {
    const updatedItems: FormattedManualReviewItem[] = [];
    for (const item of orderedItems) {
      const updated = await prisma.manualReviewItem.update({
        where: { id: item.id },
        data: {
          status: resolveUpdatedStatus(payload.action),
          resolutionType: resolveResolutionType(payload.action),
          resolutionNote: payload.note || null,
          assignedTo: payload.assignedTo ?? item.assignedTo,
          resolvedAt: new Date(),
        },
        include: MANUAL_REVIEW_INCLUDE,
      });
      updatedItems.push(formatManualReviewItem(updated));
    }

    return {
      action: payload.action,
      processedCount: updatedItems.length,
      items: updatedItems,
      retryTask: null,
    };
  }

  const scriptValidationItems = orderedItems.filter(
    (item) => item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
  );

  if (scriptValidationItems.length > 0) {
    if (scriptValidationItems.length !== orderedItems.length) {
      throw new ValidationError(
        "批量重生暂不支持同时包含脚本复核项和音频复核项，请分开处理"
      );
    }

    const segmentIds = Array.from(
      new Set(
        orderedItems
          .map((item) => item.segmentId)
          .filter((segmentId): segmentId is string => Boolean(segmentId))
      )
    );
    const missingSegmentItemIds = orderedItems
      .filter((item) => !item.segmentId)
      .map((item) => item.id);

    if (missingSegmentItemIds.length > 0) {
      throw new ValidationError(
        `批量台本重跑失败：以下复核项缺少 segmentId：${missingSegmentItemIds.join(", ")}`
      );
    }

    await ensureNoActiveScriptTask(bookId);

    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "processing",
        progress: 0,
        totalItems: segmentIds.length,
        taskData: {
          message: "人工复核批量触发段落台本重跑",
          metadata: {
            source: "manual_review_batch",
            type: "batch",
            segmentIds,
            selectedReviewItemIds: orderedItems.map((item) => item.id),
            note: payload.note || null,
            regenerateSegments: true,
          },
        },
      },
    });

    try {
      await enqueueScriptGenerationJob({
        taskId: task.id,
        bookId,
        options: {},
        extraParams: {
          regenerateSegments: true,
          segmentIds,
        },
      });
    } catch (queueError) {
      await handleScriptTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核批量台本重跑任务入队失败",
      });
      throw queueError;
    }

    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });

    const updatedItems: FormattedManualReviewItem[] = [];
    for (const item of orderedItems) {
      const updated = await prisma.manualReviewItem.update({
        where: { id: item.id },
        data: {
          status: "reprocessing",
          resolutionType: "batch_regenerate",
          resolutionNote: buildBatchRegenerateNote(payload.note, task.id),
          assignedTo: payload.assignedTo ?? item.assignedTo,
          resolvedAt: null,
        },
        include: MANUAL_REVIEW_INCLUDE,
      });
      updatedItems.push(formatManualReviewItem(updated));
    }

    return {
      action: payload.action,
      processedCount: updatedItems.length,
      items: updatedItems,
      retryTask: {
        taskId: task.id,
        taskType: "SCRIPT_GENERATION",
        status: task.status,
      },
    };
  }

  const scriptSentenceIds = Array.from(
    new Set(
      orderedItems
        .map((item) => item.sentenceId)
        .filter((sentenceId): sentenceId is string => Boolean(sentenceId))
    )
  );
  const missingSentenceItemIds = orderedItems
    .filter((item) => !item.sentenceId)
    .map((item) => item.id);

  if (missingSentenceItemIds.length > 0) {
    throw new ValidationError(
      `批量重生失败：以下复核项缺少 sentenceId：${missingSentenceItemIds.join(", ")}`
    );
  }

  await ensureNoActiveAudioTask(bookId);

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
      progress: 0,
      totalItems: scriptSentenceIds.length,
      taskData: {
        message: "人工复核批量重生任务已创建",
        metadata: {
          source: "manual_review_batch",
          type: "batch",
          scriptSentenceIds,
          selectedReviewItemIds: orderedItems.map((item) => item.id),
          voiceProfileId: payload.voiceProfileId || null,
          provider: payload.provider || null,
          autoMerge: payload.autoMerge,
          note: payload.note || null,
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
      type: "batch",
      scriptSentenceIds,
      voiceProfileId: payload.voiceProfileId,
      autoMerge: payload.autoMerge,
      options: {
        provider: payload.provider,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
  } catch (queueError) {
    await handleTaskEnqueueFailure({
      taskId: task.id,
      queueError,
      message: "人工复核批量重生任务入队失败",
    });
    throw queueError;
  }

  const updatedItems: FormattedManualReviewItem[] = [];
  for (const item of orderedItems) {
    const updated = await prisma.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: "reprocessing",
        resolutionType: "batch_regenerate",
        resolutionNote: buildBatchRegenerateNote(payload.note, task.id),
        assignedTo: payload.assignedTo ?? item.assignedTo,
        resolvedAt: null,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });
    updatedItems.push(formatManualReviewItem(updated));
  }

  return {
    action: payload.action,
    processedCount: updatedItems.length,
    items: updatedItems,
    retryTask: {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: task.status,
    },
  };
};

export const regenerateAllPendingManualReviewItems = async ({
  bookId,
}: RegenerateAllPendingManualReviewInput): Promise<RegenerateAllPendingManualReviewResult> => {
  const rows = await prisma.manualReviewItem.findMany({
    where: {
      bookId,
      status: "pending",
    },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (rows.length === 0) {
    throw new ValidationError("当前没有待复核项可重生");
  }

  const scriptItems = rows.filter(
    (item) => item.issueType === SCRIPT_VALIDATION_ISSUE_TYPE
  );
  const audioItems = rows.filter(
    (item) => item.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE
  );

  const missingScriptSegmentIds = scriptItems
    .filter((item) => !item.segmentId)
    .map((item) => item.id);
  if (missingScriptSegmentIds.length > 0) {
    throw new ValidationError(
      `全量重生失败：以下脚本复核项缺少 segmentId：${missingScriptSegmentIds.join(", ")}`
    );
  }

  const missingAudioSentenceIds = audioItems
    .filter((item) => !item.sentenceId)
    .map((item) => item.id);
  if (missingAudioSentenceIds.length > 0) {
    throw new ValidationError(
      `全量重生失败：以下音频复核项缺少 sentenceId：${missingAudioSentenceIds.join(", ")}`
    );
  }

  const scriptSegmentIds = toUniqueValues(
    scriptItems.map((item) => item.segmentId)
  );
  const scriptReviewItemIds = scriptItems.map((item) => item.id);
  const audioSentenceIds = toUniqueValues(
    audioItems.map((item) => item.sentenceId)
  );
  const audioReviewItemIds = audioItems.map((item) => item.id);

  if (scriptSegmentIds.length > 0) {
    await ensureNoActiveScriptTask(bookId);
  }
  if (audioSentenceIds.length > 0) {
    await ensureNoActiveAudioTask(bookId);
  }

  let scriptTask: ManualReviewRetryTask | null = null;
  let audioTask: ManualReviewRetryTask | null = null;
  let processedCount = 0;
  const warnings: string[] = [];
  let scriptTaskId: string | null = null;
  let scriptStatusesMarked = false;

  if (scriptSegmentIds.length > 0) {
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "SCRIPT_GENERATION",
        status: "pending",
        progress: 0,
        totalItems: scriptSegmentIds.length,
        taskData: {
          message: "人工复核触发全部待复核台本重跑",
          metadata: {
            source: "manual_review_bulk_pending",
            type: "all_pending",
            segmentIds: scriptSegmentIds,
            selectedReviewItemIds: scriptReviewItemIds,
            regenerateSegments: true,
          },
        },
      },
    });

    try {
      await enqueueScriptGenerationJob({
        taskId: task.id,
        bookId,
        options: {},
        extraParams: {
          regenerateSegments: true,
          segmentIds: scriptSegmentIds,
        },
      });
    } catch (queueError) {
      await handleScriptTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核全量台本重跑任务入队失败",
      });
      throw queueError;
    }

    scriptTaskId = task.id;
    scriptTask = {
      taskId: task.id,
      taskType: "SCRIPT_GENERATION",
      status: "processing",
    };
  }

  if (audioSentenceIds.length > 0) {
    const isBatchAudio = audioSentenceIds.length > 1;
    const task = await prisma.processingTask.create({
      data: {
        bookId,
        taskType: "AUDIO_GENERATION",
        status: "pending",
        progress: 0,
        totalItems: audioSentenceIds.length,
        taskData: {
          message: "人工复核触发全部待复核音频重生",
          metadata: {
            source: "manual_review_bulk_pending",
            type: "all_pending",
            scriptSentenceIds: audioSentenceIds,
            selectedReviewItemIds: audioReviewItemIds,
            autoMerge: false,
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
        type: isBatchAudio ? "batch" : "single",
        scriptSentenceIds: audioSentenceIds,
        voiceProfileId: undefined,
        autoMerge: false,
        options: {
          provider: undefined,
          skipExisting: false,
          overwriteExisting: true,
        },
      });
    } catch (queueError) {
      await handleAudioTaskEnqueueFailure({
        taskId: task.id,
        queueError,
        message: "人工复核全量音频重生任务入队失败",
      });

      if (scriptTaskId) {
        const cancelResult = await cancelProcessingTaskJob(
          "SCRIPT_GENERATION",
          scriptTaskId
        );

        if (cancelResult.canceled) {
          await markTaskRolledBack({
            taskId: scriptTaskId,
            message: "人工复核全量台本重跑任务已回滚：音频任务入队失败",
          });
          if (scriptStatusesMarked) {
            await resetPendingReviewItemState(scriptReviewItemIds);
          }
          throw queueError;
        }

        if (!scriptStatusesMarked) {
          await prisma.book.update({
            where: { id: bookId },
            data: { status: "generating_script" },
          });
          await markReprocessingReviewItems({
            items: scriptItems,
            resolutionType: "bulk_regenerate_pending",
            resolutionNote: buildAllPendingRegenerateNote(scriptTaskId),
          });
          processedCount += scriptItems.length;
          scriptStatusesMarked = true;
        }

        warnings.push(
          "音频任务入队失败，但台本任务已经开始执行；音频复核项仍保持待复核。"
        );
        return {
          reviewItemCount: rows.length,
          processedCount,
          scriptTask,
          audioTask: null,
          warnings,
        };
      }

      throw queueError;
    }

    audioTask = {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: "processing",
    };
  }

  if (scriptTaskId && !scriptStatusesMarked) {
    await prisma.book.update({
      where: { id: bookId },
      data: { status: "generating_script" },
    });
    await markReprocessingReviewItems({
      items: scriptItems,
      resolutionType: "bulk_regenerate_pending",
      resolutionNote: buildAllPendingRegenerateNote(scriptTaskId),
    });
    processedCount += scriptItems.length;
    scriptStatusesMarked = true;
  }

  if (audioTask) {
    await markReprocessingReviewItems({
      items: audioItems,
      resolutionType: "bulk_regenerate_pending",
      resolutionNote: buildAllPendingRegenerateNote(audioTask.taskId),
    });
    processedCount += audioItems.length;
  }

  return {
    reviewItemCount: rows.length,
    processedCount,
    scriptTask,
    audioTask,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

export const saveManualReviewScriptEdit = async ({
  bookId,
  itemId,
  payload,
}: SaveManualReviewScriptEditInput): Promise<ManualReviewResolveResult> => {
  if (!isStructuredScriptResult(payload?.structuredResult)) {
    throw new ValidationError("structuredResult 必填，且必须是对象");
  }

  const item = await prisma.manualReviewItem.findUnique({
    where: { id: itemId },
    include: MANUAL_REVIEW_INCLUDE,
  });

  if (!item || item.bookId !== bookId) {
    throw new ValidationError("复核项不存在");
  }

  if (item.issueType !== SCRIPT_VALIDATION_ISSUE_TYPE) {
    throw new ValidationError("仅 SCRIPT_VALIDATION 复核项支持人工修订保存");
  }

  if (item.status !== "pending") {
    throw new ValidationError("仅 pending 状态的复核项支持人工修订保存");
  }

  if (!item.segmentId) {
    throw new ValidationError("当前脚本复核项缺少 segmentId，无法保存人工修订结果");
  }

  const detail = asRecord(item.issueDetail);
  const segmentContent = asString(detail?.segmentContent);
  if (!segmentContent) {
    throw new ValidationError("当前复核项缺少完整段落原文，无法保存人工修订结果");
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      characterProfiles: {
        where: { isActive: true },
        include: {
          aliases: true,
        },
      },
    },
  });

  if (!book) {
    throw new ValidationError("书籍不存在");
  }

  const characterMap = new Map<string, string>();
  for (const character of book.characterProfiles) {
    characterMap.set(character.canonicalName, character.canonicalName);
    for (const alias of character.aliases || []) {
      if (alias.alias) {
        characterMap.set(alias.alias, character.canonicalName);
      }
    }
  }

  const segmentResult = buildSegmentProcessingResultFromStructuredResult({
    segment: {
      id: item.segmentId,
      chapterId: item.chapterId,
      orderIndex:
        typeof detail?.orderIndex === "number" ? Number(detail.orderIndex) : -1,
      content: segmentContent,
    },
    structuredResult: payload.structuredResult,
    characterMap,
    options: resolveScriptGenerationOptions(),
  });

  const updated = await prisma.$transaction(async (tx) => {
    await persistSegmentProcessingResult({
      bookId,
      segmentId: item.segmentId as string,
      result: segmentResult,
      characterMap,
      characterProfiles: book.characterProfiles,
      db: tx,
    });

    const now = new Date();
    return tx.manualReviewItem.update({
      where: { id: itemId },
      data: {
        status: "resolved",
        resolutionType: "manual_edit_saved",
        resolutionNote: appendResolutionNote(
          item.resolutionNote,
          `manual_edit_saved:${now.toISOString()}`
        ),
        resolvedAt: now,
        issueDetail: {
          ...(detail || {}),
          manualEditedStructuredResult: payload.structuredResult,
          manualEditedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: MANUAL_REVIEW_INCLUDE,
    });
  });

  return {
    item: formatManualReviewItem(updated),
    retryTask: null,
  };
};

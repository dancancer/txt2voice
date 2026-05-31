import prisma from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import {
  createPaginationResult,
  getPaginationFromSearch,
  parsePaginationParams,
} from "@/lib/pagination";
import { hydrateManualReviewRuntimeDetails } from "@/lib/manual-review-runtime-recovery";
import {
  buildScriptValidationDetailView,
  SCRIPT_VALIDATION_RECOMMENDED_ACTION_OPTIONS,
} from "@/lib/script-validation-detail";
import { SCRIPT_VALIDATION_ISSUE_TYPE } from "@/lib/script-validation-review";
import type {
  FormattedManualReviewItem,
  ManualReviewBatchResolvePayload,
  ManualReviewExportQuery,
  ManualReviewListQuery,
  ManualReviewResolvePayload,
  ManualReviewStatus,
} from "@/lib/manual-review/types";
import {
  asRecord,
  asString,
  asStringArray,
  buildListWhere,
  formatManualReviewItem,
  getItemScore,
  MANUAL_REVIEW_INCLUDE,
  MAX_BATCH_RESOLVE_ITEMS,
  MAX_EXPORT_ITEMS,
  parseRecommendedActionFilter,
  parseResolveAction,
  REVIEW_STATUS_SET,
  toExportCell,
} from "@/lib/manual-review/utils";

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

  return {
    action,
    note,
    assignedTo: asString(payload?.assignedTo),
    voiceProfileId: asString(payload?.voiceProfileId),
    preferredProvider: asString(payload?.preferredProvider) as
      | "voxcpm"
      | "qwen3voice"
      | undefined,
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
      prisma.manualReviewItem.count({ where: { ...summaryWhere, status: "pending" } }),
      prisma.manualReviewItem.count({ where: { ...summaryWhere, status: "reprocessing" } }),
      prisma.manualReviewItem.count({ where: { ...summaryWhere, status: "resolved" } }),
      prisma.manualReviewItem.count({ where: { ...summaryWhere, status: "rejected" } }),
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

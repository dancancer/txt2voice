import type { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
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
import type {
  FormattedManualReviewItem,
  ManualReviewFilterOptions,
  ManualReviewResolveAction,
  ManualReviewStatus,
} from "@/lib/manual-review/types";

export const MAX_BATCH_RESOLVE_ITEMS = 200;
export const MAX_EXPORT_ITEMS = 5000;

export const REVIEW_STATUS_SET = new Set<ManualReviewStatus>([
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

export const MANUAL_REVIEW_INCLUDE = {
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

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(normalized));
  }

  const single = asString(value);
  return single ? [single] : [];
};

export const toNumber = (
  value: Prisma.Decimal | number | null | undefined
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return Number.isFinite(value.toNumber()) ? value.toNumber() : null;
};

export const parseRecommendedActionFilter = (
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

export const parseResolveAction = (
  value: unknown
): ManualReviewResolveAction | undefined => {
  const actionInput = asString(value);
  if (!actionInput) {
    return undefined;
  }
  if (RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()]) {
    return RESOLVE_ACTION_ALIAS[actionInput.toLowerCase()];
  }
  return RESOLVE_ACTION_ALIAS[actionInput];
};

export const formatManualReviewItem = (item: any): FormattedManualReviewItem => {
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

export const buildListWhere = (
  bookId: string,
  query: ManualReviewFilterOptions
): Prisma.ManualReviewItemWhereInput => {
  const where: Prisma.ManualReviewItemWhereInput = { bookId };
  const andClauses: Prisma.ManualReviewItemWhereInput[] = [];

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.issueType) where.issueType = query.issueType;
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
      andClauses.push({ id: "__recommended_action_no_match__" });
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
  if (query.chapterId) where.chapterId = query.chapterId;
  if (query.sentenceId) where.sentenceId = query.sentenceId;
  if (andClauses.length > 0) where.AND = andClauses;

  return where;
};

export const buildRegenerateNote = (
  note: string | undefined,
  taskId: string
): string => {
  const marker = `retry_task:${taskId}`;
  return note ? `${note}\n${marker}` : marker;
};

export const buildBatchRegenerateNote = (
  note: string | undefined,
  taskId: string
): string => {
  const marker = `manual_review_batch_task:${taskId}`;
  return note ? `${note}\n${marker}` : marker;
};

export const buildAllPendingRegenerateNote = (taskId: string): string => {
  return `manual_review_bulk_pending_task:${taskId}`;
};

export const toUniqueValues = (values: Array<string | null | undefined>): string[] => {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
};

export const appendResolutionNote = (
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

export const isStructuredScriptResult = (
  value: unknown
): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export const toExportCell = (value: unknown): string => {
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

export const getItemScore = (item: FormattedManualReviewItem): number | null => {
  if (item.latestQualityCheck?.score !== null && item.latestQualityCheck?.score !== undefined) {
    return item.latestQualityCheck.score;
  }
  if (item.audio?.qualityScore !== null && item.audio?.qualityScore !== undefined) {
    return item.audio.qualityScore;
  }
  return null;
};

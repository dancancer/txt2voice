// 一旦我被更新，请更新我的开头注释
// input: 返工筛选 payload/复核项候选
// output: qc retry 辅助函数
// pos: 质量返工服务
import { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import type {
  QcDispatchPolicy,
  QcIssueTypeDispatchPolicy,
  ResolvedQcDispatchPolicy,
} from "@/lib/qc-dispatch-policy";
import { parseDispatchPolicy } from "@/lib/qc-dispatch-policy";
import type {
  QualityRetryPayload,
} from "@/lib/qc-retry-service";

type ManualReviewRetryStatus = "pending" | "rejected";
export type RetryIssueTypeDispatchPolicy = QcIssueTypeDispatchPolicy;
export type RetryDispatchPolicy = QcDispatchPolicy;
export type ResolvedRetryDispatchPolicy = ResolvedQcDispatchPolicy;

export interface RetryCandidateItem {
  id: string;
  sentenceId: string | null;
  status: string;
  resolutionNote: string | null;
  issueDetail: Prisma.JsonValue;
  qualityCheckResult: {
    score: Prisma.Decimal | number | null;
  } | null;
  createdAt: Date;
  priority: string;
}

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

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
  }

  const single = asString(value);
  return single ? [single] : undefined;
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

const extractScoreFromIssueDetail = (issueDetail: Prisma.JsonValue): number | null => {
  const detail = asRecord(issueDetail);
  const score = asNumber(detail?.score);
  return score ?? null;
};

export const getCandidateScore = (candidate: RetryCandidateItem): number | null => {
  const scoreFromQuality = toNumber(candidate.qualityCheckResult?.score);
  if (scoreFromQuality !== null) {
    return scoreFromQuality;
  }
  return extractScoreFromIssueDetail(candidate.issueDetail);
};

export const appendResolutionNote = (
  current: string | null | undefined,
  marker: string,
  note?: string
): string => {
  const pieces: string[] = [];
  if (current) {
    pieces.push(current);
  }
  if (!current?.includes(marker)) {
    pieces.push(marker);
  }
  if (note) {
    pieces.push(note);
  }
  return pieces.join("\n");
};

export const priorityRank = (priority: string): number => {
  if (priority === "high") {
    return 0;
  }
  if (priority === "normal") {
    return 1;
  }
  return 2;
};

const normalizeIssueType = (value: string): string => value.trim().toUpperCase();

const normalizeIssueTypeList = (values: string[] | undefined): string[] | undefined => {
  if (!values) {
    return undefined;
  }
  const normalized = values
    .map((value) => normalizeIssueType(value))
    .filter((value) => value.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

export const parseQualityRetryPayload = (body: unknown): QualityRetryPayload => {
  const payload = asRecord(body);

  const issueTypes = normalizeIssueTypeList(
    asStringArray(payload?.issueTypes ?? payload?.issueType)
  );
  const chapterId = asString(payload?.chapterId);
  const sentenceIds = asStringArray(payload?.sentenceIds);

  const minScore = asNumber(payload?.minScore);
  const maxScore = asNumber(payload?.maxScore);
  if (minScore !== undefined && (minScore < 0 || minScore > 100)) {
    throw new ValidationError("minScore 必须在 0-100 之间");
  }
  if (maxScore !== undefined && (maxScore < 0 || maxScore > 100)) {
    throw new ValidationError("maxScore 必须在 0-100 之间");
  }
  if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
    throw new ValidationError("minScore 不能大于 maxScore");
  }

  const limitInput = asNumber(payload?.limit);
  const limit = limitInput === undefined ? 100 : Math.floor(limitInput);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new ValidationError("limit 必须是 1-500 的整数");
  }

  const note = asString(payload?.note);
  if (note && note.length > 1000) {
    throw new ValidationError("note 不能超过 1000 字符");
  }

  const dispatchPolicy = parseDispatchPolicy({
    value: payload?.dispatchPolicy,
    strict: true,
    path: "dispatchPolicy",
  });

  return {
    issueTypes,
    chapterId,
    sentenceIds,
    minScore,
    maxScore,
    includeRejected: payload?.includeRejected === true,
    limit,
    voiceProfileId: asString(payload?.voiceProfileId),
    preferredProvider:
      asString(payload?.preferredProvider)?.toLowerCase() === "voxcpm"
        ? "voxcpm"
        : undefined,
    autoMerge: payload?.autoMerge === true,
    note,
    dispatchPolicy,
  };
};

export const buildRetryWhere = (
  bookId: string,
  payload: QualityRetryPayload
): Prisma.ManualReviewItemWhereInput => {
  const statuses: ManualReviewRetryStatus[] = payload.includeRejected
    ? ["pending", "rejected"]
    : ["pending"];

  return {
    bookId,
    status: {
      in: statuses,
    },
    ...(payload.issueTypes
      ? {
          issueType: {
            in: payload.issueTypes,
          },
        }
      : {}),
    ...(payload.chapterId ? { chapterId: payload.chapterId } : {}),
    ...(payload.sentenceIds
      ? {
          sentenceId: {
            in: payload.sentenceIds,
          },
        }
      : {}),
  };
};

export const matchScoreRange = (
  candidate: RetryCandidateItem,
  minScore?: number,
  maxScore?: number
): boolean => {
  if (minScore === undefined && maxScore === undefined) {
    return true;
  }

  const score = getCandidateScore(candidate);
  if (score === null) {
    return false;
  }

  if (minScore !== undefined && score < minScore) {
    return false;
  }
  if (maxScore !== undefined && score > maxScore) {
    return false;
  }

  return true;
};

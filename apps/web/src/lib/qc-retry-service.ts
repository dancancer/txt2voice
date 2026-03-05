// 一旦我被更新，请更新我的开头注释
// input: 返工筛选参数/服务依赖
// output: 批量返工任务结果
// pos: 质量返工服务
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAudioGenerationJob } from "@/lib/task-queue";

type ManualReviewRetryStatus = "pending" | "rejected";

export interface QualityRetryPayload {
  issueTypes?: string[];
  chapterId?: string;
  sentenceIds?: string[];
  minScore?: number;
  maxScore?: number;
  includeRejected: boolean;
  limit: number;
  voiceProfileId?: string;
  provider?: string;
  autoMerge: boolean;
  note?: string;
}

export interface RetryQualityIssuesInput {
  bookId: string;
  payload: QualityRetryPayload;
}

export interface RetryQualityIssuesResult {
  retryTask: {
    taskId: string;
    taskType: "AUDIO_GENERATION";
    status: string;
  };
  selectedReviewItemCount: number;
  selectedSentenceCount: number;
  selectedReviewItemIds: string[];
  selectedSentenceIds: string[];
}

interface RetryCandidateItem {
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

const getCandidateScore = (candidate: RetryCandidateItem): number | null => {
  const scoreFromQuality = toNumber(candidate.qualityCheckResult?.score);
  if (scoreFromQuality !== null) {
    return scoreFromQuality;
  }
  return extractScoreFromIssueDetail(candidate.issueDetail);
};

const appendResolutionNote = (
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

const priorityRank = (priority: string): number => {
  if (priority === "high") {
    return 0;
  }
  if (priority === "normal") {
    return 1;
  }
  return 2;
};

export const parseQualityRetryPayload = (body: unknown): QualityRetryPayload => {
  const payload = asRecord(body);

  const issueTypes = asStringArray(payload?.issueTypes ?? payload?.issueType);
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
  if (
    minScore !== undefined &&
    maxScore !== undefined &&
    minScore > maxScore
  ) {
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

  return {
    issueTypes,
    chapterId,
    sentenceIds,
    minScore,
    maxScore,
    includeRejected: payload?.includeRejected === true,
    limit,
    voiceProfileId: asString(payload?.voiceProfileId),
    provider: asString(payload?.provider),
    autoMerge: payload?.autoMerge === true,
    note,
  };
};

const buildRetryWhere = (
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
    ...(payload.chapterId
      ? {
          chapterId: payload.chapterId,
        }
      : {}),
    ...(payload.sentenceIds
      ? {
          sentenceId: {
            in: payload.sentenceIds,
          },
        }
      : {}),
  };
};

const matchScoreRange = (
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

export const retryQualityIssues = async ({
  bookId,
  payload,
}: RetryQualityIssuesInput): Promise<RetryQualityIssuesResult> => {
  const activeAudioTask = await prisma.processingTask.findFirst({
    where: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
    },
    select: {
      id: true,
    },
  });

  if (activeAudioTask) {
    throw new ValidationError("当前存在执行中的音频任务，请稍后重试");
  }

  const where = buildRetryWhere(bookId, payload);
  const fetchSize = Math.min(Math.max(payload.limit * 3, payload.limit), 2000);

  const candidates = (await prisma.manualReviewItem.findMany({
    where,
    select: {
      id: true,
      sentenceId: true,
      status: true,
      resolutionNote: true,
      issueDetail: true,
      priority: true,
      createdAt: true,
      qualityCheckResult: {
        select: {
          score: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
    take: fetchSize,
  })) as RetryCandidateItem[];

  const selectedItems = candidates
    .filter((candidate) =>
      matchScoreRange(candidate, payload.minScore, payload.maxScore)
    )
    .sort((left, right) => {
      const priorityDiff = priorityRank(left.priority) - priorityRank(right.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.createdAt.getTime() - right.createdAt.getTime();
    })
    .slice(0, payload.limit);

  if (selectedItems.length === 0) {
    throw new ValidationError("未匹配到可返工的复核项");
  }

  const selectedSentenceIds = Array.from(
    new Set(
      selectedItems
        .map((item) => item.sentenceId)
        .filter((sentenceId): sentenceId is string => Boolean(sentenceId))
    )
  );

  if (selectedSentenceIds.length === 0) {
    throw new ValidationError("复核项缺少 sentenceId，无法批量返工");
  }

  const task = await prisma.processingTask.create({
    data: {
      bookId,
      taskType: "AUDIO_GENERATION",
      status: "processing",
      progress: 0,
      totalItems: selectedSentenceIds.length,
      taskData: {
        message: "质量返工任务已创建",
        metadata: {
          source: "qc_retry",
          type: "batch",
          scriptSentenceIds: selectedSentenceIds,
          selectedReviewItemIds: selectedItems.map((item) => item.id),
          issueTypes: payload.issueTypes || [],
          chapterId: payload.chapterId || null,
          minScore: payload.minScore ?? null,
          maxScore: payload.maxScore ?? null,
          includeRejected: payload.includeRejected,
          voiceProfileId: payload.voiceProfileId || null,
          provider: payload.provider || null,
          autoMerge: payload.autoMerge,
          skipExisting: false,
          overwriteExisting: true,
          note: payload.note || null,
        },
      },
    },
  });

  try {
    await enqueueAudioGenerationJob({
      taskId: task.id,
      bookId,
      type: "batch",
      scriptSentenceIds: selectedSentenceIds,
      voiceProfileId: payload.voiceProfileId,
      autoMerge: payload.autoMerge,
      options: {
        provider: payload.provider,
        skipExisting: false,
        overwriteExisting: true,
      },
    });
  } catch (queueError) {
    const message = queueError instanceof Error ? queueError.message : "质量返工任务入队失败";
    const failedTaskData = await mergeTaskData(task.id, {
      message: "质量返工任务入队失败",
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

  const marker = `qc_retry_task:${task.id}`;
  for (const item of selectedItems) {
    await prisma.manualReviewItem.update({
      where: {
        id: item.id,
      },
      data: {
        status: "reprocessing",
        resolutionType: "batch_regenerate",
        resolutionNote: appendResolutionNote(item.resolutionNote, marker, payload.note),
        resolvedAt: null,
      },
    });
  }

  return {
    retryTask: {
      taskId: task.id,
      taskType: "AUDIO_GENERATION",
      status: task.status,
    },
    selectedReviewItemCount: selectedItems.length,
    selectedSentenceCount: selectedSentenceIds.length,
    selectedReviewItemIds: selectedItems.map((item) => item.id),
    selectedSentenceIds,
  };
};

// 一旦我被更新，请更新我的开头注释
// input: 返工筛选参数/服务依赖
// output: 批量返工任务结果
// pos: 质量返工服务
import prisma, { Prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/error-handler";
import { mergeTaskData } from "@/lib/processing-task-utils";
import { enqueueAudioGenerationJob } from "@/lib/task-queue";
import {
  toJsonDispatchPolicy,
} from "@/lib/qc-dispatch-policy";
import { resolveDispatchPolicyForBook } from "@/lib/qc-dispatch-policy-config-service";
import {
  appendResolutionNote,
  buildRetryWhere,
  matchScoreRange,
  parseQualityRetryPayload,
  priorityRank,
  RetryCandidateItem,
  type ResolvedRetryDispatchPolicy,
  type RetryDispatchPolicy,
  type RetryIssueTypeDispatchPolicy,
} from "@/lib/qc-retry/helpers";

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
  dispatchPolicy?: RetryDispatchPolicy;
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
  dispatchPolicy: ResolvedRetryDispatchPolicy;
}


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

  const policyResolution = await resolveDispatchPolicyForBook({
    bookId,
    overridePolicy: payload.dispatchPolicy,
  });
  const dispatchPolicy = policyResolution.resolvedPolicy;
  const dispatchPolicyMetadata = toJsonDispatchPolicy(dispatchPolicy);
  const dispatchPolicyScopesMetadata = policyResolution.runtimeScopes.map((scope) => ({
    scopeType: scope.scopeType,
    scopeKey: scope.scopeKey,
    configId: scope.configId,
    version: scope.version,
    isActive: scope.isActive,
    rolloutPercentage: scope.rolloutPercentage,
    policy: scope.policy || null,
    applied: scope.applied,
    appliedReason: scope.appliedReason,
    rolloutBucket: scope.rolloutBucket,
  })) as Prisma.InputJsonValue;
  const dispatchPolicyContextMetadata = {
    bookId: policyResolution.context.bookId,
    tenantId: policyResolution.context.tenantId,
    projectId: policyResolution.context.projectId,
  } as Prisma.InputJsonValue;

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
          autoCreatePendingOnReject: dispatchPolicy.autoCreatePendingOnReject,
          maxAutoRejectedCount: dispatchPolicy.maxAutoRejectedCount,
          issueTypePolicies:
            (dispatchPolicyMetadata as Record<string, Prisma.InputJsonValue>)
              .issueTypePolicies || {},
          dispatchPolicy: dispatchPolicyMetadata,
          dispatchPolicyScopes: dispatchPolicyScopesMetadata,
          dispatchPolicyContext: dispatchPolicyContextMetadata,
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
    dispatchPolicy,
  };
};

export { parseQualityRetryPayload } from "@/lib/qc-retry/helpers";

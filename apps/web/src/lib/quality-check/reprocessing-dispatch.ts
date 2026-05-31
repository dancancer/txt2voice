import type { Prisma } from "@/lib/prisma";
import type { CombinedQualityDecision } from "@/lib/quality-gate";
import type { IssueTypeDispatchPolicy } from "@/lib/quality-check/task-context";

export interface ReprocessingSyncResult {
  syncedCount: number;
  secondaryPendingCount: number;
  secondarySkippedByThresholdCount: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asNonNegativeInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return undefined;
  }

  return Number(numeric);
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

const resolveReprocessingStatusFromVerdict = (
  verdict: CombinedQualityDecision["verdict"]
): { status: "resolved" | "rejected"; resolutionType: string } => {
  if (verdict === "pass" || verdict === "repair") {
    return {
      status: "resolved",
      resolutionType: "fixed",
    };
  }

  return {
    status: "rejected",
    resolutionType: "auto_recovery_exhausted",
  };
};

const getAutoRejectedCount = (issueDetail: Prisma.JsonValue): number => {
  const detailRecord = asRecord(issueDetail);
  return asNonNegativeInteger(detailRecord?.autoRejectedCount) || 0;
};

const resolveIssueTypeDispatchPolicy = ({
  issueType,
  autoCreatePendingOnReject,
  maxAutoRejectedCount,
  issueTypePolicies,
}: {
  issueType: string;
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number | null;
  issueTypePolicies: Record<string, IssueTypeDispatchPolicy>;
}): { autoCreatePendingOnReject: boolean; maxAutoRejectedCount: number | null } => {
  const normalizedIssueType = issueType.trim().toUpperCase();
  const issuePolicy = issueTypePolicies[normalizedIssueType];

  if (!issuePolicy) {
    return {
      autoCreatePendingOnReject,
      maxAutoRejectedCount,
    };
  }

  return {
    autoCreatePendingOnReject:
      issuePolicy.autoCreatePendingOnReject ?? autoCreatePendingOnReject,
    maxAutoRejectedCount: issuePolicy.maxAutoRejectedCount ?? maxAutoRejectedCount,
  };
};

export const syncReprocessingManualReviewItems = async ({
  tx,
  bookId,
  sentenceId,
  audioFileId,
  attemptId,
  qualityResultId,
  decision,
  taskId,
  manualReviewItemId,
  candidateReviewItemIds,
  autoCreatePendingOnReject,
  maxAutoRejectedCount,
  issueTypePolicies,
  source,
}: {
  tx: Prisma.TransactionClient;
  bookId: string;
  sentenceId: string | null;
  audioFileId: string;
  attemptId?: string;
  qualityResultId: string;
  decision: CombinedQualityDecision;
  taskId: string;
  manualReviewItemId?: string;
  candidateReviewItemIds?: string[];
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number | null;
  issueTypePolicies: Record<string, IssueTypeDispatchPolicy>;
  source?: string | null;
}): Promise<ReprocessingSyncResult> => {
  const where: Prisma.ManualReviewItemWhereInput = {
    bookId,
    status: "reprocessing",
  };

  if (manualReviewItemId) {
    where.id = manualReviewItemId;
  } else if (candidateReviewItemIds && candidateReviewItemIds.length > 0) {
    where.id = {
      in: candidateReviewItemIds,
    };
    if (sentenceId) {
      where.sentenceId = sentenceId;
    }
  } else if (sentenceId) {
    where.sentenceId = sentenceId;
  } else {
    return {
      syncedCount: 0,
      secondaryPendingCount: 0,
      secondarySkippedByThresholdCount: 0,
    };
  }

  const reprocessingItems = await tx.manualReviewItem.findMany({
    where,
    select: {
      id: true,
      chapterId: true,
      segmentId: true,
      sentenceId: true,
      audioFileId: true,
      issueType: true,
      priority: true,
      assignedTo: true,
      issueDetail: true,
      resolutionNote: true,
    },
  });

  if (reprocessingItems.length === 0) {
    return {
      syncedCount: 0,
      secondaryPendingCount: 0,
      secondarySkippedByThresholdCount: 0,
    };
  }

  const resolution = resolveReprocessingStatusFromVerdict(decision.verdict);
  const marker = `auto_qc:${decision.verdict};score=${decision.score};task=${taskId};qc=${qualityResultId}`;
  const dispatchSource = source || "unknown";
  let secondarySkippedByThresholdCount = 0;
  const secondaryDispatchCandidates: Array<{
    item: (typeof reprocessingItems)[number];
    nextAutoRejectedCount: number;
    maxAutoRejectedCount: number | null;
  }> = [];

  for (const item of reprocessingItems) {
    const currentAutoRejectedCount = getAutoRejectedCount(item.issueDetail);
    const nextAutoRejectedCount =
      resolution.status === "rejected"
        ? currentAutoRejectedCount + 1
        : currentAutoRejectedCount;
    const dispatchPolicy = resolveIssueTypeDispatchPolicy({
      issueType: item.issueType,
      autoCreatePendingOnReject,
      maxAutoRejectedCount,
      issueTypePolicies,
    });
    const isThresholdExceeded =
      resolution.status === "rejected" &&
      dispatchPolicy.autoCreatePendingOnReject &&
      dispatchPolicy.maxAutoRejectedCount !== null &&
      nextAutoRejectedCount >= dispatchPolicy.maxAutoRejectedCount;

    if (isThresholdExceeded) {
      secondarySkippedByThresholdCount += 1;
    }

    const issueDetailPayload: Record<string, Prisma.InputJsonValue> = {
      ...((asRecord(item.issueDetail) || {}) as Record<string, Prisma.InputJsonValue>),
      reasons: decision.reasons as Prisma.InputJsonValue,
      repairPlan: decision.repairPlan as Prisma.InputJsonValue,
      score: decision.score,
      verdict: decision.verdict,
      issueType: decision.issueType,
      primarySignal: decision.primarySignal || "q0_precheck",
      signalSources: (decision.signalSources || {}) as Prisma.InputJsonValue,
      signalValues: (decision.signalValues || {}) as Prisma.InputJsonValue,
      syncedByTaskId: taskId,
      source: dispatchSource,
      autoRejectedCount: nextAutoRejectedCount,
    };

    if (dispatchPolicy.maxAutoRejectedCount !== null) {
      issueDetailPayload.maxAutoRejectedCount = dispatchPolicy.maxAutoRejectedCount;
    }

    if (isThresholdExceeded) {
      issueDetailPayload.secondaryDispatch = "threshold_blocked";
    }

    await tx.manualReviewItem.update({
      where: { id: item.id },
      data: {
        status: resolution.status,
        resolutionType: resolution.resolutionType,
        resolutionNote: appendResolutionNote(item.resolutionNote, marker),
        resolvedAt: new Date(),
        qcResultId: qualityResultId,
        audioFileId,
        attemptId: attemptId || null,
        issueDetail: issueDetailPayload as Prisma.InputJsonValue,
      },
    });

    const shouldCreateSecondaryPending =
      resolution.status === "rejected" &&
      dispatchPolicy.autoCreatePendingOnReject &&
      !isThresholdExceeded;

    if (shouldCreateSecondaryPending) {
      secondaryDispatchCandidates.push({
        item,
        nextAutoRejectedCount,
        maxAutoRejectedCount: dispatchPolicy.maxAutoRejectedCount,
      });
    }
  }

  let secondaryPendingCount = 0;
  if (secondaryDispatchCandidates.length > 0) {
    for (const candidate of secondaryDispatchCandidates) {
      const item = candidate.item;
      const duplicateWhere: Prisma.ManualReviewItemWhereInput = {
        bookId,
        issueType: item.issueType,
        status: "pending",
        ...(item.sentenceId
          ? {
              sentenceId: item.sentenceId,
            }
          : item.audioFileId
            ? {
                audioFileId: item.audioFileId,
              }
            : {}),
      };

      const existingPending = await tx.manualReviewItem.findFirst({
        where: duplicateWhere,
        select: {
          id: true,
        },
      });

      if (existingPending) {
        continue;
      }

      await tx.manualReviewItem.create({
        data: {
          bookId,
          chapterId: item.chapterId,
          segmentId: item.segmentId,
          sentenceId: item.sentenceId,
          audioFileId,
          attemptId: attemptId || null,
          qcResultId: qualityResultId,
          issueType: item.issueType,
          priority: item.priority,
          status: "pending",
          assignedTo: item.assignedTo,
          issueDetail: {
            reasons: decision.reasons,
            repairPlan: decision.repairPlan,
            score: decision.score,
            verdict: decision.verdict,
            issueType: decision.issueType,
            primarySignal: decision.primarySignal || "q0_precheck",
            signalSources: decision.signalSources || {},
            signalValues: decision.signalValues || {},
            source: dispatchSource,
            sourceReviewItemId: item.id,
            dispatch: "secondary_pending",
            dispatchedByTaskId: taskId,
            dispatchedFromQcResultId: qualityResultId,
            autoRejectedCount: candidate.nextAutoRejectedCount,
            ...(candidate.maxAutoRejectedCount !== null
              ? {
                  maxAutoRejectedCount: candidate.maxAutoRejectedCount,
                }
              : {}),
          } as Prisma.InputJsonValue,
        },
      });

      secondaryPendingCount += 1;
    }
  }

  return {
    syncedCount: reprocessingItems.length,
    secondaryPendingCount,
    secondarySkippedByThresholdCount,
  };
};

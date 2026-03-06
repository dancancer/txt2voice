// 一旦我被更新，请更新我的开头注释
// input: 任务参数/数据库依赖
// output: Fast+Deep Gate 质检执行结果
// pos: 任务执行器
import prisma, { Prisma } from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import { buildDeepGateCalibrationSnapshot } from "@/lib/quality-check/deep-gate-calibration";
import { inferDeepGateModelSignals } from "@/lib/quality-check/deep-gate-model-inference";
import { resolveDeepGateModelRuntime } from "@/lib/quality-check/deep-gate-model-runtime";
import {
  buildChapterGateContextMap,
  combineQualityGateDecision,
  evaluateDeepGate,
  isFalsePositiveCandidate,
  resolveDeepGateThresholdTemplate,
} from "@/lib/quality-gate";
import type {
  ChapterGateSample,
  CombinedQualityDecision,
  DeepGateCalibrationSample,
  FastGateSnapshot,
} from "@/lib/quality-gate";

export type QualityCheckTaskType = "book" | "chapter" | "batch";
export type FastGateVerdict = "pass" | "repair" | "manual_review" | "hard_fail";

export interface QualityCheckRunParams {
  taskId: string;
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}

interface FastGateInput {
  text: string;
  roleType?: string | null;
  durationSeconds: number;
  hasVoiceProfile: boolean;
}

type FastGateDecision = FastGateSnapshot;

interface QualityCheckTaskContext {
  source: string | null;
  manualReviewItemId: string;
  retryReviewItemIds: string[];
  autoCreatePendingOnReject: boolean;
  maxAutoRejectedCount: number | null;
  issueTypePolicies: Record<string, IssueTypeDispatchPolicy>;
  taskMetadata: Record<string, unknown>;
}

interface ReprocessingSyncResult {
  syncedCount: number;
  secondaryPendingCount: number;
  secondarySkippedByThresholdCount: number;
}

interface IssueTypeDispatchPolicy {
  autoCreatePendingOnReject?: boolean;
  maxAutoRejectedCount?: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
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

const parseIssueTypePolicies = (
  value: unknown
): Record<string, IssueTypeDispatchPolicy> => {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const issueTypePolicies: Record<string, IssueTypeDispatchPolicy> = {};
  for (const [rawIssueType, policyValue] of Object.entries(record)) {
    const issueType = rawIssueType.trim().toUpperCase();
    if (!issueType) {
      continue;
    }

    const policy = asRecord(policyValue);
    if (!policy) {
      continue;
    }

    const autoCreatePendingOnReject = asBoolean(policy.autoCreatePendingOnReject);
    const maxAutoRejectedCount = asNonNegativeInteger(policy.maxAutoRejectedCount);
    if (
      autoCreatePendingOnReject === undefined &&
      maxAutoRejectedCount === undefined
    ) {
      continue;
    }

    issueTypePolicies[issueType] = {
      ...(autoCreatePendingOnReject !== undefined
        ? {
            autoCreatePendingOnReject,
          }
        : {}),
      ...(maxAutoRejectedCount !== undefined
        ? {
            maxAutoRejectedCount,
          }
        : {}),
    };
  }

  return issueTypePolicies;
};

const DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT = 2;

const extractQualityCheckTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): QualityCheckTaskContext => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  const source = typeof metadata?.source === "string" ? metadata.source : null;
  const isQcRetrySource = source === "qc_retry";
  const isManualReviewBatchSource = source === "manual_review_batch";
  const manualReviewItemId =
    typeof metadata?.manualReviewItemId === "string"
      ? metadata.manualReviewItemId
      : "";
  const retryReviewItemIds = asStringArray(metadata?.retryReviewItemIds);

  const policySource = asRecord(metadata?.dispatchPolicy) || metadata;
  const autoCreatePendingOnReject =
    asBoolean(policySource?.autoCreatePendingOnReject) ?? isQcRetrySource;
  const maxAutoRejectedCount =
    asNonNegativeInteger(policySource?.maxAutoRejectedCount) ??
    (isQcRetrySource ? DEFAULT_QC_RETRY_MAX_AUTO_REJECTED_COUNT : null);
  const issueTypePolicies = parseIssueTypePolicies(policySource?.issueTypePolicies);

  return {
    source,
    manualReviewItemId: source === "manual_review" ? manualReviewItemId : "",
    retryReviewItemIds:
      isQcRetrySource || isManualReviewBatchSource ? retryReviewItemIds : [],
    autoCreatePendingOnReject,
    maxAutoRejectedCount,
    issueTypePolicies,
    taskMetadata: metadata || {},
  };
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

export const resolveReprocessingStatusFromVerdict = (
  verdict: FastGateVerdict
): { status: "resolved" | "rejected"; resolutionType: string } => {
  if (verdict === "pass" || verdict === "repair") {
    return {
      status: "resolved",
      resolutionType: "auto_resolved",
    };
  }

  return {
    status: "rejected",
    resolutionType: "auto_rejected",
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

const syncReprocessingManualReviewItems = async ({
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
      nextAutoRejectedCount > dispatchPolicy.maxAutoRejectedCount;

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

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

const buildRepairPlan = (reasons: string[]): string[] => {
  const plans: string[] = [];

  if (reasons.includes("duration_too_short") || reasons.includes("pace_too_fast")) {
    plans.push("decrease_speed_0.05");
  }

  if (reasons.includes("duration_too_long") || reasons.includes("pace_too_slow")) {
    plans.push("increase_speed_0.05");
  }

  if (reasons.includes("voice_profile_missing_for_dialogue")) {
    plans.push("bind_voice_profile_then_retry");
  }

  if (reasons.includes("invalid_duration")) {
    plans.push("regenerate_audio_with_same_params");
  }

  if (reasons.includes("emotion_underexpressed")) {
    plans.push("increase_emotion_intensity_0.10");
  }

  if (reasons.includes("emotion_overexpressed")) {
    plans.push("decrease_emotion_intensity_0.10");
  }

  if (reasons.includes("chapter_pace_drift") || reasons.includes("chapter_pace_drift_high")) {
    plans.push("align_chapter_pace_profile");
  }

  if (plans.length === 0) {
    plans.push("retry_with_same_engine");
  }

  return plans;
};

export const evaluateFastGate = ({
  text,
  roleType,
  durationSeconds,
  hasVoiceProfile,
}: FastGateInput): FastGateDecision => {
  const normalizedDuration = Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const textLength = text.trim().length;
  const charsPerSecond =
    normalizedDuration > 0 ? Number((textLength / normalizedDuration).toFixed(4)) : 0;

  const reasons: string[] = [];
  let q1Score = 92;
  let q2Score = 90;
  let q3Score = 90;
  let hardFail = false;

  if (normalizedDuration <= 0) {
    q1Score = 0;
    q2Score = 0;
    hardFail = true;
    reasons.push("invalid_duration");
  } else if (normalizedDuration < 0.25) {
    q1Score = 35;
    reasons.push("duration_too_short");
  } else if (normalizedDuration > 45) {
    q1Score = 65;
    reasons.push("duration_too_long");
  }

  if (charsPerSecond > 12) {
    q2Score = 30;
    hardFail = true;
    reasons.push("pace_too_fast_hard_fail");
  } else if (charsPerSecond > 8.5) {
    q2Score = 62;
    reasons.push("pace_too_fast");
  } else if (charsPerSecond < 1.1 && normalizedDuration > 0) {
    q2Score = 55;
    reasons.push("pace_too_slow");
  } else if (charsPerSecond < 1.5 && normalizedDuration > 0) {
    q2Score = 72;
    reasons.push("pace_slightly_slow");
  }

  const isDialogue = roleType === "dialogue" || roleType === "monologue";
  if (isDialogue && !hasVoiceProfile) {
    q3Score = 45;
    reasons.push("voice_profile_missing_for_dialogue");
  } else if (!hasVoiceProfile) {
    q3Score = 68;
    reasons.push("voice_profile_missing");
  }

  const score = clampScore(0.4 * q1Score + 0.35 * q2Score + 0.25 * q3Score);
  let verdict: FastGateVerdict = "pass";

  if (hardFail) {
    verdict = "hard_fail";
  } else if (score < 70) {
    verdict = "manual_review";
  } else if (score < 85) {
    verdict = "repair";
  }

  return {
    verdict,
    hardFail,
    score,
    q1Score,
    q2Score,
    q3Score,
    charsPerSecond,
    reasons,
    repairPlan: buildRepairPlan(reasons),
  };
};

const buildQualityWhere = ({
  bookId,
  type,
  chapterId,
  audioFileIds,
}: {
  bookId: string;
  type: QualityCheckTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}): Prisma.AudioFileWhereInput => {
  if (type === "batch" && (!audioFileIds || audioFileIds.length === 0)) {
    throw new Error("批量质检必须提供 audioFileIds");
  }

  return {
    bookId,
    status: "completed",
    ...(type === "chapter" && chapterId ? { chapterId } : {}),
    ...(type === "batch" && audioFileIds ? { id: { in: audioFileIds } } : {}),
  };
};

interface ChapterAuditAccumulator {
  chapterId: string;
  checked: number;
  passCount: number;
  repairCount: number;
  manualReviewCount: number;
  hardFailCount: number;
  issueTypeCounts: Record<string, number>;
  scoreSum: number;
  q4ScoreSum: number;
  q5ScoreSum: number;
  charsPerSecondValues: number[];
  voiceProfileBuckets: Record<string, number[]>;
}

const updateIssueTypeCount = (
  bucket: Record<string, number>,
  issueType: string
): void => {
  bucket[issueType] = (bucket[issueType] || 0) + 1;
};

const pushVoiceProfileStats = (
  bucket: Record<string, number[]>,
  voiceProfileId: string | null,
  charsPerSecond: number
): void => {
  if (!voiceProfileId) {
    return;
  }

  const normalizedId = voiceProfileId.trim();
  if (!normalizedId) {
    return;
  }

  if (!bucket[normalizedId]) {
    bucket[normalizedId] = [];
  }
  bucket[normalizedId].push(charsPerSecond);
};

const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)
  );
};

const standardDeviation = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const mean = average(values);
  if (mean === null) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(4));
};

const toChapterAuditVerdict = ({
  overallScore,
  averageQ5Score,
  hardFailCount,
  template,
}: {
  overallScore: number;
  averageQ5Score: number;
  hardFailCount: number;
  template: ReturnType<typeof resolveDeepGateThresholdTemplate>["template"];
}): FastGateVerdict => {
  if (
    hardFailCount > 0 ||
    overallScore < template.chapterRepairScore ||
    averageQ5Score < template.q5ManualReviewScore
  ) {
    return "manual_review";
  }

  if (
    overallScore < template.chapterPassScore ||
    averageQ5Score < template.q5PassScore
  ) {
    return "repair";
  }

  return "pass";
};

export async function runQualityCheckTask({
  taskId,
  bookId,
  type,
  chapterId,
  audioFileIds,
}: QualityCheckRunParams): Promise<void> {
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      taskData: true,
    },
  });
  const taskContext = extractQualityCheckTaskContext(taskSnapshot?.taskData);

  await updateTaskProgress(taskId, 10, "准备执行 Fast/Deep Gate 质检");

  const where = buildQualityWhere({
    bookId,
    type,
    chapterId,
    audioFileIds,
  });

  const [book, audioFiles] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: { metadata: true },
    }),
    prisma.audioFile.findMany({
      where,
      select: {
        id: true,
        bookId: true,
        chapterId: true,
        segmentId: true,
        sentenceId: true,
        voiceProfileId: true,
        duration: true,
        scriptSentence: {
          select: {
            id: true,
            text: true,
            roleType: true,
            emotionLabel: true,
            emotionIntensity: true,
          },
        },
        synthesisAttempts: {
          select: {
            id: true,
          },
          orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  if (audioFiles.length === 0) {
    throw new Error("没有可执行质检的音频");
  }

  const thresholdResolution = resolveDeepGateThresholdTemplate({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  const modelRuntimeResolution = resolveDeepGateModelRuntime({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  const chapterContextMap = buildChapterGateContextMap(
    audioFiles
      .map((audioFile) => {
        if (!audioFile.chapterId || !audioFile.scriptSentence) {
          return null;
        }

        const durationSeconds = Number(audioFile.duration || 0);
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          return null;
        }

        const charsPerSecond = Number(
          (
            audioFile.scriptSentence.text.trim().length / Math.max(durationSeconds, 0.0001)
          ).toFixed(4)
        );

        return {
          chapterId: audioFile.chapterId,
          roleType: audioFile.scriptSentence.roleType || "narration",
          voiceProfileId: audioFile.voiceProfileId || "",
          charsPerSecond,
        } satisfies ChapterGateSample;
      })
      .filter((item): item is ChapterGateSample => Boolean(item))
  );

  await updateTaskProgress(taskId, 20, "开始逐句执行 Fast/Deep Gate 质检");

  let checked = 0;
  let passCount = 0;
  let repairCount = 0;
  let manualReviewCount = 0;
  let hardFailCount = 0;
  let secondaryDispatchCount = 0;
  let secondaryDispatchSkippedByThresholdCount = 0;
  let deepGateOverrideCount = 0;
  let falsePositiveCandidateCount = 0;
  let emotionModelUsedCount = 0;
  let continuityModelUsedCount = 0;
  let deepGateModelFallbackCount = 0;
  const issueTypeCounts: Record<string, number> = {};
  const deepGateCalibrationSamples: DeepGateCalibrationSample[] = [];
  const chapterAuditMap = new Map<string, ChapterAuditAccumulator>();
  const candidateReviewItemIds =
    taskContext.retryReviewItemIds.length > 0
      ? taskContext.retryReviewItemIds
      : undefined;

  for (let index = 0; index < audioFiles.length; index += 1) {
    const audioFile = audioFiles[index];
    if (!audioFile.scriptSentence || !audioFile.sentenceId) {
      continue;
    }

    const durationSeconds = Number(audioFile.duration || 0);
    const fastDecision = evaluateFastGate({
      text: audioFile.scriptSentence.text,
      roleType: audioFile.scriptSentence.roleType,
      durationSeconds,
      hasVoiceProfile: Boolean(audioFile.voiceProfileId),
    });
    const deepInput = {
      text: audioFile.scriptSentence.text,
      roleType: audioFile.scriptSentence.roleType,
      emotionLabel: audioFile.scriptSentence.emotionLabel,
      emotionIntensity:
        audioFile.scriptSentence.emotionIntensity !== null &&
        audioFile.scriptSentence.emotionIntensity !== undefined
          ? Number(audioFile.scriptSentence.emotionIntensity)
          : null,
      charsPerSecond: fastDecision.charsPerSecond,
      chapterContext: audioFile.chapterId
        ? chapterContextMap.get(audioFile.chapterId)
        : undefined,
      voiceProfileId: audioFile.voiceProfileId,
    };
    const deepModelInference = await inferDeepGateModelSignals({
      runtime: modelRuntimeResolution.runtime,
      input: deepInput,
    });
    const deepDecision = evaluateDeepGate({
      input: deepInput,
      thresholds: thresholdResolution.template,
      modelInference: deepModelInference,
    });
    const decision = combineQualityGateDecision({
      fast: fastDecision,
      deep: deepDecision,
    });

    if (deepDecision.q4Source === "emotion_model") {
      emotionModelUsedCount += 1;
    }
    if (deepDecision.q5Source === "continuity_model") {
      continuityModelUsedCount += 1;
    }
    if (
      (modelRuntimeResolution.runtime.useEmotionModel &&
        deepDecision.q4Source === "heuristic") ||
      (modelRuntimeResolution.runtime.useContinuityModel &&
        deepDecision.q5Source === "heuristic")
    ) {
      deepGateModelFallbackCount += 1;
    }

    if (
      fastDecision.verdict === "pass" &&
      (deepDecision.verdict === "manual_review" || deepDecision.verdict === "hard_fail") &&
      (decision.verdict === "manual_review" || decision.verdict === "hard_fail")
    ) {
      deepGateOverrideCount += 1;
    }
    if (
      isFalsePositiveCandidate({
        fast: fastDecision,
        deep: deepDecision,
        combined: decision,
        thresholds: thresholdResolution.template,
      })
    ) {
      falsePositiveCandidateCount += 1;
    }

    await prisma.$transaction(async (tx) => {
      const qualityResult = await tx.qualityCheckResult.create({
        data: {
          bookId: audioFile.bookId,
          chapterId: audioFile.chapterId,
          segmentId: audioFile.segmentId,
          sentenceId: audioFile.sentenceId,
          audioFileId: audioFile.id,
          attemptId: audioFile.synthesisAttempts[0]?.id,
          gate: "FAST_DEEP_GATE",
          stage: "Q1_Q5",
          verdict: decision.verdict,
          score: new Prisma.Decimal(decision.score.toFixed(2)),
          hardFail: decision.hardFail,
          thresholdKey: "fast_deep_gate_v2",
          metrics: {
            q1Score: decision.q1Score,
            q2Score: decision.q2Score,
            q3Score: decision.q3Score,
            q4Score: decision.q4Score,
            q5Score: decision.q5Score,
            fastGateScore: decision.fastGateScore,
            deepGateScore: decision.deepGateScore,
            charsPerSecond: decision.charsPerSecond,
            durationSeconds,
          } as Prisma.InputJsonValue,
          reasons: decision.reasons as Prisma.InputJsonValue,
          detail: toInputJsonValue({
            repairPlan: decision.repairPlan,
            issueType: decision.issueType,
            thresholdTemplate: thresholdResolution.template,
            thresholdTemplateSource: thresholdResolution.source,
            fastGate: {
              verdict: fastDecision.verdict,
              score: fastDecision.score,
              hardFail: fastDecision.hardFail,
            },
            deepGate: {
              verdict: deepDecision.verdict,
              score: deepDecision.score,
              issueType: deepDecision.issueType,
              q4Source: deepDecision.q4Source,
              q5Source: deepDecision.q5Source,
              modelDiagnostics: deepDecision.modelDiagnostics,
              modelRuntimeSource: modelRuntimeResolution.source,
            },
          }),
        },
      });

      await tx.audioFile.update({
        where: { id: audioFile.id },
        data: {
          qualityScore: new Prisma.Decimal(decision.score.toFixed(2)),
          qualityVerdict: decision.verdict,
          qualityStatus: decision.verdict,
        },
      });

      const reprocessingSync = await syncReprocessingManualReviewItems({
        tx,
        bookId,
        sentenceId: audioFile.sentenceId,
        audioFileId: audioFile.id,
        attemptId: audioFile.synthesisAttempts[0]?.id,
        qualityResultId: qualityResult.id,
        decision,
        taskId,
        manualReviewItemId: taskContext.manualReviewItemId || undefined,
        candidateReviewItemIds,
        autoCreatePendingOnReject: taskContext.autoCreatePendingOnReject,
        maxAutoRejectedCount: taskContext.maxAutoRejectedCount,
        issueTypePolicies: taskContext.issueTypePolicies,
        source: taskContext.source,
      });
      secondaryDispatchCount += reprocessingSync.secondaryPendingCount;
      secondaryDispatchSkippedByThresholdCount +=
        reprocessingSync.secondarySkippedByThresholdCount;

      if (
        reprocessingSync.syncedCount === 0 &&
        (decision.verdict === "manual_review" || decision.verdict === "hard_fail")
      ) {
        const existingReview = await tx.manualReviewItem.findFirst({
          where: {
            bookId,
            audioFileId: audioFile.id,
            issueType: decision.issueType,
            status: "pending",
          },
          select: { id: true },
        });

        if (!existingReview) {
          await tx.manualReviewItem.create({
            data: {
              bookId,
              chapterId: audioFile.chapterId,
              segmentId: audioFile.segmentId,
              sentenceId: audioFile.sentenceId,
              audioFileId: audioFile.id,
              attemptId: audioFile.synthesisAttempts[0]?.id,
              issueType: decision.issueType,
              priority: decision.verdict === "hard_fail" ? "high" : "normal",
              status: "pending",
              issueDetail: {
                reasons: decision.reasons,
                repairPlan: decision.repairPlan,
                score: decision.score,
                issueType: decision.issueType,
                source: taskContext.source || "unknown",
              } as Prisma.InputJsonValue,
            },
          });
        }
      }
    });

    checked += 1;
    if (decision.verdict === "pass") {
      passCount += 1;
    } else if (decision.verdict === "repair") {
      repairCount += 1;
    } else if (decision.verdict === "hard_fail") {
      hardFailCount += 1;
      manualReviewCount += 1;
    } else {
      manualReviewCount += 1;
    }
    updateIssueTypeCount(issueTypeCounts, decision.issueType);
    deepGateCalibrationSamples.push({
      verdict: decision.verdict,
      q4Score: decision.q4Score,
      q5Score: decision.q5Score,
    });

    if (audioFile.chapterId) {
      const chapterAudit = chapterAuditMap.get(audioFile.chapterId) || {
        chapterId: audioFile.chapterId,
        checked: 0,
        passCount: 0,
        repairCount: 0,
        manualReviewCount: 0,
        hardFailCount: 0,
        issueTypeCounts: {},
        scoreSum: 0,
        q4ScoreSum: 0,
        q5ScoreSum: 0,
        charsPerSecondValues: [],
        voiceProfileBuckets: {},
      };

      chapterAudit.checked += 1;
      chapterAudit.scoreSum += decision.score;
      chapterAudit.q4ScoreSum += decision.q4Score;
      chapterAudit.q5ScoreSum += decision.q5Score;
      chapterAudit.charsPerSecondValues.push(decision.charsPerSecond);
      pushVoiceProfileStats(
        chapterAudit.voiceProfileBuckets,
        audioFile.voiceProfileId,
        decision.charsPerSecond
      );
      updateIssueTypeCount(chapterAudit.issueTypeCounts, decision.issueType);

      if (decision.verdict === "pass") {
        chapterAudit.passCount += 1;
      } else if (decision.verdict === "repair") {
        chapterAudit.repairCount += 1;
      } else if (decision.verdict === "hard_fail") {
        chapterAudit.hardFailCount += 1;
        chapterAudit.manualReviewCount += 1;
      } else {
        chapterAudit.manualReviewCount += 1;
      }

      chapterAuditMap.set(audioFile.chapterId, chapterAudit);
    }

    const progress = 20 + Math.round(((index + 1) / audioFiles.length) * 70);
    await updateTaskProgress(
      taskId,
      progress,
      `Fast/Deep Gate 质检进度 ${index + 1}/${audioFiles.length}`
    );
  }

  if (checked === 0) {
    throw new Error("没有可执行质检的句子数据");
  }

  const deepGateCalibration = buildDeepGateCalibrationSnapshot({
    samples: deepGateCalibrationSamples,
    template: thresholdResolution.template,
  });

  await updateTaskProgress(taskId, 92, "写入章节一致性审计");

  let chapterAuditCount = 0;
  let chapterAuditManualReviewCount = 0;
  let chapterAuditRepairCount = 0;

  for (const chapterAudit of chapterAuditMap.values()) {
    if (chapterAudit.checked <= 0) {
      continue;
    }

    const overallScore = clampScore(chapterAudit.scoreSum / chapterAudit.checked);
    const averageQ4Score = clampScore(chapterAudit.q4ScoreSum / chapterAudit.checked);
    const averageQ5Score = clampScore(chapterAudit.q5ScoreSum / chapterAudit.checked);
    const paceMean = average(chapterAudit.charsPerSecondValues);
    const paceStdDev = standardDeviation(chapterAudit.charsPerSecondValues);

    const speakerDrift: Record<string, Prisma.InputJsonValue> = {};
    for (const [voiceProfileId, values] of Object.entries(
      chapterAudit.voiceProfileBuckets
    )) {
      speakerDrift[voiceProfileId] = {
        sampleCount: values.length,
        averageCharsPerSecond: average(values),
        stdDevCharsPerSecond: standardDeviation(values),
      } as Prisma.InputJsonValue;
    }

    const verdict = toChapterAuditVerdict({
      overallScore,
      averageQ5Score,
      hardFailCount: chapterAudit.hardFailCount,
      template: thresholdResolution.template,
    });

    const actions: string[] = [];
    if (averageQ4Score < thresholdResolution.template.q4PassScore) {
      actions.push("review_emotion_template");
    }
    if (averageQ5Score < thresholdResolution.template.q5PassScore) {
      actions.push("review_chapter_continuity");
    }
    if (chapterAudit.manualReviewCount > 0) {
      actions.push("prioritize_manual_review_queue");
    }
    if (actions.length === 0) {
      actions.push("no_action_required");
    }

    await prisma.chapterQualityAudit.create({
      data: {
        bookId,
        chapterId: chapterAudit.chapterId,
        auditBatchId: taskId,
        verdict,
        overallScore: new Prisma.Decimal(overallScore.toFixed(2)),
        targetLufs: new Prisma.Decimal("-19.00"),
        actualLufs: null,
        peakDbtp: null,
        continuityMetric: {
          checked: chapterAudit.checked,
          averageQ4Score,
          averageQ5Score,
          averageCharsPerSecond: paceMean,
          stdDevCharsPerSecond: paceStdDev,
          issueTypeCounts: chapterAudit.issueTypeCounts,
        } as Prisma.InputJsonValue,
        speakerDrift: speakerDrift as Prisma.InputJsonValue,
        actions: actions as Prisma.InputJsonValue,
      },
    });

    chapterAuditCount += 1;
    if (verdict === "manual_review") {
      chapterAuditManualReviewCount += 1;
    } else if (verdict === "repair") {
      chapterAuditRepairCount += 1;
    }
  }

  const summary = {
    type,
    chapterId: chapterId || null,
    requestedAudioFiles: audioFileIds || [],
    checked,
    passCount,
    repairCount,
    manualReviewCount,
    hardFailCount,
    secondaryDispatchCount,
    secondaryDispatchSkippedByThresholdCount,
    issueTypeCounts,
    deepGateOverrideCount,
    falsePositiveCandidateCount,
    thresholdTemplate: thresholdResolution.template,
    thresholdTemplateSource: thresholdResolution.source,
    deepGateModelRuntime: {
      source: modelRuntimeResolution.source,
      useEmotionModel: modelRuntimeResolution.runtime.useEmotionModel,
      useContinuityModel: modelRuntimeResolution.runtime.useContinuityModel,
      emotionModelUsedCount,
      continuityModelUsedCount,
      fallbackCount: deepGateModelFallbackCount,
    },
    deepGateCalibration,
    chapterAuditCount,
    chapterAuditRepairCount,
    chapterAuditManualReviewCount,
    source: taskContext.source,
  };

  const message = `质检完成：通过 ${passCount}，返工 ${repairCount}，人工复核 ${manualReviewCount}，章节审计 ${chapterAuditCount}`;
  const taskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      ...summary,
      stage: "completed",
      completedAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: checked,
      completedAt: new Date(),
      taskData,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...jsonObject(book?.metadata),
        qualityCheck: {
          ...summary,
          checkedAt: new Date().toISOString(),
          chapterAudits: {
            batchId: taskId,
            total: chapterAuditCount,
            repairCount: chapterAuditRepairCount,
            manualReviewCount: chapterAuditManualReviewCount,
          },
          falsePositiveSignals: {
            deepGateOverrideCount,
            candidateCount: falsePositiveCandidateCount,
          },
        },
      }),
    },
  });
}

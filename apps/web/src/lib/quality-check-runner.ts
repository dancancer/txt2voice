// 一旦我被更新，请更新我的开头注释
// input: 任务参数/数据库依赖
// output: Fast Gate 质检执行结果
// pos: 任务执行器
import prisma, { Prisma } from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

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

interface FastGateDecision {
  verdict: FastGateVerdict;
  hardFail: boolean;
  score: number;
  q1Score: number;
  q2Score: number;
  q3Score: number;
  charsPerSecond: number;
  reasons: string[];
  repairPlan: string[];
}

interface ManualReviewTaskContext {
  manualReviewItemId: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const extractManualReviewTaskContext = (
  taskData: Prisma.JsonValue | null | undefined
): ManualReviewTaskContext | null => {
  const taskDataRecord = asRecord(taskData);
  const metadata = asRecord(taskDataRecord?.metadata);

  if (!metadata || metadata.source !== "manual_review") {
    return null;
  }

  const manualReviewItemId =
    typeof metadata.manualReviewItemId === "string"
      ? metadata.manualReviewItemId
      : null;

  if (!manualReviewItemId) {
    return null;
  }

  return {
    manualReviewItemId,
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
}: {
  tx: Prisma.TransactionClient;
  bookId: string;
  sentenceId: string | null;
  audioFileId: string;
  attemptId?: string;
  qualityResultId: string;
  decision: FastGateDecision;
  taskId: string;
  manualReviewItemId?: string;
}): Promise<number> => {
  const where: Prisma.ManualReviewItemWhereInput = {
    bookId,
    status: "reprocessing",
  };

  if (manualReviewItemId) {
    where.id = manualReviewItemId;
  } else if (sentenceId) {
    where.sentenceId = sentenceId;
    where.issueType = "FAST_GATE";
  } else {
    return 0;
  }

  const reprocessingItems = await tx.manualReviewItem.findMany({
    where,
    select: {
      id: true,
      resolutionNote: true,
    },
  });

  if (reprocessingItems.length === 0) {
    return 0;
  }

  const resolution = resolveReprocessingStatusFromVerdict(decision.verdict);
  const marker = `auto_qc:${decision.verdict};score=${decision.score};task=${taskId};qc=${qualityResultId}`;

  for (const item of reprocessingItems) {
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
        issueDetail: {
          reasons: decision.reasons,
          repairPlan: decision.repairPlan,
          score: decision.score,
          verdict: decision.verdict,
          syncedByTaskId: taskId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return reprocessingItems.length;
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
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
  const manualReviewContext = extractManualReviewTaskContext(taskSnapshot?.taskData);

  await updateTaskProgress(taskId, 10, "准备执行 Fast Gate 质检");

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

  await updateTaskProgress(taskId, 20, "开始逐句质检");

  let checked = 0;
  let passCount = 0;
  let repairCount = 0;
  let manualReviewCount = 0;
  let hardFailCount = 0;

  for (let index = 0; index < audioFiles.length; index += 1) {
    const audioFile = audioFiles[index];
    if (!audioFile.scriptSentence || !audioFile.sentenceId) {
      continue;
    }

    const decision = evaluateFastGate({
      text: audioFile.scriptSentence.text,
      roleType: audioFile.scriptSentence.roleType,
      durationSeconds: Number(audioFile.duration || 0),
      hasVoiceProfile: Boolean(audioFile.voiceProfileId),
    });

    await prisma.$transaction(async (tx) => {
      const qualityResult = await tx.qualityCheckResult.create({
        data: {
          bookId: audioFile.bookId,
          chapterId: audioFile.chapterId,
          segmentId: audioFile.segmentId,
          sentenceId: audioFile.sentenceId,
          audioFileId: audioFile.id,
          attemptId: audioFile.synthesisAttempts[0]?.id,
          gate: "FAST_GATE",
          stage: "Q1_Q3",
          verdict: decision.verdict,
          score: new Prisma.Decimal(decision.score.toFixed(2)),
          hardFail: decision.hardFail,
          thresholdKey: "fast_gate_default_v1",
          metrics: {
            q1Score: decision.q1Score,
            q2Score: decision.q2Score,
            q3Score: decision.q3Score,
            charsPerSecond: decision.charsPerSecond,
            durationSeconds: Number(audioFile.duration || 0),
          } as Prisma.InputJsonValue,
          reasons: decision.reasons as Prisma.InputJsonValue,
          detail: {
            repairPlan: decision.repairPlan,
          } as Prisma.InputJsonValue,
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

      const syncedReprocessingCount = await syncReprocessingManualReviewItems({
        tx,
        bookId,
        sentenceId: audioFile.sentenceId,
        audioFileId: audioFile.id,
        attemptId: audioFile.synthesisAttempts[0]?.id,
        qualityResultId: qualityResult.id,
        decision,
        taskId,
        manualReviewItemId: manualReviewContext?.manualReviewItemId,
      });

      if (
        syncedReprocessingCount === 0 &&
        (decision.verdict === "manual_review" || decision.verdict === "hard_fail")
      ) {
        const existingReview = await tx.manualReviewItem.findFirst({
          where: {
            bookId,
            audioFileId: audioFile.id,
            issueType: "FAST_GATE",
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
              issueType: "FAST_GATE",
              priority: decision.verdict === "hard_fail" ? "high" : "normal",
              status: "pending",
              issueDetail: {
                reasons: decision.reasons,
                repairPlan: decision.repairPlan,
                score: decision.score,
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

    const progress = 20 + Math.round(((index + 1) / audioFiles.length) * 70);
    await updateTaskProgress(taskId, progress, `Fast Gate 质检进度 ${index + 1}/${audioFiles.length}`);
  }

  if (checked === 0) {
    throw new Error("没有可执行质检的句子数据");
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
  };

  const message = `质检完成：通过 ${passCount}，返工 ${repairCount}，人工复核 ${manualReviewCount}`;
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
      metadata: {
        ...jsonObject(book?.metadata),
        qualityCheck: {
          ...summary,
          checkedAt: new Date().toISOString(),
        },
      },
    },
  });
}

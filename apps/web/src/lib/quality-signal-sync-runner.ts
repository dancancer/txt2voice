// 一旦我被更新，请更新我的开头注释
// input: 任务参数/数据库依赖
// output: Q0-Q3 信号生产任务结果
// pos: 信号生产执行器
import prisma, { Prisma } from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";

export type QualitySignalSyncTaskType = "book" | "chapter" | "batch";

export interface QualitySignalSyncRunParams {
  taskId: string;
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  forceResync?: boolean;
}

type SignalValueSource = "task_payload" | "heuristic" | "existing";

interface SyncSignalResult {
  value: number | null;
  source: SignalValueSource;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
};

const buildWhere = ({
  bookId,
  type,
  chapterId,
  audioFileIds,
}: {
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
}): Prisma.AudioFileWhereInput => ({
  bookId,
  status: "completed",
  ...(type === "chapter" && chapterId ? { chapterId } : {}),
  ...(type === "batch" && audioFileIds?.length ? { id: { in: audioFileIds } } : {}),
});

const readSignalPayload = ({
  metadata,
  audioFileId,
  sentenceId,
}: {
  metadata: Record<string, unknown> | null;
  audioFileId: string;
  sentenceId: string | null;
}): Record<string, unknown> => {
  const byAudio = asRecord(metadata?.signalPayloadByAudioFileId || metadata?.signalPayload);
  const audioPayload = asRecord(byAudio?.[audioFileId]);
  if (audioPayload) {
    return audioPayload;
  }

  if (sentenceId) {
    const bySentence = asRecord(metadata?.signalPayloadBySentenceId || byAudio?.bySentenceId);
    const sentencePayload = asRecord(bySentence?.[sentenceId]);
    if (sentencePayload) {
      return sentencePayload;
    }
  }

  return {};
};

const estimateCer = ({
  text,
  durationSeconds,
  roleType,
}: {
  text: string;
  durationSeconds: number;
  roleType: string | null | undefined;
}): number => {
  const normalizedText = text.trim();
  const charsPerSecond = normalizedText.length / Math.max(durationSeconds, 0.0001);
  const digitPenalty = (normalizedText.match(/\d/g) || []).length * 0.0025;
  const foreignPenalty = (normalizedText.match(/[A-Za-z]/g) || []).length * 0.0008;
  const quotePenalty = (normalizedText.match(/[“”"']/g) || []).length * 0.001;
  const roleBase = (roleType || "narration") === "dialogue" ? 0.052 : 0.034;
  const pacePenalty = Math.max(charsPerSecond - 4.8, 0) * 0.008;

  return clampUnit(roleBase + digitPenalty + foreignPenalty + quotePenalty + pacePenalty);
};

const estimateSpeakerSimilarity = ({
  hasVoiceProfile,
  roleType,
  priority,
}: {
  hasVoiceProfile: boolean;
  roleType: string | null | undefined;
  priority: string | null | undefined;
}): number => {
  const normalizedRole = (roleType || "narration").trim().toLowerCase();
  const normalizedPriority = (priority || "normal").trim().toLowerCase();
  const base = hasVoiceProfile ? 0.86 : 0.69;
  const roleDelta = normalizedRole === "dialogue" ? -0.03 : 0.01;
  const priorityDelta = normalizedPriority === "high" ? 0.015 : 0;
  return clampUnit(base + roleDelta + priorityDelta);
};

const resolveSignal = ({
  currentValue,
  payloadValue,
  fallbackValue,
  forceResync,
}: {
  currentValue: number | null;
  payloadValue: number | null;
  fallbackValue: number;
  forceResync: boolean;
}): SyncSignalResult => {
  if (!forceResync && currentValue !== null) {
    return {
      value: currentValue,
      source: "existing",
    };
  }

  if (payloadValue !== null) {
    return {
      value: clampUnit(payloadValue),
      source: "task_payload",
    };
  }

  return {
    value: clampUnit(fallbackValue),
    source: "heuristic",
  };
};

const toJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
};

export async function runQualitySignalSyncTask({
  taskId,
  bookId,
  type,
  chapterId,
  audioFileIds,
  forceResync = false,
}: QualitySignalSyncRunParams): Promise<void> {
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: { taskData: true },
  });
  const taskRoot = jsonObject(taskSnapshot?.taskData);
  const taskMetadata = asRecord(taskRoot.metadata);

  await updateTaskProgress(taskId, 10, "准备执行 Q0-Q3 信号生产");

  const audioFiles = await prisma.audioFile.findMany({
    where: buildWhere({
      bookId,
      type,
      chapterId,
      audioFileIds,
    }),
    select: {
      id: true,
      sentenceId: true,
      voiceProfileId: true,
      duration: true,
      scriptSentence: {
        select: {
          text: true,
          roleType: true,
          priority: true,
        },
      },
      synthesisAttempts: {
        where: {
          status: "completed",
        },
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          metrics: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (audioFiles.length === 0) {
    throw new Error("没有可执行信号生产的音频");
  }

  let processed = 0;
  let updatedAttempts = 0;
  let missingAttemptCount = 0;
  let skippedExistingCount = 0;
  let cerUpdatedCount = 0;
  let speakerUpdatedCount = 0;
  const sourceBreakdown = {
    cer: {
      task_payload: 0,
      heuristic: 0,
      existing: 0,
    },
    speaker: {
      task_payload: 0,
      heuristic: 0,
      existing: 0,
    },
  };

  for (let index = 0; index < audioFiles.length; index += 1) {
    const audioFile = audioFiles[index];
    const attempt = audioFile.synthesisAttempts[0];
    if (!attempt || !audioFile.scriptSentence) {
      missingAttemptCount += 1;
      continue;
    }

    const metrics = asRecord(attempt.metrics) || {};
    const signalPayload = readSignalPayload({
      metadata: taskMetadata,
      audioFileId: audioFile.id,
      sentenceId: audioFile.sentenceId,
    });
    const cerResult = resolveSignal({
      currentValue: asNumber(metrics.cer ?? metrics.asrCer ?? metrics.q2Cer),
      payloadValue: asNumber(signalPayload.cer ?? signalPayload.asrCer ?? signalPayload.q2Cer),
      fallbackValue: estimateCer({
        text: audioFile.scriptSentence.text,
        durationSeconds: Number(audioFile.duration || 0),
        roleType: audioFile.scriptSentence.roleType,
      }),
      forceResync,
    });
    const speakerResult = resolveSignal({
      currentValue: asNumber(
        metrics.speakerSimilarity ??
          metrics.speakerEmbeddingSimilarity ??
          metrics.q3SpeakerSimilarity
      ),
      payloadValue: asNumber(
        signalPayload.speakerSimilarity ??
          signalPayload.speakerEmbeddingSimilarity ??
          signalPayload.q3SpeakerSimilarity
      ),
      fallbackValue: estimateSpeakerSimilarity({
        hasVoiceProfile: Boolean(audioFile.voiceProfileId),
        roleType: audioFile.scriptSentence.roleType,
        priority: audioFile.scriptSentence.priority,
      }),
      forceResync,
    });

    sourceBreakdown.cer[cerResult.source] += 1;
    sourceBreakdown.speaker[speakerResult.source] += 1;

    const noChange = cerResult.source === "existing" && speakerResult.source === "existing";
    if (noChange) {
      skippedExistingCount += 1;
    } else {
      await prisma.synthesisAttempt.update({
        where: { id: attempt.id },
        data: {
          metrics: toJson({
            ...metrics,
            cer: cerResult.value,
            asrCer: cerResult.value,
            q2Cer: cerResult.value,
            speakerSimilarity: speakerResult.value,
            speakerEmbeddingSimilarity: speakerResult.value,
            q3SpeakerSimilarity: speakerResult.value,
            signalSync: {
              version: "s30.1-v1",
              syncedAt: new Date().toISOString(),
              taskId,
              forceResync,
              cerSource: cerResult.source,
              speakerSource: speakerResult.source,
            },
          }),
        },
      });
      updatedAttempts += 1;
      if (cerResult.source !== "existing") {
        cerUpdatedCount += 1;
      }
      if (speakerResult.source !== "existing") {
        speakerUpdatedCount += 1;
      }
    }

    processed += 1;
    const progress = 10 + Math.round(((index + 1) / audioFiles.length) * 80);
    await updateTaskProgress(taskId, progress, `信号生产进度 ${index + 1}/${audioFiles.length}`);
  }

  const summary = {
    type,
    chapterId: chapterId || null,
    requestedAudioFiles: audioFileIds || [],
    forceResync,
    processed,
    updatedAttempts,
    missingAttemptCount,
    skippedExistingCount,
    cerUpdatedCount,
    speakerUpdatedCount,
    sourceBreakdown,
  };

  const taskData = await mergeTaskData(taskId, {
    message: `信号生产完成：更新 ${updatedAttempts} 条，跳过 ${skippedExistingCount} 条`,
    metadata: {
      ...summary,
      source: "quality_signal_sync",
      completedAt: new Date().toISOString(),
    },
  });

  await prisma.processingTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      progress: 100,
      processedItems: processed,
      completedAt: new Date(),
      taskData,
    },
  });

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { metadata: true },
  });
  const rootMetadata = jsonObject(book?.metadata);
  const qualityCheck = asRecord(rootMetadata.qualityCheck) || {};

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toJson({
        ...rootMetadata,
        qualityCheck: {
          ...qualityCheck,
          signalSupply: {
            ...summary,
            taskId,
            syncedAt: new Date().toISOString(),
          },
        },
      }),
    },
  });
}

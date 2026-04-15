// 一旦我被更新，请更新我的开头注释
// input: 任务参数/数据库依赖
// output: Q0-Q3 信号生产任务结果
// pos: 信号生产执行器
import prisma, { Prisma } from "@/lib/prisma";
import { inferQualitySignalProviders } from "@/lib/quality-check/signal-model-inference";
import { resolveQualitySignalModelRuntime } from "@/lib/quality-check/signal-model-runtime";
import {
  jsonObject,
  mergeTaskData,
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import {
  asNumber,
  asRecord,
  asString,
  buildWhere,
  estimateCer,
  estimateSpeakerSimilarity,
  readSignalPayload,
  resolveSignal,
  toJson,
  type QualitySignalSyncTaskType,
} from "@/lib/quality-signal-sync/helpers";

export type { QualitySignalSyncTaskType } from "@/lib/quality-signal-sync/helpers";

export interface QualitySignalSyncRunParams {
  taskId: string;
  bookId: string;
  type: QualitySignalSyncTaskType;
  chapterId?: string;
  audioFileIds?: string[];
  forceResync?: boolean;
}

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
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

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { metadata: true },
  });
  const modelRuntimeResolution = resolveQualitySignalModelRuntime({
    taskMetadata,
    bookMetadata: book?.metadata,
  });

  const audioFiles = await prisma.audioFile.findMany({
    where: buildWhere({
      bookId,
      type,
      chapterId,
      audioFileIds,
    }),
    select: {
      id: true,
      bookId: true,
      sentenceId: true,
      filePath: true,
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
  let asrModelUsedCount = 0;
  let speakerModelUsedCount = 0;
  let modelFallbackCount = 0;
  const sourceBreakdown = {
    cer: {
      task_payload: 0,
      provider: 0,
      heuristic: 0,
      existing: 0,
    },
    speaker: {
      task_payload: 0,
      provider: 0,
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
    const providerInference = await inferQualitySignalProviders({
      runtime: modelRuntimeResolution.runtime,
      input: {
        audioFileId: audioFile.id,
        sentenceId: audioFile.sentenceId,
        bookId: audioFile.bookId,
        filePath: audioFile.filePath,
        text: audioFile.scriptSentence.text,
        durationSeconds: Number(audioFile.duration || 0),
        roleType: audioFile.scriptSentence.roleType,
        priority: audioFile.scriptSentence.priority,
        voiceProfileId: audioFile.voiceProfileId,
      },
    });
    const cerResult = resolveSignal({
      currentValue: asNumber(metrics.cer ?? metrics.asrCer ?? metrics.q2Cer),
      payloadValue: asNumber(signalPayload.cer ?? signalPayload.asrCer ?? signalPayload.q2Cer),
      providerValue: providerInference.cer,
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
      providerValue: providerInference.speakerSimilarity,
      fallbackValue: estimateSpeakerSimilarity({
        hasVoiceProfile: Boolean(audioFile.voiceProfileId),
        roleType: audioFile.scriptSentence.roleType,
        priority: audioFile.scriptSentence.priority,
      }),
      forceResync,
    });
    if (cerResult.source === "provider") {
      asrModelUsedCount += 1;
    }
    if (speakerResult.source === "provider") {
      speakerModelUsedCount += 1;
    }
    if (
      (modelRuntimeResolution.runtime.useAsrModel && cerResult.source === "heuristic") ||
      (modelRuntimeResolution.runtime.useSpeakerModel && speakerResult.source === "heuristic")
    ) {
      modelFallbackCount += 1;
    }

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
              version: "s30.1-v2",
              syncedAt: new Date().toISOString(),
              taskId,
              forceResync,
              cerSource: cerResult.source,
              speakerSource: speakerResult.source,
              modelRuntimeSource: modelRuntimeResolution.source,
              modelDiagnostics: providerInference.diagnostics,
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
    signalModelRuntime: {
      source: modelRuntimeResolution.source,
      useAsrModel: modelRuntimeResolution.runtime.useAsrModel,
      useSpeakerModel: modelRuntimeResolution.runtime.useSpeakerModel,
      asrModelUsedCount,
      speakerModelUsedCount,
      fallbackCount: modelFallbackCount,
    },
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

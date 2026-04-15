// 一旦我被更新，请更新我的开头注释
// input: 任务参数/数据库依赖
// output: Fast+Deep Gate 质检执行结果
// pos: 任务执行器
import prisma from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";
import {
  updateProcessingTaskProgress as updateTaskProgress,
} from "@/lib/processing-task-utils";
import {
  extractQ0Q3RawSignals,
  resolveQ0Q3SignalSources,
  resolveQ0Q3ThresholdTemplate,
} from "@/lib/quality-check/q0q3-runtime";
import { buildDeepGateCalibrationSnapshot } from "@/lib/quality-check/deep-gate-calibration";
import { resolveDeepGateModelRuntime } from "@/lib/quality-check/deep-gate-model-runtime";
import {
  resolveDeepGateThresholdTemplate,
} from "@/lib/quality-gate";
import { extractQualityCheckTaskContext } from "@/lib/quality-check/task-context";
import { runSignalSyncBeforeQualityCheck } from "@/lib/quality-check/signal-sync";
import {
  persistChapterAudits,
  type ChapterAuditAccumulator,
} from "@/lib/quality-check/chapter-audit";
import {
  processQualityCheckAudioFiles,
  type QualityCheckProcessingState,
} from "@/lib/quality-check/process-audio-files";
import { finalizeQualityCheckRun } from "@/lib/quality-check/finalize-run";
import {
  evaluateFastGate,
  resolveReprocessingStatusFromVerdict,
} from "@/lib/quality-check/fast-gate";
import type {
  FastGateInput,
  FastGateVerdict,
  QualityCheckRunParams,
  QualityCheckTaskType,
} from "@/lib/quality-check/shared-types";
export type {
  FastGateVerdict,
  QualityCheckRunParams,
  QualityCheckTaskType,
} from "@/lib/quality-check/shared-types";

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
  if (type === "chapter" && !chapterId) {
    throw new Error("章节质检必须提供 chapterId");
  }

  return {
    bookId,
    status: "completed",
    ...(type === "chapter" && chapterId ? { chapterId } : {}),
    ...(type === "batch" && audioFileIds ? { id: { in: audioFileIds } } : {}),
  };
};
export { evaluateFastGate, resolveReprocessingStatusFromVerdict };

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
  const isCalibrationEval = taskContext.calibrationEval.enabled;

  await updateTaskProgress(
    taskId,
    10,
    isCalibrationEval ? "准备执行 Deep Gate 校准回放" : "准备执行 Fast/Deep Gate 质检"
  );

  const where = buildQualityWhere({
    bookId,
    type,
    chapterId,
    audioFileIds,
  });

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { metadata: true },
  });

  const signalSyncTaskId = await runSignalSyncBeforeQualityCheck({
    parentTaskId: taskId,
    bookId,
    type,
    chapterId,
    audioFileIds,
    totalItems: await prisma.audioFile.count({ where }),
    signalSync: taskContext.signalSync,
  });

  const audioFiles = await prisma.audioFile.findMany({
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
          priority: true,
          emotionLabel: true,
          emotionIntensity: true,
        },
      },
      synthesisAttempts: {
        select: {
          id: true,
          metrics: true,
        },
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (audioFiles.length === 0) {
    throw new Error("没有可执行质检的音频");
  }

  const thresholdResolution = resolveDeepGateThresholdTemplate({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  const q0q3SignalSourceResolution = resolveQ0Q3SignalSources({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  const q0q3ThresholdResolution = resolveQ0Q3ThresholdTemplate({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  const modelRuntimeResolution = resolveDeepGateModelRuntime({
    taskMetadata: taskContext.taskMetadata,
    bookMetadata: book?.metadata,
  });
  await updateTaskProgress(taskId, 20, "开始逐句执行 Fast/Deep Gate 质检");
  const processingState: QualityCheckProcessingState =
    await processQualityCheckAudioFiles({
      taskId,
      audioFiles,
      taskContext,
      q0q3SignalSourceConfig: q0q3SignalSourceResolution.config,
      q0q3ThresholdTemplate: q0q3ThresholdResolution.template,
      thresholdTemplate: thresholdResolution.template,
      modelRuntime: modelRuntimeResolution.runtime,
      modelRuntimeSource: modelRuntimeResolution.source,
      isCalibrationEval,
    });

  if (processingState.checked === 0) {
    throw new Error("没有可执行质检的句子数据");
  }

  const deepGateCalibration = buildDeepGateCalibrationSnapshot({
    samples: processingState.deepGateCalibrationSamples,
    template: thresholdResolution.template,
  });

  await updateTaskProgress(
    taskId,
    92,
    isCalibrationEval ? "整理校准回放结果" : "写入章节一致性审计"
  );

  const {
    chapterAuditCount,
    chapterAuditRepairCount,
    chapterAuditManualReviewCount,
  } = isCalibrationEval
    ? {
        chapterAuditCount: 0,
        chapterAuditRepairCount: 0,
        chapterAuditManualReviewCount: 0,
      }
    : await persistChapterAudits({
        bookId,
        taskId,
        chapterAuditMap: processingState.chapterAuditMap,
        thresholdTemplate: thresholdResolution.template,
      });

  await finalizeQualityCheckRun({
    taskId,
    bookId,
    type,
    chapterId,
    audioFileIds,
    signalSyncTaskId,
    taskContext,
    bookMetadata: book?.metadata,
    processingState,
    deepGateCalibration,
    thresholdTemplate: thresholdResolution.template,
    thresholdTemplateSource: thresholdResolution.source,
    q0q3SignalSourceConfig: q0q3SignalSourceResolution.config,
    q0q3SignalSourceConfigSource: q0q3SignalSourceResolution.source,
    q0q3ThresholdTemplate: q0q3ThresholdResolution.template,
    q0q3ThresholdTemplateSource: q0q3ThresholdResolution.source,
    chapterAuditCount,
    chapterAuditRepairCount,
    chapterAuditManualReviewCount,
    deepGateModelRuntime: {
      source: modelRuntimeResolution.source,
      useEmotionModel: modelRuntimeResolution.runtime.useEmotionModel,
      useContinuityModel: modelRuntimeResolution.runtime.useContinuityModel,
      emotionModelUsedCount: processingState.emotionModelUsedCount,
      continuityModelUsedCount: processingState.continuityModelUsedCount,
      fallbackCount: processingState.deepGateModelFallbackCount,
    },
  });
}

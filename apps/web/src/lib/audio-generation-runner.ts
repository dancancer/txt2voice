// 一旦我被更新，请更新我的开头注释
// input: 音频任务参数
// output: 音频任务执行器导出
// pos: 任务执行入口
import { getAudioGenerator } from "@/lib/audio-generator";
import type { AudioGenerationOptions } from "@/lib/audio-generator";
import type { AudioReliabilityPassSummary } from "@/lib/audio-generation/types";
import prisma from "@/lib/prisma";
import {
  jsonObject,
  mergeTaskData,
} from "@/lib/processing-task-utils";
import { throwIfTaskCanceled } from "@/lib/task-cancellation";
import {
  extractManualReviewBatchTaskContext,
  extractManualReviewTaskContext,
  extractQcRetryTaskContext,
} from "@/lib/audio-generation/runner/task-context";
import { finalizeAudioGenerationTask } from "@/lib/audio-generation/runner/finalize-task";
import {
  extractRouterDecisionField,
  summarizeAudioChildJobs,
  summarizeRouterDecisions,
} from "@/lib/audio-generation/runner/summaries";
import { createAudioTaskRuntimeUpdater } from "@/lib/audio-generation/runner/runtime-progress";
import { executeAudioGeneration } from "@/lib/audio-generation/runner/execute";
import type {
  AudioGenerationRunParams,
  AudioGenerationTaskType,
} from "@/lib/audio-generation/runner/types";

export type { AudioGenerationTaskType } from "@/lib/audio-generation/runner/types";

/**
 * 执行音频生成任务。
 * 注意：异常交由队列层决定是否重试和最终失败落库。
 */
export async function runAudioGenerationTask({
  bookId,
  taskId,
  type,
  chapterId,
  scriptSentenceIds,
  voiceProfileId,
  autoMerge = false,
  options = {},
}: AudioGenerationRunParams): Promise<void> {
  await throwIfTaskCanceled(taskId);

  const audioGenerator = getAudioGenerator();
  const taskSnapshot = await prisma.processingTask.findUnique({
    where: { id: taskId },
    select: {
      taskData: true,
    },
  });
  const manualReviewContext = extractManualReviewTaskContext(taskSnapshot?.taskData);
  const manualReviewBatchContext = extractManualReviewBatchTaskContext(
    taskSnapshot?.taskData
  );
  const qcRetryContext = extractQcRetryTaskContext(taskSnapshot?.taskData);
  const runtimeUpdater = createAudioTaskRuntimeUpdater({
    taskId,
    metadata: jsonObject(
      ((taskSnapshot?.taskData as Record<string, unknown> | null)?.metadata as any) || {}
    ),
  });

  await runtimeUpdater.setStage({
    progress: 10,
    message: "准备生成音频",
    title: "准备生成音频",
    detail: "初始化音频生成上下文",
    stage: "prepare",
  });

  const startMessage =
    type === "book"
      ? "开始生成整书音频"
      : type === "chapter"
        ? "开始生成章节音频"
        : type === "batch"
          ? "开始批量生成音频"
          : "开始生成单个音频";
  await runtimeUpdater.setStage({
    progress: 20,
    message: startMessage,
    title: startMessage,
    detail: "开始执行批量音频生成",
    stage: "audio_generation",
  });

  const { results, totalSentences, audioReliability } = await executeAudioGeneration({
    audioGenerator,
    bookId,
    type,
    chapterId,
    scriptSentenceIds,
    voiceProfileId,
    options,
    hooks: {
      assertContinue: async () => {
        await throwIfTaskCanceled(taskId);
      },
      onPassComplete: async (summary: AudioReliabilityPassSummary) => {
        const progress = Math.min(
          75,
          25 +
            Math.round(
              ((summary.successCount + summary.failedCount) /
                Math.max(summary.requestCount, 1)) *
                45
            )
        );
        await runtimeUpdater.recordBatchPass({
          ...summary,
          progress,
        });
      },
    },
  });

  await throwIfTaskCanceled(taskId);

  await runtimeUpdater.setStage({
    progress: 80,
    message: "统计生成结果",
    title: "统计生成结果",
    detail: `成功 ${results.filter((r) => r.success).length} · 失败 ${results.filter((r) => !r.success).length}`,
    stage: "finalize",
  });

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const routerDecisionSummary = summarizeRouterDecisions(results);
  const audioChildJobMetrics = summarizeAudioChildJobs(
    results,
    typeof options.provider === "string" ? options.provider : null
  );

  let mergeResult = null;
  if (autoMerge && successCount > 0) {
    await throwIfTaskCanceled(taskId);
    await runtimeUpdater.setStage({
      progress: 85,
      message: "正在合并音频文件",
      title: "正在合并音频文件",
      detail: "批量音频生成完成，进入合并阶段",
      stage: "audio_merge",
    });

    const { getAudioMerger } = await import("@/lib/audio-merger");
    const audioMerger = getAudioMerger();

    if (type === "chapter" && chapterId) {
      mergeResult = await audioMerger.mergeChapterAudio(bookId, chapterId);
    } else if (type === "book") {
      mergeResult = await audioMerger.mergeBookAudio(bookId);
    }

    if (mergeResult && !mergeResult.success) {
      console.warn("音频合并失败:", mergeResult.error);
    }
  }

  const [book, totalAudioFiles] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: {
        metadata: true,
      },
    }),
    prisma.audioFile.count({
      where: { bookId },
    }),
  ]);

  await runtimeUpdater.setStage({
    progress: 100,
    message: "音频生成完成",
    title: "音频生成完成",
    detail: `成功 ${successCount} · 失败 ${failedCount}`,
    stage: "completed",
    status: failedCount > 0 ? "warning" : "success",
  });

  const message = `音频生成完成，成功 ${successCount} 个，失败 ${failedCount} 个${mergeResult?.success ? "，已合并音频" : ""}`;

  await throwIfTaskCanceled(taskId);

  const taskData = await mergeTaskData(taskId, {
    message,
    metadata: {
      ...runtimeUpdater.getMetadata(),
      type,
      chapterId,
      voiceProfileId,
      provider: options.provider || null,
      routerPolicyVersion: options.routerPolicyVersion || null,
      enableRouterDebug: options.enableRouterDebug === true,
      audioReliability,
      audioChildJobMetrics,
      totalSentences,
      successCount,
      failedCount,
      routerDecisionSummary,
      autoMerge,
      mergeResult: mergeResult
        ? {
            success: mergeResult.success,
            fileName: mergeResult.fileName,
            fileSize: mergeResult.fileSize,
            duration: mergeResult.duration,
          }
        : null,
      results: results.map((r) => ({
        success: r.success,
        error: r.error,
        duration: r.duration,
        audioFileId: typeof r.audioFileId === "string" ? r.audioFileId : null,
        selectedEngine: extractRouterDecisionField(r.metadata, "selectedEngine"),
        selectedSource: extractRouterDecisionField(r.metadata, "selectedSource"),
      })),
    },
  });

  const generatedDuration = Number(
    results.reduce((sum, result) => sum + (result.duration || 0), 0).toFixed(2)
  );

  await finalizeAudioGenerationTask({
    bookId,
    taskId,
    type,
    chapterId,
    scriptSentenceIds,
    results,
    successCount,
    failedCount,
    totalAudioFiles,
    generatedDuration,
    taskData,
    bookMetadata: book?.metadata,
    manualReviewContext,
    manualReviewBatchContext,
    qcRetryContext,
  });
}
